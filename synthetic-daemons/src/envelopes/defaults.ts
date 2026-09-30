import type { Request, Response } from "express";
import type { CatalogRoute } from "../catalog.js";
import { json, ok } from "../createServer.js";

/**
 * Typed shallow envelopes for catalogued routes that do not yet have
 * MemoryStore-backed handlers. Prefer real handlers for GUI-critical paths.
 */
export function envelopeFor(route: CatalogRoute): (req: Request, res: Response) => void {
  return (_req: Request, res: Response): void => {
    console.warn(`[envelope] ${route.methodPath} — synthetic stub`);
    const path = route.path.toLowerCase();
    const method = route.method.toUpperCase();

    if (method === "GET" || method === "HEAD") {
      if (
        path.includes("/running")
        || path.endsWith("/list")
        || path.includes("/accessible")
        || path.includes("/backups")
        || path.includes("/portforwards")
        || path.includes("/status")
        || path.includes("/members")
        || path.includes("/admins")
        || path.includes("/suborgs")
        || path.includes("/transactions")
        || path.includes("/tiers")
        || path.includes("/history")
      ) {
        json(res, []);
        return;
      }
      if (path.includes("/scenarios")) {
        json(res, { scenarios: [] });
        return;
      }
      if (path.includes("/org-targets") || path.endsWith("/targets")) {
        json(res, { targets: [] });
        return;
      }
      if (path.includes("/cancreate") || path.includes("/canallocate")) {
        json(res, { cancreate: true, canallocate: true });
        return;
      }
      if (path.includes("ping")) {
        json(res, { ok: true });
        return;
      }
      json(res, {});
      return;
    }

    if (method === "DELETE" && path.includes("/org-targets/")) {
      json(res, { success: true, message: "Target deleted" });
      return;
    }

    if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
      if (method === "DELETE" || path.includes("/unregister") || path.includes("/stop")) {
        ok(res);
        return;
      }
      json(res, { success: true });
      return;
    }

    ok(res);
  };
}
