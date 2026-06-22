import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { createCatchAllRouter } from "../catchAll.js";
import { json, ok } from "../createServer.js";
import { rk } from "../config.js";

function ndjsonResponse(res: Response, items: Record<string, unknown>[]): void {
  const body = items.map((item) => JSON.stringify(item)).join("\n");
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson");
  res.send(body ? `${body}\n` : "");
}

export function servicesRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const base = rk(config.restKeys, "SERVICE_CLIENT_API_URL_KEY");

  router.get("/:service/running", (req: Request, res: Response) => {
    const serviceType = req.params.service;
    ndjsonResponse(res, store.listRunningServices(serviceType));
  });

  router.get("/:service/running/:itemUuid", (req: Request, res: Response) => {
    const item = store.findService(req.params.service, req.params.itemUuid);
    if (!item) {
      json(res, {}, 404);
      return;
    }
    json(res, item);
  });

  router.post("/:service/cancreate", (req: Request, res: Response) => {
    const servers = store.targets.data
      .filter((t) => t.target_type === "meson_public" || t.target_type === "meson_private")
      .map((t) => ({
        cancreate: true,
        provider: (t.target_config?.provider as string) ?? "ovh",
        target: t.target_id,
        carbon_footprint: null,
        billing: [],
      }));

    json(res, {
      nservers: servers.length,
      servers: servers.length > 0 ? servers : [
        {
          cancreate: true,
          provider: "scaleway",
          target: "scaleway-staging",
          carbon_footprint: null,
          billing: [],
        },
        {
          cancreate: true,
          provider: "ovh",
          target: "ovh-demo-public",
          carbon_footprint: null,
          billing: [],
        },
      ],
    });
  });

  router.post("/:service/create", (req: Request, res: Response) => {
    const serviceType = req.params.service;
    const billingUuid = `billing-${serviceType}-${randomUUID().slice(0, 8)}`;
    const serviceUuid = randomUUID();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const record = store.createServiceInstance(serviceType, serviceUuid, billingUuid, body);
    json(res, {
      billing_uuid: billingUuid,
      payment_url: `https://synthetic.local/pay/${billingUuid}`,
      service_uuid: serviceUuid,
      ...record,
    });
  });

  router.get("/:service/credentials/:itemUuid", (req: Request, res: Response) => {
    const item = store.findService(req.params.service, req.params.itemUuid);
    const lines = [
      "# Synthetic PaaS credentials",
      `service=${req.params.service}`,
      `service_uuid=${req.params.itemUuid}`,
      `access_key=SYNTHETIC_ACCESS_KEY`,
      `secret_key=SYNTHETIC_SECRET_KEY`,
      item ? `endpoint=${item.endpoint ?? item.cluster_name ?? "n/a"}` : "",
    ].filter(Boolean);

    res.status(200);
    res.setHeader("Content-Type", "text/plain");
    res.send(lines.join("\n"));
  });

  router.delete("/:service/delete", (req: Request, res: Response) => {
    const serviceUuid = (req.body?.service_uuid as string) ?? "";
    store.removeService(req.params.service, serviceUuid);
    ok(res);
  });

  router.use(createCatchAllRouter(base));

  return router;
}
