import { Router, type Request, type Response } from "express";
import { json } from "../createServer.js";
import type { MemoryStore } from "../MemoryStore.js";

function hypermonitorEnabled(): boolean {
  const raw = process.env.SYNTHETIC_HYPERMONITOR;
  if (raw === undefined) {
    return true;
  }
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

export function subscriptionRouter(store: MemoryStore): Router {
  const router = Router();

  router.get("/tiers", (_req: Request, res: Response) => {
    json(res, store.billingTiers());
  });

  router.get("/", (_req: Request, res: Response) => {
    json(res, store.currentSubscription());
  });

  router.get("/org", (_req: Request, res: Response) => {
    json(res, [store.currentSubscription()]);
  });

  return router;
}

export { hypermonitorEnabled };
