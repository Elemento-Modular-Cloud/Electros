#!/usr/bin/env node
/**
 * Assert synthetic-daemons expose every catalogued production route (non-404).
 * Also checks GUI-critical response shapes.
 *
 * Usage: npm run build && npm run test:parity
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const catalog = JSON.parse(readFileSync(join(ROOT, "catalog/production-routes.json"), "utf8"));

const PORTS = {
  auth: 47777,
  compute: 17777,
  storage: 27777,
  network: 37777,
  target: 57777,
  services: 6777,
  mcp: 7782,
};

let failures = 0;

function toProbePath(path) {
  return path
    .replace(/\{[^}]+\}/g, "synthetic-param")
    .replace(/:([A-Za-z0-9_]+)/g, "synthetic-param");
}

async function waitForReady(child, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for synthetic-daemons")), timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      if (text.includes("[mcp] listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`synthetic-daemons exited early with ${code}`));
    });
  });
}

async function probe(method, url) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? "{}" : undefined,
    });
    const text = await response.text();
    return { status: response.status, text, contentType: response.headers.get("content-type") ?? "" };
  } catch (err) {
    return { status: `ERR:${err.message}`, text: "", contentType: "" };
  }
}

/** Express default 404 is plain text "Cannot METHOD /path". Handler 404s are JSON. */
function isUnmountedExpress404(result, method, path) {
  if (result.status !== 404) {
    return false;
  }
  if (result.contentType.includes("application/json")) {
    return false;
  }
  const cannot = new RegExp(`^Cannot\\s+${method}\\s+`, "i");
  return cannot.test(result.text) || result.text.trim() === "";
}

async function expectJson(url, shape, label = url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`FAIL ${label} → ${response.status}`);
    failures += 1;
    return null;
  }
  const body = await response.json();
  if (!shape(body)) {
    console.error(`FAIL ${label} unexpected shape`, body);
    failures += 1;
    return body;
  }
  console.log(`ok   shape ${label}`);
  return body;
}

async function run() {
  const child = spawn(process.execPath, [join(ROOT, "dist/index.js")], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  try {
    await waitForReady(child);

    // Catalog coverage: every route answers (not Express default 404).
    // Skip destructive deletes that need real IDs when probing with placeholders —
    // still expect non-404 (envelope or handler).
    let checked = 0;
    for (const route of catalog.routes) {
      const port = PORTS[route.daemon];
      if (!port) {
        console.error(`FAIL unknown daemon ${route.daemon}`);
        failures += 1;
        continue;
      }
      const path = toProbePath(route.path);
      const url = `http://127.0.0.1:${port}${path}`;
      const result = await probe(route.method, url);
      checked += 1;
      if (typeof result.status === "string" && result.status.startsWith("ERR:")) {
        console.error(`FAIL catalog gap ${route.id} → ${result.status}`);
        failures += 1;
      } else if (isUnmountedExpress404(result, route.method, path)) {
        console.error(`FAIL catalog gap ${route.id} → unmounted Express 404`);
        failures += 1;
      }
    }
    console.log(`catalog probes: ${checked} routes`);

    // GUI-critical shapes
    await expectJson(
      "http://127.0.0.1:57777/api/v1.0/client/target/connections/me/connections-status",
      (b) => typeof b.active_connections === "number" && typeof b.max_connections === "number"
    );
    await expectJson(
      "http://127.0.0.1:17777/api/v1.0/client/vm/porttunnel/status",
      (b) => Array.isArray(b.status)
    );

    const vnc = await fetch("http://127.0.0.1:17777/api/v1.0/client/vm/porttunnel/vncWebSocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vm_uuid: "vm-synth", server_host: "127.0.0.1" }),
    });
    const vncBody = await vnc.json();
    if (!(vnc.ok && typeof vncBody.tunnel_port === "number" && typeof vncBody.instance_id === "string" && typeof vncBody.service === "string")) {
      console.error("FAIL VNC websocket shape", vncBody);
      failures += 1;
    } else {
      console.log("ok   shape VNC websocket");
    }

    const destroy = await fetch("http://127.0.0.1:27777/api/v1.0/client/volume/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume_id: "missing-volume" }),
    });
    const destroyBody = await destroy.json();
    if (!(destroy.ok && destroyBody.vid === "missing-volume")) {
      console.error("FAIL volume destroy shape", destroyBody);
      failures += 1;
    } else {
      console.log("ok   shape volume destroy");
    }

    // Legacy target list remains mounted on this branch; production middev /list is unmounted.
    // Catalog coverage still requires grants/connections envelopes above.
    const list = await fetch("http://127.0.0.1:57777/api/v1.0/client/target/list");
    if (!list.ok) {
      console.error(`FAIL legacy /list should answer on this branch, got ${list.status}`);
      failures += 1;
    } else {
      console.log("ok   legacy /list still mounted on this branch");
    }
  } finally {
    child.kill("SIGTERM");
  }

  if (failures > 0) {
    console.error(`\n${failures} parity assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nParity passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
