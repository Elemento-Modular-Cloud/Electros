from http.server import HTTPServer, BaseHTTPRequestHandler
import secrets
import threading
import urllib.request
import urllib.error
import os
import ssl

_token = None
_lock = threading.Lock()

AUTH_DAEMON = "https://127.0.0.1:47777"
FLASK_HOST = os.environ.get("PROXIMA_FLASK_HOST", "https://10.88.0.1:7781")
VERIFY_SSL = False  # daemon uses self-signed cert


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    # ── validate: called by nginx auth_request ──────────────────
    def do_GET(self):
        if self.path == "/validate":
            incoming = self.headers.get("X-Session-Token", "")
            with _lock:
                ok = bool(_token) and secrets.compare_digest(_token, incoming)
            self._send(200 if ok else 401)
        if self.path.startswith("/login-proxy"):
            self._handle_login()
        elif self.path == "/local-login":
            self._handle_local_login()
        else:
            self._send(404)

    def _handle_local_login(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        req = urllib.request.Request(
            f"{FLASK_HOST}/api/v1.0/local_login",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, context=ctx, timeout=10)
            status = resp.status
            resp_body = resp.read()
        except urllib.error.HTTPError as e:
            status = e.code
            resp_body = e.read()

        cookie_header = None
        if status == 200:
            tok = secrets.token_urlsafe(32)
            with _lock:
                global _token
                _token = tok
            cookie_header = (
                f"session_token={tok}; Path=/; HttpOnly; Secure; SameSite=Lax"
            )

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if cookie_header:
            self.send_header("Set-Cookie", cookie_header)
        self.send_header("Content-Length", str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)

    def _handle_login(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        # Reconstruct the target path:
        # /login-proxy/api/v1/authenticate/... → /api/v1/authenticate/...
        target_path = self.path.replace("/login-proxy", "", 1)
        target_url = AUTH_DAEMON + target_path

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        # Forward headers, strip hop-by-hop
        skip = {"host", "connection", "transfer-encoding", "content-length"}
        fwd_headers = {k: v for k, v in self.headers.items() if k.lower() not in skip}
        if body:
            fwd_headers["Content-Length"] = str(len(body))

        req = urllib.request.Request(
            target_url, data=body or None, headers=fwd_headers, method="POST"
        )
        try:
            resp = urllib.request.urlopen(req, context=ctx, timeout=10)
            status = resp.status
            resp_body = resp.read()
            resp_headers = dict(resp.headers)
        except urllib.error.HTTPError as e:
            status = e.code
            resp_body = e.read()
            resp_headers = dict(e.headers)

        # Issue a new token only on successful login
        cookie_header = None
        if status == 200:
            tok = secrets.token_urlsafe(32)
            with _lock:
                global _token
                _token = tok
            cookie_header = (
                f"session_token={tok}; Path=/; HttpOnly; Secure; SameSite=Lax"
            )

        # Write response back to nginx
        self.send_response(status)
        for k, v in resp_headers.items():
            if k.lower() in ("connection", "transfer-encoding", "set-cookie"):
                continue
            self.send_header(k, v)
        if cookie_header:
            self.send_header("Set-Cookie", cookie_header)
        self.send_header("Content-Length", str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)

    def _send(self, code):
        self.send_response(code)
        self.end_headers()


HTTPServer(("127.0.0.1", 9999), Handler).serve_forever()
