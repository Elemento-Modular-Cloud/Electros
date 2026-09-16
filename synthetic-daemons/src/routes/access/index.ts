import { Router, type Request, type Response } from "express";
import type { MemoryStore } from "../../MemoryStore.js";
import { json, message, requireAuth } from "../../createServer.js";

export function authSessionRouter(store: MemoryStore): Router {
  const router = Router();

  const authenticate = (req: Request, res: Response): void => {
    const src = { ...req.query, ...req.body } as Record<string, unknown>;
    const username = String(src.username ?? "demo@synthetic.local");
    const password = String(src.password ?? "demo");
    const orgId = src.org_id ? String(src.org_id) : undefined;
    const suborg = src.suborg ? String(src.suborg) : undefined;
    const status = store.login(username, password, orgId, suborg);
    json(res, { authenticated: status.authenticated });
  };

  router.get("/login", authenticate);
  router.post("/login", authenticate);

  router.post("/logout", (_req: Request, res: Response) => {
    store.logout();
    json(res, {});
  });

  router.post("/relogin", requireAuth(store), (req: Request, res: Response) => {
    const orgId = String(req.body?.org_id ?? "");
    const suborg = req.body?.suborg ? String(req.body.suborg) : undefined;
    if (!orgId) {
      json(res, { detail: "org_id is required" }, 400);
      return;
    }
    json(res, store.relogin(orgId, suborg));
  });

  router.get("/status", requireAuth(store), (_req: Request, res: Response) => {
    json(res, store.statusPayload());
  });

  router.get("/status/authenticated", (_req: Request, res: Response) => {
    json(res, { authenticated: Boolean(store.authStatus.authenticated) });
  });

  router.get("/refresh", requireAuth(store), (_req: Request, res: Response) => {
    json(res, store.statusPayload());
  });

  router.get("/scopes", requireAuth(store), (_req: Request, res: Response) => {
    store.rebuildScopes();
    json(res, store.scopes);
  });

  router.get("/cert", requireAuth(store), (req: Request, res: Response) => {
    const host = String(req.query.host ?? "192.168.1.10");
    json(res, store.certForHost(host));
  });

  router.post("/cert/trust", requireAuth(store), (req: Request, res: Response) => {
    const fingerprint = String(req.body?.fingerprint ?? req.query.fingerprint ?? "");
    if (!fingerprint) {
      json(res, { error: "Bad Request", description: "Missing required field 'fingerprint'." }, 400);
      return;
    }
    store.trustCert(fingerprint);
    json(res, {});
  });

  return router;
}

export function oauthRouter(store: MemoryStore): Router {
  const router = Router();

  router.get("/providers", (_req: Request, res: Response) => {
    json(res, {
      providers: [
        { label: "Google", value: "google" },
        { label: "LinkedIn", value: "linkedin-openid-connect" },
        { label: "Github", value: "github" },
      ],
    });
  });

  router.post("/login", (req: Request, res: Response) => {
    const redirectHost = String(req.body?.redirect_host ?? "127.0.0.1:47777");
    json(res, {
      auth_url: `http://${redirectHost}/api/v1/authenticate/oauth/callback?demo=1`,
    });
  });

  router.get("/callback", (_req: Request, res: Response) => {
    store.login("demo@synthetic.local", "demo");
    json(res, { authenticated: true });
  });

  return router;
}

export function accountRouter(store: MemoryStore): Router {
  const router = Router();

  router.post("/details", requireAuth(store), (req: Request, res: Response) => {
    store.upsertAccountDetails(req.body ?? {});
    message(res, "Account details saved");
  });

  router.patch("/details", requireAuth(store), (req: Request, res: Response) => {
    store.upsertAccountDetails(req.body ?? {});
    message(res, "Account details updated");
  });

  router.get("/details", requireAuth(store), (_req: Request, res: Response) => {
    if (!store.accountDetails) {
      json(res, { detail: "No account details" }, 404);
      return;
    }
    json(res, store.accountDetails);
  });

  router.patch("/preferred-org", requireAuth(store), (req: Request, res: Response) => {
    const orgId = String(req.body?.org_id ?? "");
    if (!orgId) {
      json(res, { detail: "org_id is required" }, 400);
      return;
    }
    store.setPreferredOrg(orgId);
    message(res, "Preferred organisation updated");
  });

  router.post("/register", (req: Request, res: Response) => {
    const email = String(req.body?.email ?? req.body?.username ?? "");
    const password = String(req.body?.password ?? "demo");
    store.registerUser(email, password, req.body?.org_name as string | undefined);
    message(res, "Account registered");
  });

  router.post("/register/login", (req: Request, res: Response) => {
    const email = String(req.body?.email ?? req.body?.username ?? "");
    const password = String(req.body?.password ?? "demo");
    store.registerUser(email, password, req.body?.org_name as string | undefined);
    json(res, store.login(email, password));
  });

  router.post("/register/org", (req: Request, res: Response) => {
    const email = String(req.body?.email ?? req.body?.username ?? "");
    const password = String(req.body?.password ?? "demo");
    store.registerUser(email, password, String(req.body?.org_name ?? "New Org"));
    message(res, "Organisation registered");
  });

  router.post("/register/org/login", (req: Request, res: Response) => {
    const email = String(req.body?.email ?? req.body?.username ?? "");
    const password = String(req.body?.password ?? "demo");
    store.registerUser(email, password, String(req.body?.org_name ?? "New Org"));
    json(res, store.login(email, password));
  });

  router.post("/verify-email/request", requireAuth(store), (_req: Request, res: Response) => {
    store.requestEmailVerification(store.authStatus.username ?? "demo@synthetic.local");
    message(res, "Verification email sent");
  });

  router.post("/verify-email/confirm", requireAuth(store), (req: Request, res: Response) => {
    const okCode = store.confirmEmail(store.authStatus.username ?? "", String(req.body?.code ?? ""));
    if (!okCode) {
      json(res, { detail: "Invalid code" }, 400);
      return;
    }
    message(res, "Email verified");
  });

  return router;
}

export function billingRouter(store: MemoryStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/my/transactions", (req: Request, res: Response) => {
    json(res, store.getBillingTransactions(req.query.billing_uuid as string | undefined));
  });

  router.post("/:billingUuid/refresh-link", (req: Request, res: Response) => {
    json(res, { payment_url: `https://synthetic.local/pay/${req.params.billingUuid}` });
  });

  router.get("/status", (_req: Request, res: Response) => {
    json(res, { status: "active", balance: 0 });
  });

  return router;
}

export function licenseRouter(store: MemoryStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/list", (_req: Request, res: Response) => {
    json(res, store.licenses);
  });

  router.get("/armed", (_req: Request, res: Response) => {
    json(res, store.getArmedLicense());
  });

  router.post("/arm", (req: Request, res: Response) => {
    const licenseKey = String(req.body?.license_key ?? req.body?.licenseKey ?? "");
    try {
      json(res, store.armLicense(licenseKey));
    } catch (err) {
      json(res, { message: String(err) }, 404);
    }
  });

  router.delete("/delete", (req: Request, res: Response) => {
    const licenseKey = String(req.body?.license_key ?? "");
    store.deleteLicense(licenseKey);
    json(res, { message: "License deleted" });
  });

  return router;
}

export function orgsRouter(store: MemoryStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.post("/org", (req: Request, res: Response) => {
    const org = store.createOrg(String(req.body?.org_name ?? "New Org"), req.body?.limits);
    json(res, { org_name: org.org_name, org_id: org.org_id });
  });

  router.get("/account/managedmembers", (_req: Request, res: Response) => {
    const org = store.currentOrg();
    json(res, { users: [...new Set([...org.members, ...org.admins, org.owner])] });
  });

  router.get("/orgs/:orgId/owner", (req: Request, res: Response) => {
    const org = store.findOrg(req.params.orgId);
    if (!org) {
      json(res, { detail: "Organisation not found" }, 404);
      return;
    }
    json(res, { username: org.owner });
  });

  router.get("/orgs/:orgId/admins", (req: Request, res: Response) => {
    const org = store.findOrg(req.params.orgId);
    json(res, { users: org?.admins ?? [] });
  });

  router.get("/orgs/:orgId/suborgs", (req: Request, res: Response) => {
    const org = store.findOrg(req.params.orgId);
    json(res, {
      suborgs: (org?.suborgs ?? []).map((s) => ({
        suborg_name: s.suborg_name,
        suborg_id: s.suborg_id,
      })),
    });
  });

  router.post("/orgs/:orgId/admin", (req: Request, res: Response) => {
    store.addAdmin(req.params.orgId, String(req.body?.username ?? ""));
    message(res, "Admin added");
  });

  router.delete("/orgs/:orgId/admins/:admin", (req: Request, res: Response) => {
    store.removeAdmin(req.params.orgId, req.params.admin);
    message(res, "Admin removed");
  });

  router.get("/orgs/:orgId/invite", (req: Request, res: Response) => {
    json(res, store.invites.filter((i) => i.org_id === req.params.orgId));
  });

  router.post("/orgs/:orgId/invite", (req: Request, res: Response) => {
    store.createInvite(
      req.params.orgId,
      String(req.body?.invited_email ?? ""),
      req.body?.suborg_name as string | undefined
    );
    message(res, "Invite sent");
  });

  router.get("/orgs/:orgId/members", (req: Request, res: Response) => {
    json(res, { users: store.findOrg(req.params.orgId)?.members ?? [] });
  });

  router.get("/orgs/:orgId/suborgs/:suborg/members", (req: Request, res: Response) => {
    json(res, { users: store.findSuborg(req.params.orgId, req.params.suborg)?.members ?? [] });
  });

  router.get("/orgs/:orgId/membership/tree", (req: Request, res: Response) => {
    try {
      const tree = store.membershipTree(req.params.orgId);
      json(res, tree);
    } catch (err) {
      json(res, { detail: String(err) }, 404);
    }
  });

  router.get("/orgs/:orgId/suborgs/:suborg/membership/tree", (req: Request, res: Response) => {
    try {
      json(res, store.membershipTree(req.params.orgId, req.params.suborg));
    } catch (err) {
      json(res, { detail: String(err) }, 404);
    }
  });

  router.post("/orgs/:orgId/membership", (req: Request, res: Response) => {
    store.addMember(req.params.orgId, String(req.body?.username ?? req.body?.email ?? ""));
    message(res, "Member added");
  });

  router.post("/orgs/:orgId/suborgs/:suborg/membership", (req: Request, res: Response) => {
    store.addMember(req.params.orgId, String(req.body?.username ?? req.body?.email ?? ""), req.params.suborg);
    message(res, "Member added");
  });

  router.delete("/orgs/:orgId/members/:user", (req: Request, res: Response) => {
    store.removeMember(req.params.orgId, req.params.user);
    message(res, "Member removed");
  });

  router.delete("/orgs/:orgId/suborgs/:suborg/members/:user", (req: Request, res: Response) => {
    store.removeMember(req.params.orgId, req.params.user, req.params.suborg);
    message(res, "Member removed");
  });

  router.get("/orgs/:orgId/suborgs/:suborg/children", (req: Request, res: Response) => {
    const sub = store.findSuborg(req.params.orgId, req.params.suborg);
    json(res, { suborgs: sub?.inner_suborgs ?? [] });
  });

  router.get("/orgs/:orgId/suborgs/:suborg/admins", (req: Request, res: Response) => {
    json(res, { users: store.findSuborg(req.params.orgId, req.params.suborg)?.admins ?? [] });
  });

  router.post("/orgs/:orgId/suborgs", (req: Request, res: Response) => {
    try {
      const sub = store.createSuborg(req.params.orgId, String(req.body?.suborg_name ?? req.body?.name ?? "team"));
      json(res, { suborg_name: sub.suborg_name, suborg_id: sub.suborg_id });
    } catch (err) {
      json(res, { detail: String(err) }, 404);
    }
  });

  router.post("/orgs/:orgId/suborgs/:suborg/admin", (req: Request, res: Response) => {
    store.addAdmin(req.params.orgId, String(req.body?.username ?? ""), req.params.suborg);
    message(res, "Suborg admin added");
  });

  router.delete("/orgs/:orgId/suborgs/:suborg", (req: Request, res: Response) => {
    store.deleteSuborg(req.params.orgId, req.params.suborg);
    message(res, "Sub-organisation deleted");
  });

  router.delete("/orgs/:orgId/suborgs/:suborg/admins/:user", (req: Request, res: Response) => {
    store.removeAdmin(req.params.orgId, req.params.user, req.params.suborg);
    message(res, "Suborg admin removed");
  });

  const limitsHandler = (req: Request, res: Response): void => {
    json(res, store.getLimits(req.params.orgId, req.params.suborg, req.params.user));
  };
  const limitsUpdate = (req: Request, res: Response): void => {
    store.setLimits(req.params.orgId, req.body?.limits ?? req.body, req.params.suborg, req.params.user);
    message(res, "Limits updated");
  };

  router.get("/orgs/:orgId/limits", limitsHandler);
  router.put("/orgs/:orgId/limits", limitsUpdate);
  router.get("/orgs/:orgId/suborgs/:suborg/limits", limitsHandler);
  router.put("/orgs/:orgId/suborgs/:suborg/limits", limitsUpdate);
  router.get("/orgs/:orgId/members/:user/limits", limitsHandler);
  router.put("/orgs/:orgId/members/:user/limits", limitsUpdate);
  router.get("/orgs/:orgId/suborgs/:suborg/members/:user/limits", limitsHandler);
  router.put("/orgs/:orgId/suborgs/:suborg/members/:user/limits", limitsUpdate);

  return router;
}

export function subscriptionRouter(store: MemoryStore): Router {
  const router = Router();

  router.get("/tiers", (_req: Request, res: Response) => {
    json(res, store.tiers);
  });

  router.get("/", requireAuth(store), (req: Request, res: Response) => {
    const sub = store.currentSubscription(req.query.org as string | undefined, req.query.email as string | undefined);
    if (!sub) {
      res.status(200).type("application/json").send("null");
      return;
    }
    json(res, sub);
  });

  router.get("/history", requireAuth(store), (req: Request, res: Response) => {
    json(res, store.orgSubscriptions(req.query.org as string | undefined, true));
  });

  router.get("/org", requireAuth(store), (req: Request, res: Response) => {
    const includeInactive = String(req.query.include_inactive ?? "false") === "true";
    json(res, store.orgSubscriptions(req.query.org as string | undefined, includeInactive));
  });

  router.post("/payment-links", requireAuth(store), (_req: Request, res: Response) => {
    const sub = store.currentSubscription();
    if (!sub) {
      json(res, { detail: "No subscription" }, 404);
      return;
    }
    json(res, store.checkoutPayload(sub));
  });

  router.post("/payment-links/owner", requireAuth(store), (_req: Request, res: Response) => {
    const sub = store.currentSubscription();
    if (!sub) {
      json(res, { detail: "No subscription" }, 404);
      return;
    }
    json(res, store.checkoutPayload(sub));
  });

  router.post("/subscribe", requireAuth(store), (req: Request, res: Response) => {
    const record = store.subscribe(
      String(req.body?.tier ?? "standard"),
      String(req.body?.billing_frequency ?? "monthly"),
      req.body?.org as string | undefined,
      req.body?.email as string | undefined
    );
    json(res, store.checkoutPayload(record));
  });

  router.post("/subscribe/bulk", requireAuth(store), (req: Request, res: Response) => {
    const items = (req.body?.items as Array<Record<string, unknown>>) ?? [req.body ?? {}];
    const frequency = String(req.body?.billing_frequency ?? "monthly");
    const last = items.map((item) => store.subscribe(
      String(item.tier ?? "standard"),
      frequency,
      item.org as string | undefined,
      item.email as string | undefined
    )).at(-1);
    json(res, last ? store.checkoutPayload(last) : { checkouts: [] });
  });

  router.post("/change-tier", requireAuth(store), (req: Request, res: Response) => {
    const record = store.subscribe(
      String(req.body?.tier ?? "pro"),
      store.currentSubscription()?.billing_frequency ?? "monthly",
      req.body?.org as string | undefined,
      req.body?.email as string | undefined
    );
    json(res, store.checkoutPayload(record));
  });

  router.delete("/cancel", requireAuth(store), (req: Request, res: Response) => {
    const cancelled = store.cancelSubscription(
      String(req.body?.email ?? store.authStatus.username ?? ""),
      Boolean(req.body?.at_period_end),
      req.body?.org as string | undefined
    );
    if (!cancelled) {
      json(res, { detail: "No subscription" }, 404);
      return;
    }
    json(res, cancelled);
  });

  return router;
}

export function inviteRouter(store: MemoryStore): Router {
  const router = Router();

  router.get("/accept/:token", (req: Request, res: Response) => {
    const invite = store.invites.find((i) => i.token === req.params.token || i.id === req.params.token);
    if (!invite) {
      json(res, { detail: "Invite not found" }, 404);
      return;
    }
    json(res, invite);
  });

  router.post("/accept/:token/register", (req: Request, res: Response) => {
    const invite = store.acceptInvite(req.params.token, req.body ?? {});
    if (!invite) {
      json(res, { detail: "Invite not found" }, 404);
      return;
    }
    json(res, { ...invite, authenticated: true });
  });

  return router;
}
