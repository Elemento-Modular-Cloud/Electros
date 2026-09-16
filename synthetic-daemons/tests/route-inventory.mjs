#!/usr/bin/env node
/**
 * Boots synthetic-daemons and asserts the mounted real-daemon surface.
 * Usage: npm run build && npm run test:routes
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const AUTH = "http://127.0.0.1:47777";
const COMPUTE = "http://127.0.0.1:17777";
const STORAGE = "http://127.0.0.1:27777";
const NETWORK = "http://127.0.0.1:37777";
const TARGET = "http://127.0.0.1:57777";
const SERVICE = "http://127.0.0.1:6777";
const MCP = "http://127.0.0.1:7782";

const AUTH_BASE = `${AUTH}/api/v1/authenticate`;
const API = `${AUTH}/api/v1.0`;
const TARGET_BASE = `${TARGET}/api/v1.0/client/target`;
const ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

let failures = 0;

async function expect(method, url, opts = {}) {
  const status = opts.status ?? 200;
  const asJson = opts.asJson ?? true;
  const shape = opts.shape;
  const response = await fetch(url, { method, headers: { Accept: "application/json" } });
  const label = `${method} ${url}`;
  if (response.status !== status) {
    console.error(`FAIL ${label} → ${response.status} (expected ${status})`);
    failures += 1;
    return null;
  }
  if (!asJson) {
    console.log(`ok   ${label} → ${response.status}`);
    return null;
  }
  const body = await response.json();
  if (shape) {
    const okShape = shape(body);
    if (!okShape) {
      console.error(`FAIL ${label} unexpected shape`, body);
      failures += 1;
      return body;
    }
  }
  console.log(`ok   ${label} → ${response.status}`);
  return body;
}

async function waitForReady(child, timeoutMs = 15000) {
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

async function run() {
  const child = spawn(process.execPath, [join(ROOT, "dist/index.js")], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  try {
    await waitForReady(child);

    await expect("GET", AUTH, { asJson: false });
    await expect("GET", `${AUTH}/version`, { shape: (b) => typeof b.version === "string" });
    await expect("GET", `${AUTH_BASE}/status/authenticated`, {
      shape: (b) => b.authenticated === true,
    });
    await expect("GET", `${AUTH_BASE}/status`, {
      shape: (b) => b.authenticated === true && b.org_id === ORG && b.role === "ORGOWNER" && b.active_subscriber === true,
    });
    await expect("GET", `${AUTH_BASE}/scopes`, {
      shape: (b) => Array.isArray(b.scopes) && b.scopes[0]?.org_id === ORG,
    });
    await expect("GET", `${AUTH_BASE}/account/details`, {
      shape: (b) => typeof b.full_address === "string",
    });
    await expect("GET", `${AUTH_BASE}/license/list`, {
      shape: (b) => Array.isArray(b.licenses),
    });
    await expect("GET", `${AUTH_BASE}/billing/my/transactions`, {
      shape: (b) => Array.isArray(b),
    });
    await expect("GET", `${AUTH_BASE}/oauth/providers`, {
      shape: (b) => Array.isArray(b.providers),
    });
    await expect("GET", `${API}/orgs/${ORG}/membership/tree`, {
      shape: (b) => b.org_id === ORG && Array.isArray(b.suborgs),
    });
    await expect("GET", `${API}/orgs/${ORG}/owner`, {
      shape: (b) => typeof b.username === "string",
    });
    await expect("GET", `${API}/orgs/${ORG}/limits`, {
      shape: (b) => b.max_vms === -1,
    });
    await expect("GET", `${API}/subscription/tiers`, {
      shape: (b) => Array.isArray(b) && b.length >= 1,
    });
    await expect("GET", `${API}/subscription/`, {
      shape: (b) => b.status === "active",
    });

    await expect("GET", TARGET, { asJson: false });
    await expect("GET", `${TARGET_BASE}/grants/me`, {
      shape: (b) => Array.isArray(b.targets) && Array.isArray(b.scenarios) && Array.isArray(b.target_grants),
    });
    await expect("GET", `${TARGET_BASE}/connections/me`, {
      shape: (b) => Array.isArray(b.active_targets) && typeof b.max_connections === "number",
    });
    await expect("GET", `${TARGET_BASE}/org-targets`, {
      shape: (b) => Array.isArray(b.targets) && b.targets.length > 0,
    });
    await expect("GET", `${TARGET_BASE}/target-grants`, {
      shape: (b) => Array.isArray(b.target_grants),
    });
    await expect("GET", `${TARGET_BASE}/scenarios`, {
      shape: (b) => Array.isArray(b.scenarios),
    });
    await expect("GET", `${TARGET_BASE}/configs/supported_providers`, {
      shape: (b) => typeof b === "object" && b !== null,
    });
    await expect("GET", `${TARGET_BASE}/settings`, { shape: (b) => typeof b === "object" });

    const listGone = await fetch(`${TARGET_BASE}/list`);
    if (listGone.status === 404) {
      console.log(`ok   GET ${TARGET_BASE}/list → 404 (not mounted)`);
    } else {
      console.error(`FAIL GET ${TARGET_BASE}/list still answers ${listGone.status}`);
      failures += 1;
    }

    await expect("GET", `${COMPUTE}/api/v1.0/client/vm/status`, { shape: (b) => Array.isArray(b) });
    await expect("GET", `${COMPUTE}/api/v1.0/client/vm/marketprices`, {
      shape: (b) => b.source === "synthetic",
    });
    await expect("GET", `${STORAGE}/api/v1.0/client/volume/accessible`, { shape: (b) => Array.isArray(b) });
    await expect("GET", `${NETWORK}/api/v1.0/client/network/list`, { shape: (b) => Array.isArray(b) });
    await expect("GET", `${SERVICE}/api/v1.0/client/service/kaas/running`, { asJson: false });
    await expect("GET", `${MCP}/ping`, {
      shape: (b) => b.ok === true && b.service === "electros-mcp",
    });
    await expect("GET", `${MCP}/electros/confirm-mode`, {
      shape: (b) => typeof b.mode === "string",
    });
    await expect("GET", `${MCP}/proxy/llm/agent/threads`, {
      shape: (b) => Array.isArray(b.threads),
    });
  } finally {
    child.kill("SIGTERM");
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nRoute inventory passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
