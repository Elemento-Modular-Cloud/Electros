import type { Server } from "node:http";
import { loadConfig, rk } from "./config.js";
import { MemoryStore } from "./MemoryStore.js";
import { createDaemonServer, mountRouter } from "./createServer.js";
import { authRouter } from "./routes/auth.js";
import { computeRouter } from "./routes/compute.js";
import { storageRouter } from "./routes/storage.js";
import { networkRouter } from "./routes/network.js";
import { targetRouter } from "./routes/target.js";
import { servicesRouter } from "./routes/services.js";

const config = loadConfig();
const store = new MemoryStore(config);
const servers: Server[] = [];

function start(): void {
  const { networking, restKeys } = config;

  servers.push(
    createDaemonServer({
      name: "auth",
      port: networking.AUTH_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "AUTH_CLIENT_API_URL_KEY"), authRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "compute",
      port: networking.MATCHER_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "CLIENT_API_URL_KEY"), computeRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "storage",
      port: networking.STORAGE_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "STORAGE_CLIENT_API_URL_KEY"), storageRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "network",
      port: networking.NETWORK_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "NETWORK_CLIENT_API_URL_KEY"), networkRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "target",
      port: networking.TARGET_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "TARGET_CLIENT_API_URL_KEY"), targetRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "services",
      port: networking.SERVICE_CLIENT_REST_API_PORT,
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "SERVICE_CLIENT_API_URL_KEY"), servicesRouter(store, config));
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
