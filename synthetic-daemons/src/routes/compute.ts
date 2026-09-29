import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";

export function computeRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const keys = config.restKeys;

  router.get(rk(keys, "STATUS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.vms);
  });

  router.get(rk(keys, "TEMPLATES_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.templates);
  });

  router.get(rk(keys, "HOST_STATUS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.hostStatus);
  });

  router.post(rk(keys, "CANALLOCATE_API_KEY"), (_req: Request, res: Response) => {
    json(res, { canallocate: true });
  });

  router.post(rk(keys, "REGISTER_API_KEY"), (req: Request, res: Response) => {
    const body = req.body ?? {};
    const vmName = (body.vm_name as string) ?? `vm-${randomUUID().slice(0, 8)}`;
    const vm = {
      uniqueID: randomUUID(),
      serverurl: null,
      target_type: body.target_type ?? "atomos_local_ip",
      req_json: {
        vm_name: vmName,
        allowSMT: false,
        arch: "x86_64",
        creation_date: new Date().toISOString(),
        flags: [],
        netdevs: [],
        os_family: body.os_family ?? "linux",
        os_flavour: body.os_flavour ?? "ubuntu",
        firmware: "bios",
        overprovision: 1,
        qemu_agent: true,
        ramsize: body.ramsize ?? 4,
        reqECC: false,
        slots: body.slots ?? 2,
        autostart: false,
        states: "shut off",
        networks: [],
        pcidevs: [],
        volumes: body.volumes ?? [],
      },
    };
    store.addVm(vm);
    json(res, vm);
  });

  router.post(rk(keys, "UNREGISTER_API_KEY"), (req: Request, res: Response) => {
    const localIndex = (req.body?.local_index as string) ?? "";
    store.removeVm(localIndex);
    ok(res);
  });

  const power = (state: string) => (req: Request, res: Response) => {
    const uid = (req.body?.local_index as string) ?? (req.body?.vm_uid as string) ?? "";
    store.setVmState(uid, state);
    ok(res);
  };

  router.post(rk(keys, "START_VM_KEY"), power("running"));
  router.post(rk(keys, "STOP_VM_KEY"), power("shut off"));
  router.post(rk(keys, "REBOOT_VM_KEY"), power("running"));

  router.post(rk(keys, "MIGRATION_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.get(rk(keys, "PORTTUNNEL_STATUS"), (_req: Request, res: Response) => {
    json(res, { status: store.portTunnels });
  });

  router.post(rk(keys, "PORTTUNNEL_START"), (req: Request, res: Response) => {
    const tunnel = { ...(req.body as object), active: true };
    store.portTunnels.push(tunnel);
    store.touch();
    json(res, tunnel);
  });

  router.post(rk(keys, "PORTTUNNEL_STOP"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.get(rk(keys, "LIST_BACKUPS_API_KEY"), (_req: Request, res: Response) => {
    json(res, []);
  });

  router.post(rk(keys, "CREATE_BACKUP_API_KEY"), (_req: Request, res: Response) => {
    json(res, { backup_id: randomUUID() });
  });

  router.post(rk(keys, "ATTACH_NETWORK_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "DETACH_NETWORK_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "AGENT_KEY"), (_req: Request, res: Response) => {
    json(res, { output: "synthetic agent ok" });
  });

  router.get(rk(keys, "VM_USAGE_API_KEY"), (_req: Request, res: Response) => {
    json(res, {});
  });

  router.get(rk(keys, "PORTTUNNEL_VNC_WITH_WS"), (_req: Request, res: Response) => {
    json(res, []);
  });
  router.post(rk(keys, "PORTTUNNEL_VNC_WITH_WS"), (req: Request, res: Response) => {
    const instanceId = String(req.body?.instance_id ?? randomUUID());
    const vmUuid = String(req.body?.vm_uuid ?? req.body?.local_index ?? instanceId);
    json(res, {
      tunnel_port: Number(req.body?.tunnel_port ?? 6080),
      vm_uuid: vmUuid,
      instance_id: instanceId,
      service: String(req.body?.service ?? "VNC"),
    });
  });
  router.get(`${rk(keys, "PORTTUNNEL_VNC_WITH_WS")}/:instanceId`, (req: Request, res: Response) => {
    json(res, {
      tunnel_port: 6080,
      vm_uuid: req.params.instanceId,
      instance_id: req.params.instanceId,
      service: "VNC",
    });
  });
  router.delete(rk(keys, "PORTTUNNEL_STOP_VNC_WITH_WS"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(`${rk(keys, "LAST_VM_KEY")}/:volumeUid`, (req: Request, res: Response) => {
    json(res, store.lastVmForVolume(req.params.volumeUid) ?? {});
  });
  router.post("/volume/attach", (_req: Request, res: Response) => { ok(res); });
  router.post("/volume/detach", (_req: Request, res: Response) => { ok(res); });
  router.post("/update", (_req: Request, res: Response) => { ok(res); });

  return router;
}

