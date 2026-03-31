# Session Guard — Container-level Session Enforcement

## What problem does this solve?

When a user spawns a container, the container is accessible at a known port on the host.
Anyone who discovers that port can access the container directly, bypassing the Flask app entirely.
Additionally, if a second user logs in to an already active container, there is no mechanism
to invalidate the first user's session.

This solution enforces sessions **inside the container itself**, so it doesn't matter how a
request reaches it, the container will always reject unauthenticated or stale requests.

---

## How it works

Two small additions to the container:

### 1. The sidecar (`session_guard.py`)

A minimal Python HTTP server that runs on `127.0.0.1:9999` inside the container.
It is never reachable from outside — it only talks to the container nginx internally.

It does two things:

- **Acts as a login proxy** — when a user logs in, the container nginx routes the login
  request through the sidecar instead of directly to the auth daemon. The sidecar forwards
  the request, and if the auth daemon returns a success, it generates a secure random token,
  stores it in memory, and injects a `Set-Cookie` header into the response before returning
  it to the browser.

- **Validates sessions** — on every request to any protected resource, the container nginx
  calls the sidecar's `/validate` endpoint as a subrequest. The sidecar compares the token
  from the browser's cookie against the one stored in memory. If they match, the request
  proceeds. If not, the container nginx blocks it with a `401`.

### 2. The container nginx

The container nginx is updated to:

- Route `/api/v1/authenticate/` through the sidecar (login proxy) instead of the auth
  daemon directly.
- Add an `auth_request` check to every other location, pointing to the sidecar's
  `/validate` endpoint.
- Return a `401` or `403` JSON response for any request that fails validation.

---

## Security guarantees

| Scenario | Result |
|---|---|
| User knows the port and bypasses Flask | Container nginx fires `auth_request` → no cookie → `401` blocked |
| User tries to access an active container without logging in | Same as above — `401` |
| A second user logs in to an already active container | Sidecar overwrites the stored token — first user's cookie immediately becomes invalid |
| User tampers with their cookie | `secrets.compare_digest` rejects any value that doesn't match exactly |
| Fresh container, nobody logged in yet | `_token` is `None` — every request returns `401` until a real login occurs |

The host Flask app and host nginx require **zero changes**. The host nginx continues to
proxy to the container port as before. The enforcement is entirely internal to the container.

---

## What does NOT change

- The host nginx configuration
- The Flask application
- The internal auth daemon or any other daemon inside the container
- Container port mappings
- Any other part of the existing infrastructure
