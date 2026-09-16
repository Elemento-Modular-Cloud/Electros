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
  const host = (body.ip as string)
    ?? (body.server as string)
    ?? "192.168.1.10";

  return {
    alg: "no",
    bootable: Boolean(body.bootable),
    bus: (body.bus as string) ?? "virtio",
    cache: null,
    ceph: Boolean(body.ceph),
    clonable: false,
    cloudinit: Boolean(body.cloudinit),
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
    server: host,
    servers: [host],
    serverurl: (body.serverurl as string) ?? `https://${host}`,
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
  router.post(rk(keys, "CAN_CREATE_VOLUME_MULTIPLE_API_KEY"), (req: Request, res: Response) => {
    const n = Array.isArray(req.body) ? req.body.length : 1;
    json(res, { cancreate: true, count: n });
  });

  router.post(rk(keys, "CREATE_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume(req.body ?? {});
    store.addVolume(volume);
    json(res, volume);
  });
  router.post(rk(keys, "CREATE_VOLUME_MULTIPLE_API_KEY"), (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : [req.body ?? {}];
    const created = items.map((item) => {
      const volume = minimalVolume(item as Record<string, unknown>);
      store.addVolume(volume);
      return volume;
    });
    json(res, created);
  });

  router.post(rk(keys, "DESTROY_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const id = (req.body?.volumeID as string) ?? (req.body?.name as string) ?? "";
    store.removeVolume(id);
    ok(res);
  });

  const volumeInfo = (req: Request, res: Response): void => {
    const name = String(req.body?.name ?? req.query.name ?? req.body?.volumeID ?? "");
    const vol = store.volumes.find((v) => v.name === name || v.volumeID === name);
    json(res, vol ?? {});
  };
  router.get(rk(keys, "VOLUME_INFO_API_KEY"), volumeInfo);
  router.post(rk(keys, "VOLUME_INFO_API_KEY"), volumeInfo);

  router.post(rk(keys, "UPDATE_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });
  router.post(rk(keys, "RESIZE_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });
  router.post(rk(keys, "CONVERT_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "IMPORT_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume({ ...(req.body ?? {}), name: req.body?.name ?? `import-${randomUUID().slice(0, 6)}` });
    store.addVolume(volume);
    json(res, volume);
  });
  router.post(rk(keys, "OVERLAY_COMPACT_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });
  router.post(rk(keys, "ISO_CREATE_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume({ ...(req.body ?? {}), format: "iso", name: req.body?.name ?? `iso-${randomUUID().slice(0, 6)}` });
    store.addVolume(volume);
    json(res, volume);
  });
  router.post(rk(keys, "CLOUDINIT_CREATE_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume({ ...(req.body ?? {}), cloudinit: true, name: req.body?.name ?? `cidata-${randomUUID().slice(0, 6)}` });
    store.addVolume(volume);
    json(res, volume);
  });
  router.post(`${rk(keys, "CLOUDINIT_UPLOAD_META_API_KEY")}/:data`, (_req: Request, res: Response) => {
    json(res, { uploaded: true });
  });
  router.post(rk(keys, "CEPH_CREATE_VOLUME_API_KEY"), (req: Request, res: Response) => {
    const volume = minimalVolume({ ...(req.body ?? {}), ceph: true, name: req.body?.name ?? `ceph-${randomUUID().slice(0, 6)}` });
    store.addVolume(volume);
    json(res, volume);
  });
  router.post(rk(keys, "RESET_VOLUME_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });
  router.get(`${rk(keys, "LAST_VM_KEY")}/:volumeUuid`, (req: Request, res: Response) => {
    json(res, store.lastVmForVolume(req.params.volumeUuid) ?? {});
  });

  router.use(createCatchAllRouter(base));
  return router;
}
