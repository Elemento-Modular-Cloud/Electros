import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";

function newVm(body: Record<string, unknown>): Record<string, unknown> {
  const vmName = (body.vm_name as string) ?? (body.info as Record<string, unknown>)?.vm_name as string
    ?? `vm-${randomUUID().slice(0, 8)}`;
  return {
    uniqueID: randomUUID(),
    serverurl: body.serverurl ?? null,
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
      networks: body.networks ?? [],
      pcidevs: [],
      volumes: body.volumes ?? [],
    },
  };
}

export function computeRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const keys = config.restKeys;
  const base = rk(keys, "CLIENT_API_URL_KEY");

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

  router.post(rk(keys, "CANALLOCATE_MULTIPLE_API_KEY"), (req: Request, res: Response) => {
    const n = Array.isArray(req.body) ? req.body.length : 1;
    json(res, { can_allocate: true, nservers: store.activeTargets.length || 1, count: n });
  });

  router.post(rk(keys, "REGISTER_API_KEY"), (req: Request, res: Response) => {
    const vm = newVm((req.body ?? {}) as Record<string, unknown>);
    store.addVm(vm);
    json(res, vm);
  });

  router.post(rk(keys, "REGISTER_MULTIPLE_API_KEY"), (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : [req.body ?? {}];
    const registered = items.map((item) => {
      const vm = newVm(item as Record<string, unknown>);
      store.addVm(vm);
      return vm;
    });
    json(res, { registered });
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

  router.get(rk(keys, "MARKET_PRICES_API_KEY"), (_req: Request, res: Response) => {
    json(res, { prices: [], currency: "EUR", source: "synthetic" });
  });
  router.post(rk(keys, "MARKET_PRICES_API_KEY"), (_req: Request, res: Response) => {
    json(res, { prices: [], currency: "EUR", source: "synthetic" });
  });

  router.get(rk(keys, "PORTTUNNEL_STATUS"), (_req: Request, res: Response) => {
    json(res, store.portTunnels);
  });

  router.get(rk(keys, "PORTTUNNEL_SERVICES"), (_req: Request, res: Response) => {
    json(res, store.portTunnelServices);
  });
  router.post(rk(keys, "PORTTUNNEL_SERVICES"), (req: Request, res: Response) => {
    const svc = { ...(req.body as object), id: randomUUID() };
    store.portTunnelServices.push(svc);
    store.touch();
    json(res, svc);
  });
  router.delete(rk(keys, "PORTTUNNEL_SERVICES"), (req: Request, res: Response) => {
    const id = (req.body?.id as string) ?? "";
    store.portTunnelServices = store.portTunnelServices.filter((s) => s.id !== id);
    store.touch();
    ok(res);
  });

  router.post(rk(keys, "PORTTUNNEL_START"), (req: Request, res: Response) => {
    const tunnel = { ...(req.body as object), active: true, id: randomUUID() };
    store.portTunnels.push(tunnel);
    store.touch();
    json(res, tunnel);
  });

  router.post(rk(keys, "PORTTUNNEL_STOP"), (req: Request, res: Response) => {
    const port = req.body?.port;
    const id = req.body?.id as string | undefined;
    store.portTunnels = store.portTunnels.filter((t) =>
      (id ? t.id !== id : true) && (port !== undefined ? t.port !== port : true)
    );
    store.touch();
    ok(res);
  });

  router.get(rk(keys, "PORTTUNNEL_VNC_WITH_WS"), (_req: Request, res: Response) => {
    json(res, { url: "ws://127.0.0.1:6080/vnc", active: false });
  });
  router.post(rk(keys, "PORTTUNNEL_VNC_WITH_WS"), (req: Request, res: Response) => {
    json(res, { url: "ws://127.0.0.1:6080/vnc", instance_id: req.body?.instance_id ?? randomUUID() });
  });
  router.get(`${rk(keys, "PORTTUNNEL_VNC_WITH_WS")}/:instanceId`, (req: Request, res: Response) => {
    json(res, { url: "ws://127.0.0.1:6080/vnc", instance_id: req.params.instanceId });
  });
  router.delete(rk(keys, "PORTTUNNEL_STOP_VNC_WITH_WS"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.get(rk(keys, "LIST_BACKUPS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.backups);
  });
  router.get(rk(keys, "SEARCH_BACKUPS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.backups);
  });
  router.post(rk(keys, "CREATE_BACKUP_API_KEY"), (req: Request, res: Response) => {
    const backup = { backup_id: randomUUID(), created_at: new Date().toISOString(), ...(req.body as object) };
    store.backups.push(backup);
    store.touch();
    json(res, backup);
  });
  router.post(rk(keys, "RESTORE_BACKUP_API_KEY"), (_req: Request, res: Response) => {
    json(res, { restored: true });
  });
  router.delete(rk(keys, "DELETE_BACKUPS_API_KEY"), (req: Request, res: Response) => {
    const id = (req.body?.backup_id as string) ?? "";
    store.backups = store.backups.filter((b) => b.backup_id !== id);
    store.touch();
    ok(res);
  });
  router.post(rk(keys, "SCHEDULE_BACKUP_API_KEY"), (req: Request, res: Response) => {
    json(res, { scheduled: true, ...(req.body as object) });
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
  router.post(`${rk(keys, "AGENT_KEY")}/:command`, (req: Request, res: Response) => {
    json(res, { output: `synthetic agent ${req.params.command} ok` });
  });
  router.post(rk(keys, "AGENT_ATTACH_KEY"), (_req: Request, res: Response) => {
    json(res, { attached: true });
  });

  router.get(rk(keys, "VM_USAGE_API_KEY"), (_req: Request, res: Response) => {
    json(res, {});
  });

  router.post(`${rk(keys, "LAST_VM_KEY")}/:volumeUid`, (req: Request, res: Response) => {
    json(res, store.lastVmForVolume(req.params.volumeUid) ?? {});
  });

  router.use(createCatchAllRouter(base));
  return router;
}
