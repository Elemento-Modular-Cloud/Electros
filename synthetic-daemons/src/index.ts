import type { Server } from "node:http";
import { loadConfig, rk } from "./config.js";
import { MemoryStore } from "./MemoryStore.js";
import { createDaemonServer, mountRouter } from "./createServer.js";
import {
  accountRouter,
  authSessionRouter,
  billingRouter,
  inviteRouter,
  licenseRouter,
  oauthRouter,
  orgsRouter,
  subscriptionRouter,
} from "./routes/access/index.js";
import { computeRouter } from "./routes/compute.js";
import { storageRouter } from "./routes/storage.js";
import { networkRouter } from "./routes/network.js";
import { targetRouter } from "./routes/target.js";
import { servicesRouter } from "./routes/services.js";
import { mcpRouter } from "./routes/mcp.js";

const config = loadConfig();
const store = new MemoryStore(config);
const servers: Server[] = [];

function start(): void {
  const { networking, restKeys } = config;
  const authBase = rk(restKeys, "AUTH_CLIENT_API_URL_KEY");
  const apiV10 = rk(restKeys, "API_URL_KEY");

  servers.push(
    createDaemonServer({
      name: "auth",
      port: networking.AUTH_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Access Client!",
      versionMessage: "This is an Elemento Access Client!",
      mountRouters: (app) => {
        mountRouter(app, authBase, authSessionRouter(store));
        mountRouter(app, `${authBase}/oauth`, oauthRouter(store));
        mountRouter(app, `${authBase}/account`, accountRouter(store));
        mountRouter(app, `${authBase}/billing`, billingRouter(store));
        mountRouter(app, `${authBase}/license`, licenseRouter(store));
        mountRouter(app, `${apiV10}/subscription`, subscriptionRouter(store));
        mountRouter(app, `${apiV10}/invite`, inviteRouter(store));
        mountRouter(app, apiV10, orgsRouter(store));
      },
    }),
    createDaemonServer({
      name: "compute",
      port: networking.MATCHER_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Matcher Client!",
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "CLIENT_API_URL_KEY"), computeRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "storage",
      port: networking.STORAGE_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Storage Client!",
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "STORAGE_CLIENT_API_URL_KEY"), storageRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "network",
      port: networking.NETWORK_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Network Client!",
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "NETWORK_CLIENT_API_URL_KEY"), networkRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "target",
      port: networking.TARGET_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Target Client!",
      versionMessage: "This is an Elemento Target Client!",
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "TARGET_CLIENT_API_URL_KEY"), targetRouter(store));
      },
    }),
    createDaemonServer({
      name: "services",
      port: networking.SERVICE_CLIENT_REST_API_PORT,
      rootMessage: "This is an Elemento Service Client!",
      mountRouters: (app) => {
        mountRouter(app, rk(restKeys, "SERVICE_CLIENT_API_URL_KEY"), servicesRouter(store, config));
      },
    }),
    createDaemonServer({
      name: "mcp",
      port: networking.MCP_SERVER_PORT,
      rootMessage: "This is an Elemento MCP Client!",
      mountRouters: (app) => {
        app.use(mcpRouter());
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
