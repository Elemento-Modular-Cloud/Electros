import type { Server } from "node:http";
import { loadConfig, rk } from "./config.js";
import { MemoryStore } from "./MemoryStore.js";
import { createDaemonServer, mountRouter, json } from "./createServer.js";
import { fillCatalogGaps, type HandlerMap } from "./mountFromCatalog.js";
import { authRouter } from "./routes/auth.js";
import { computeRouter } from "./routes/compute.js";
import { storageRouter } from "./routes/storage.js";
import { networkRouter } from "./routes/network.js";
import { targetRouter } from "./routes/target.js";
import { servicesRouter } from "./routes/services.js";
import { mcpRouter } from "./routes/mcp.js";

const config = loadConfig();
const store = new MemoryStore(config);
const servers: Server[] = [];

function authOverrides(): HandlerMap {
  const map: HandlerMap = new Map();
  map.set("GET /api/v1.0/min-ver/electros", (_req, res) => {
    json(res, { min_version: "0.0.0", recommended: "synthetic-1.0.0" });
  });
  map.set("GET /api/v1.0/min-ver/clients", (_req, res) => {
    json(res, { min_version: "0.0.0" });
  });
  return map;
}

function targetOverrides(): HandlerMap {
  const map: HandlerMap = new Map();
  const base = "/api/v1.0/client/target";
  map.set(`GET ${base}/grants/me`, (_req, res) => {
    json(res, store.grantsMe());
  });
  map.set(`GET ${base}/connections/me`, (_req, res) => {
    json(res, store.connectionsMe());
  });
  map.set(`GET ${base}/connections/me/connections-status`, (_req, res) => {
    json(res, store.connectionsStatus());
  });
  map.set(`POST ${base}/connections/me/target-grants`, (req, res) => {
    const targetId = String(req.body?.target_id ?? "");
    if (!store.setTargetActive(targetId, true)) {
      json(res, { success: false, message: "Unknown target" }, 404);
      return;
    }
    json(res, { success: true });
  });
  map.set(`DELETE ${base}/connections/me/target-grants/:target_id`, (req, res) => {
    const targetId = decodeURIComponent(String(req.params.target_id ?? ""));
    if (!store.setTargetActive(targetId, false)) {
      json(res, { success: false, message: "Unknown target" }, 404);
      return;
    }
    json(res, { success: true });
  });
  map.set(`PUT ${base}/connections/me/scenario`, (req, res) => {
    const scenarioId = String(req.body?.scenario_id ?? "");
    if (!store.activateScenario(scenarioId)) {
      json(res, { success: false, message: "Unknown scenario" }, 404);
      return;
    }
    json(res, { success: true });
  });
  map.set(`GET ${base}/org-targets`, (_req, res) => {
    json(res, { targets: store.targets.data });
  });
  map.set(`GET ${base}/scenarios`, (_req, res) => {
    json(res, { scenarios: store.scenarios });
  });
  map.set(`POST ${base}/org-target`, (req, res) => {
    const created = store.createOrgTarget({
      target_name: String(req.body?.target_name ?? req.body?.target_id ?? "target"),
      target_type: String(req.body?.target_type ?? "atomos_local_ip"),
      target_config: (req.body?.target_config as Record<string, unknown>) ?? {},
    });
    json(res, { id: created.target_id });
  });
  map.set(`POST ${base}/org-target/hypervisor`, (req, res) => {
    const created = store.createOrgTarget({
      target_name: String(req.body?.target_name ?? "hypervisor"),
      target_type: String(req.body?.target_type ?? "hypervisor_proxmox"),
      target_config: (req.body?.target_config as Record<string, unknown>) ?? {},
    });
    json(res, { id: created.target_id });
  });
  map.set(`GET ${base}/grants/me/target-grants/:target_id/version`, (_req, res) => {
    json(res, { version: "synthetic-1.0.0", atomos: "1.0.0" });
  });
  map.set(`GET ${base}/grants/me/target-grants/:target_id/reachable`, (_req, res) => {
    json(res, { reachable: true, ping_ms: 1.2 });
  });
  map.set(`GET ${base}/grants/me/target-grants/:target_id/status`, (_req, res) => {
    json(res, { status: "ok", online: true });
  });
  map.set(`POST ${base}/grants/me/target-grants/:target_id/credentials/hypervisor`, (_req, res) => {
    json(res, { success: true, message: "Credentials accepted" });
  });
  return map;
}

function servicesOverrides(): HandlerMap {
  const map: HandlerMap = new Map();
  map.set("GET /experimental", (_req, res) => {
    json(res, store.activeTargets.map((t) => ({
      target_id: t.target_id,
      target_name: t.target_id,
      target_type: t.target_type,
    })));
  });
  return map;
}

function computeOverrides(): HandlerMap {
  const map: HandlerMap = new Map();
  const base = "/api/v1.0/client/vm";
  map.set(`GET ${base}/process_playbook/path`, (_req, res) => {
    json(res, { path: "/tmp/synthetic-playbook.yml" });
  });
  map.set(`POST ${base}/process_playbook/file`, (_req, res) => {
    json(res, { processed: true });
  });
  return map;
}

function start(): void {
  const { networking, restKeys } = config;

  servers.push(
    createDaemonServer({
      name: "auth",
      port: networking.AUTH_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "AUTH_CLIENT_API_URL_KEY"), authRouter(store, config));
        fillCatalogGaps(app, "auth", authOverrides());
      },
    }),
    createDaemonServer({
      name: "compute",
      port: networking.MATCHER_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "CLIENT_API_URL_KEY"), computeRouter(store, config));
        fillCatalogGaps(app, "compute", computeOverrides());
      },
    }),
    createDaemonServer({
      name: "storage",
      port: networking.STORAGE_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "STORAGE_CLIENT_API_URL_KEY"), storageRouter(store, config));
        fillCatalogGaps(app, "storage");
      },
    }),
    createDaemonServer({
      name: "network",
      port: networking.NETWORK_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "NETWORK_CLIENT_API_URL_KEY"), networkRouter(store, config));
        fillCatalogGaps(app, "network");
      },
    }),
    createDaemonServer({
      name: "target",
      port: networking.TARGET_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "TARGET_CLIENT_API_URL_KEY"), targetRouter(store, config));
        fillCatalogGaps(app, "target", targetOverrides());
      },
    }),
    createDaemonServer({
      name: "services",
      port: networking.SERVICE_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "SERVICE_CLIENT_API_URL_KEY"), servicesRouter(store, config));
        fillCatalogGaps(app, "services", servicesOverrides());
      },
    }),
    createDaemonServer({
      name: "mcp",
      port: networking.MCP_SERVER_PORT,
      mountRouters: (app) => {
        app.use(mcpRouter());
        fillCatalogGaps(app, "mcp");
      },
    })
  );

  console.log(`Synthetic daemons ready (scenario: ${config.scenario})`);
  console.log("Press Ctrl+C to stop.");
}

function shutdown(): void {
  for (const server of servers) {
    server.close();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
