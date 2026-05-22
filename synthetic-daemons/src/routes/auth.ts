import { Router, type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";

export function authRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const base = rk(config.restKeys, "AUTH_CLIENT_API_URL_KEY");

  router.get("/status", (_req: Request, res: Response) => {
    json(res, store.authStatus);
  });

  router.post(rk(config.restKeys, "AUTH_LOGIN"), (req: Request, res: Response) => {
    const username = (req.body?.username as string) ?? "demo";
    store.setAuthenticated(true, username);
    ok(res);
  });

  router.post(rk(config.restKeys, "AUTH_LOGOUT"), (_req: Request, res: Response) => {
    store.setAuthenticated(false);
    ok(res);
  });

  router.get("/cert", (req: Request, res: Response) => {
    const host = String(req.query.host ?? "192.168.1.10");
    json(res, {
      fingerprint: `synthetic:${host}`,
      trusted: true,
    });
  });

  router.post("/cert/trust", (_req: Request, res: Response) => {
    ok(res);
  });

  router.get("/oauth/providers", (_req: Request, res: Response) => {
    json(res, { providers: [] });
  });

  router.post(rk(config.restKeys, "OAUTH_LOGIN"), (_req: Request, res: Response) => {
    json(res, { auth_url: "http://localhost:47777/oauth/callback?demo=1" });
  });

  router.get("/license/list", (_req: Request, res: Response) => {
    json(res, []);
  });

  router.get("/license/armed", (_req: Request, res: Response) => {
    json(res, null);
  });

  router.get("/org/list", (_req: Request, res: Response) => {
    json(res, { organizations: [] });
  });

  router.get(rk(config.restKeys, "BILLING_STATUS_API_KEY"), (_req: Request, res: Response) => {
    json(res, { status: "active", balance: 0 });
  });

  router.get("/billing/my/transactions", (req: Request, res: Response) => {
    const billingUuid = req.query.billing_uuid as string | undefined;
    json(res, store.getBillingTransactions(billingUuid));
  });

  router.post("/billing/:billingUuid/refresh-link", (req: Request, res: Response) => {
    json(res, {
      payment_url: `https://synthetic.local/pay/${req.params.billingUuid}`,
    });
  });

  router.get("/account/details", (_req: Request, res: Response) => {
    json(res, {
      username: store.authStatus.username,
      email: `${store.authStatus.username}@synthetic.local`,
    });
  });

  router.use(createCatchAllRouter(base));

  return router;
}
