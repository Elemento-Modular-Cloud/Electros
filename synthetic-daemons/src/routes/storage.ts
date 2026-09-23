import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";

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
    const id = String(
      req.body?.volume_id
      ?? req.body?.volumeID
      ?? req.body?.vid
      ?? req.body?.name
      ?? ""
    );
    store.removeVolume(id);
    json(res, { vid: id, volume_id: id });
  });

  const volumeInfo = (req: Request, res: Response): void => {
    const id = String(
      req.body?.volume_id
      ?? req.body?.volumeID
      ?? req.body?.vid
      ?? req.body?.name
      ?? req.query.name
      ?? ""
    );
    const vol = store.volumes.find(
      (v) => v.name === id || v.volumeID === id || String((v as Record<string, unknown>).volume_id ?? "") === id
    );
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
  router.post(rk(keys, "OVERLAY_COMPACT_VOLUME_API_KEY"), (_req: Request, res: Response) => { ok(res); });
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
  router.post(rk(keys, "RESET_VOLUME_API_KEY"), (_req: Request, res: Response) => { ok(res); });
  router.get(`${rk(keys, "LAST_VM_KEY")}/:volumeUuid`, (req: Request, res: Response) => {
    json(res, store.lastVmForVolume(req.params.volumeUuid) ?? {});
  });

  return router;
}

