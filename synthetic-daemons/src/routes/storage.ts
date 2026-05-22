import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";

function minimalVolume(body: Record<string, unknown>): Record<string, unknown> {
  const name = (body.name as string) ?? `vol-${randomUUID().slice(0, 8)}`;
  const sizeBytes = typeof body.size === "number" ? body.size : 10_737_418_240;

  return {
    alg: "no",
    bootable: Boolean(body.bootable),
    bus: (body.bus as string) ?? "virtio",
    cache: null,
    ceph: false,
    clonable: false,
    cloudinit: false,
    creatorID: "synthetic",
    exported: false,
    format: (body.format as string) ?? "qcow2",
    iscsi_name: "",
    lastUpdated: new Date().toISOString().replace("T", " ").slice(0, 23),
    name,
    nservers: 1,
    own: true,
    private: Boolean(body.private),
    readonly: Boolean(body.readonly),
    server: (body.ip as string) ?? "192.168.1.10",
    servers: [(body.ip as string) ?? "192.168.1.10"],
    serverurl: (body.serverurl as string) ?? `https://${(body.ip as string) ?? "192.168.1.10"}`,
    shareable: Boolean(body.shareable),
    size: sizeBytes,
    sizeOnDisk: sizeBytes,
    volumeID: randomUUID(),
    read_MB_bw: 100,
    write_MB_bw: 100,
    read_iops: 1000,
    write_iops: 1000,
    hw_device: null,
    fs: null,
    kind: null,
    priority: (body.priority as number) ?? 0,
    target_type: (body.target_type as string) ?? "atomos_local_ip",
  };
}

export function storageRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const keys = config.restKeys;
  const base = rk(keys, "STORAGE_CLIENT_API_URL_KEY");

  router.get(rk(keys, "ACCESSIBLE_VOLUMES_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.volumes);
  });

  router.post(rk(keys, "CAN_CREATE_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    json(res, { cancreate: true });
  });

  router.post(rk(keys, "CREATE_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume(req.body ?? {});
    store.addVolume(volume);
    json(res, volume);
  });

  router.post(rk(keys, "DESTROY_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const id = (req.body?.volumeID as string) ?? (req.body?.name as string) ?? "";
    store.removeVolume(id);
    ok(res);
  });

  router.get(rk(keys, "VOLUME_INFO_API_KEY"), (req: Request, res: Response) => {
    const name = String(req.query.name ?? "");
    const vol = store.volumes.find((v) => v.name === name || v.volumeID === name);
    json(res, vol ?? {});
  });

  router.post(rk(keys, "UPDATE_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "RESIZE_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "CONVERT_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.use(createCatchAllRouter(base));

  return router;
}
