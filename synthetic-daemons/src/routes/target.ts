import { Router, type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore, TargetRecord } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";
import { loadEcdJson, loadSupportedProvidersMap } from "../ecdFiles.js";

export function targetRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const keys = config.restKeys;
  const base = rk(keys, "TARGET_CLIENT_API_URL_KEY");
  const pingPath = rk(keys, "TARGET_PING_API_KEY");

  router.get(rk(keys, "TARGET_LIST_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.targets);
  });

  router.get(pingPath, (_req: Request, res: Response) => {
    const data = store.targets.data.map((t) => store.buildPingResult(t.target_id));
    json(res, { success: true, data });
  });

  router.get(`${pingPath}/:targetId`, (req: Request, res: Response) => {
    const targetId = decodeURIComponent(req.params.targetId);
    json(res, {
      success: true,
      data: store.buildPingResult(targetId),
    });
  });

  router.post(rk(keys, "TARGET_CREATE_API_KEY"), (req: Request, res: Response) => {
    const body = req.body ?? {};
    const record: TargetRecord = {
      target_id: (body.target_id as string) ?? (body.name as string) ?? "new-target",
      target_type: (body.target_type as string) ?? "atomos_local_ip",
      target_config: (body.target_config as Record<string, unknown>) ?? { ips: ["192.168.1.50"] },
    };
    store.addTarget(record);
    json(res, { success: true, data: record });
  });

  router.post(rk(keys, "TARGET_UPDATE_API_KEY"), (req: Request, res: Response) => {
    const body = req.body ?? {};
    const id = (body.target_id as string) ?? "";
    const existing = store.findTarget(id);
    if (existing) {
      Object.assign(existing, body);
      store.touch();
    }
    json(res, { success: true });
  });

  router.post(rk(keys, "TARGET_DELETE_API_KEY"), (req: Request, res: Response) => {
    const id = (req.body?.target_id as string) ?? "";
    store.removeTarget(id);
    ok(res);
  });

  router.get(rk(keys, "TARGET_TYPES_API_KEY"), (_req: Request, res: Response) => {
    json(res, {
      types: [
        "atomos_local_ip",
        "meson_public",
        "meson_private",
        "hypervisor_proxmox",
        "hypervisor_esxi",
        "legacy_atomos",
      ],
    });
  });

  router.post(rk(keys, "TARGET_VALIDATE_API_KEY"), (_req: Request, res: Response) => {
    json(res, { valid: true });
  });

  /** Serves ECD configs (e.g. Atomosphere / PaaS provider catalog). */
  router.get("/configs/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename.replace(/\.json$/, "");

    try {
      if (filename === "supported_providers") {
        json(res, loadSupportedProvidersMap());
        return;
      }

      const data = loadEcdJson(`${filename}.json`);
      json(res, data);
    } catch (err) {
      console.warn(`[target] ECD config missing: ${filename}`, err);
      json(res, {}, 404);
    }
  });

  router.use(createCatchAllRouter(base));

  return router;
}
