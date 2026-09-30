import type { Express, RequestHandler } from "express";
import {
  normalizeMethodPath,
  routesForDaemon,
  toExpressPath,
  type CatalogRoute,
} from "./catalog.js";
import { envelopeFor } from "./envelopes/defaults.js";

type Method = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export type HandlerMap = Map<string, RequestHandler>;

/**
 * Mount a handler (override or typed envelope) for every catalog route on this
 * daemon. Call AFTER smart routers: Express matches the router first; unmatched
 * paths fall through to these catalog mounts.
 *
 * Root `/` and `/version` are owned by createDaemonServer.
 */
export function fillCatalogGaps(
  app: Express,
  daemon: string,
  overrides: HandlerMap = new Map()
): number {
  let added = 0;

  for (const route of routesForDaemon(daemon)) {
    if (route.path === "/" || route.path === "/version") {
      continue;
    }

    const method = route.method.toLowerCase() as Method;
    if (typeof app[method] !== "function") {
      console.warn(`[catalog] unsupported method ${route.method} for ${route.path}`);
      continue;
    }

    const expressPath = toExpressPath(route.path);
    const key = normalizeMethodPath(route.method, expressPath);
    const handler = overrides.get(route.methodPath)
      ?? overrides.get(key)
      ?? overrides.get(`${route.method} ${route.path}`)
      ?? envelopeFor(route);

    app[method](expressPath, handler);
    added += 1;
  }

  console.log(`[${daemon}] catalog surface mounted: ${added} routes`);
  return added;
}

/**
 * Build the set of method+path keys a daemon must expose (for parity tests).
 */
export function expectedCatalogKeys(daemon: string): string[] {
  return routesForDaemon(daemon).map((r) => normalizeMethodPath(r.method, toExpressPath(r.path)));
}

export function catalogRoutes(daemon: string): CatalogRoute[] {
  return routesForDaemon(daemon);
}
