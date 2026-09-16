import { Router, type Request, type Response } from "express";
import type { MemoryStore } from "../MemoryStore.js";
import { json, message, noContent, notFound, requireAuth } from "../createServer.js";
import { loadEcdJson, loadSupportedProvidersMap } from "../ecdFiles.js";

export function targetRouter(store: MemoryStore): Router {
  const router = Router();
  router.use(requireAuth(store));

  router.get("/grants/me", (_req: Request, res: Response) => {
    json(res, store.grantsMe());
  });

  router.get("/connections/me", (_req: Request, res: Response) => {
    json(res, store.connectionsMe());
  });

  router.get("/refresh", (_req: Request, res: Response) => {
    noContent(res);
  });

  router.get("/grants/me/target-grants/:targetId", (req: Request, res: Response) => {
    const target = store.findOrgTarget(req.params.targetId);
    if (!target) {
      notFound(res, "Target not found");
      return;
    }
    json(res, store.serializeTarget(target));
  });

  router.get("/grants/me/scenario/:scenarioId", (req: Request, res: Response) => {
    const scenario = store.scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) {
      notFound(res, "Scenario not found");
      return;
    }
    json(res, store.serializeScenario(scenario));
  });

  router.put("/connections/me/scenario", (req: Request, res: Response) => {
    try {
      json(res, store.activateScenario(String(req.body?.scenario_id ?? "")));
    } catch (err) {
      notFound(res, String(err));
    }
  });

  router.post("/connections/me/target-grants", (req: Request, res: Response) => {
    try {
      json(res, store.activateTarget(String(req.body?.target_id ?? "")));
    } catch (err) {
      json(res, { detail: String(err) }, 400);
    }
  });

  router.delete("/connections/me/target-grants/:targetId", (req: Request, res: Response) => {
    json(res, store.deactivateTarget(req.params.targetId));
  });

  router.get("/org-targets", (_req: Request, res: Response) => {
    json(res, { targets: store.orgTargets });
  });

  router.get("/org-targets/:targetId/usage", (req: Request, res: Response) => {
    if (!store.findOrgTarget(req.params.targetId)) {
      notFound(res, "Target not found");
      return;
    }
    json(res, store.targetUsage(req.params.targetId));
  });

  router.get("/org-targets/:targetId", (req: Request, res: Response) => {
    const target = store.findOrgTarget(req.params.targetId);
    if (!target) {
      notFound(res, "Target not found");
      return;
    }
    json(res, target);
  });

  router.post("/org-target/meson-private", (req: Request, res: Response) => {
    const created = store.createOrgTarget({
      target_name: String(req.body?.target_name ?? "private-meson"),
      target_type: "meson_private",
      target_config: req.body?.target_config ?? {},
    });
    json(res, { id: created.target_id });
  });

  router.post("/org-target", (req: Request, res: Response) => {
    const created = store.createOrgTarget(req.body ?? {});
    json(res, { id: created.target_id });
  });

  router.post("/org-targets", (req: Request, res: Response) => {
    const items = (req.body?.targets_data as Array<Record<string, unknown>>) ?? [];
    const ids = items.map((item) => store.createOrgTarget({
      target_name: String(item.target_name ?? "target"),
      target_type: String(item.target_type ?? "atomos_local_ip"),
      target_config: (item.target_config as Record<string, unknown>) ?? {},
    }).target_id);
    json(res, { ids });
  });

  router.patch("/org-targets/:targetId", (req: Request, res: Response) => {
    try {
      json(res, store.updateOrgTarget(req.params.targetId, req.body ?? {}));
    } catch (err) {
      notFound(res, String(err));
    }
  });

  router.delete("/org-targets/:targetId", (req: Request, res: Response) => {
    if (!store.findOrgTarget(req.params.targetId)) {
      notFound(res, "Target not found");
      return;
    }
    store.deleteOrgTarget(req.params.targetId);
    message(res, "Target deleted");
  });

  router.get("/target-grants/members/:member", (req: Request, res: Response) => {
    json(res, store.memberGrants(req.params.member));
  });

  router.post("/target-grants/members/:member", (req: Request, res: Response) => {
    store.assignGrants(req.params.member, (req.body?.targets as string[]) ?? []);
    message(res, "Target grants assigned");
  });

  router.delete("/target-grants/members/:member", (req: Request, res: Response) => {
    store.unassignGrants(req.params.member, (req.body?.targets as string[]) ?? []);
    message(res, "Target grants revoked");
  });

  router.delete("/target-grants/:targetId/members/:member", (req: Request, res: Response) => {
    store.unassignGrant(req.params.member, req.params.targetId);
    message(res, "Target grant revoked");
  });

  router.get("/target-grants", (_req: Request, res: Response) => {
    json(res, store.assignedTargets());
  });

  router.get("/scenarios/:scenarioId/grants", (req: Request, res: Response) => {
    const scenario = store.scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) {
      notFound(res, "Scenario not found");
      return;
    }
    json(res, { users: scenario.users });
  });

  router.post("/scenarios/:scenarioId/grants", (req: Request, res: Response) => {
    try {
      store.grantScenario(req.params.scenarioId, (req.body?.users as string[]) ?? []);
      message(res, "Scenario granted");
    } catch (err) {
      notFound(res, String(err));
    }
  });

  router.delete("/scenarios/:scenarioId/grants/:member", (req: Request, res: Response) => {
    store.revokeScenario(req.params.scenarioId, req.params.member);
    message(res, "Scenario grant revoked");
  });

  router.get("/scenarios/:scenarioId", (req: Request, res: Response) => {
    const scenario = store.scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) {
      notFound(res, "Scenario not found");
      return;
    }
    json(res, store.serializeScenario(scenario));
  });

  router.get("/scenarios", (_req: Request, res: Response) => {
    json(res, { scenarios: store.scenarios.map((s) => store.serializeScenario(s)) });
  });

  router.post("/scenario", (req: Request, res: Response) => {
    const created = store.createScenario(
      String(req.body?.name ?? "scenario"),
      (req.body?.pools as string[]) ?? []
    );
    json(res, { id: created.id });
  });

  router.post("/scenarios", (req: Request, res: Response) => {
    const items = (req.body?.scenarios_data as Array<Record<string, unknown>>) ?? [];
    const ids = items.map((item) => store.createScenario(
      String(item.name ?? "scenario"),
      (item.pools as string[]) ?? []
    ).id);
    json(res, { ids });
  });

  router.patch("/scenarios/:scenarioId", (req: Request, res: Response) => {
    try {
      json(res, store.serializeScenario(store.updateScenario(
        req.params.scenarioId,
        req.body?.name as string | undefined,
        req.body?.pools as string[] | undefined
      )));
    } catch (err) {
      notFound(res, String(err));
    }
  });

  router.delete("/scenarios/:scenarioId", (req: Request, res: Response) => {
    store.deleteScenario(req.params.scenarioId);
    message(res, "Scenario deleted");
  });

  router.delete("/scenarios", (req: Request, res: Response) => {
    for (const id of (req.body?.scenarios as string[]) ?? []) {
      store.deleteScenario(id);
    }
    message(res, "Scenarios deleted");
  });

  router.get("/settings", (_req: Request, res: Response) => {
    json(res, store.targetSettings);
  });

  router.put("/settings", (req: Request, res: Response) => {
    store.targetSettings = { ...store.targetSettings, ...(req.body ?? {}) };
    store.touch();
    noContent(res);
  });

  router.get("/configs/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename.replace(/\.json$/, "");
    try {
      if (filename === "supported_providers") {
        json(res, loadSupportedProvidersMap());
        return;
      }
      json(res, loadEcdJson(`${filename}.json`));
    } catch (err) {
      console.warn(`[target] ECD config missing: ${filename}`, err);
      json(res, {}, 404);
    }
  });

  router.get("/cert", (req: Request, res: Response) => {
    json(res, store.certForHost(String(req.query.host ?? "192.168.1.10")));
  });

  router.post("/cert/trust", (req: Request, res: Response) => {
    const fingerprint = String(req.body?.fingerprint ?? "");
    if (!fingerprint) {
      json(res, { error: "Bad Request", description: "Missing required field 'fingerprint'." }, 400);
      return;
    }
    store.trustCert(fingerprint);
    json(res, {});
  });

  return router;
}
