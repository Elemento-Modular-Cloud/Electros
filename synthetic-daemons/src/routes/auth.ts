import { Router, type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";

export function authRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();

  router.get("/status", (_req: Request, res: Response) => {
    json(res, store.statusPayload());
  });

  router.get("/status/authenticated", (_req: Request, res: Response) => {
    json(res, { authenticated: store.authStatus.authenticated });
  });

  router.get("/status/authenticated/me", (_req: Request, res: Response) => {
    json(res, store.statusPayload());
  });

  router.get("/scopes", (_req: Request, res: Response) => {
    json(res, store.scopesPayload());
  });

  router.get("/refresh", (_req: Request, res: Response) => {
    json(res, store.statusPayload());
  });

  router.post(rk(config.restKeys, "AUTH_LOGIN"), (req: Request, res: Response) => {
    const username = (req.body?.username as string) ?? "demo@synthetic.local";
    const orgId = req.body?.org_id as string | undefined;
    store.setAuthenticated(true, username);
    if (orgId) {
      store.authStatus.org_id = orgId;
      store.touch();
    }
    json(res, { authenticated: true });
  });

  router.post("/relogin", (req: Request, res: Response) => {
    if (!store.authStatus.authenticated) {
      json(res, { detail: "Not authenticated" }, 401);
      return;
    }
    if (req.body?.org_id) {
      store.authStatus.org_id = String(req.body.org_id);
      store.authStatus.org_name = store.authStatus.org_name || "Elemento Demo";
      store.authStatus.org = store.authStatus.org_name;
    }
    if (req.body?.suborg_id !== undefined) {
      store.authStatus.suborg_id = req.body.suborg_id ? String(req.body.suborg_id) : null;
      store.authStatus.suborg_name = req.body.suborg_id ? String(req.body.suborg_id) : null;
    }
    store.touch();
    json(res, store.statusPayload());
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
    json(res, store.licenses);
  });

  router.get("/license/armed", (_req: Request, res: Response) => {
    const armed = store.getArmedLicense();
    json(res, armed);
  });

  router.post("/license/arm", (req: Request, res: Response) => {
    const licenseKey =
      (req.body?.license_key as string) ?? (req.body?.licenseKey as string) ?? "";
    try {
      json(res, store.armLicense(licenseKey));
    } catch (err) {
      json(res, { message: String(err) }, 404);
    }
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
    json(res, store.accountDetailsPayload());
  });

  router.post("/account/details", (_req: Request, res: Response) => {
    ok(res);
  });

  router.patch("/account/details", (_req: Request, res: Response) => {
    ok(res);
  });

  router.patch("/account/preferred-org", (req: Request, res: Response) => {
    if (req.body?.org_id) {
      store.authStatus.org_id = String(req.body.org_id);
      store.touch();
    }
    json(res, store.statusPayload());
  });

  return router;
}
