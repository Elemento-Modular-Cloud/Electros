import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";
import { cloudVmNetworkConfig, enrichEphemeralVmRecord } from "../cloudVmDefaults.js";

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

  router.post(rk(keys, "REGISTER_API_KEY"), (req: Request, res: Response) => {
    const body = req.body ?? {};
    const vmName = (body.vm_name as string) ?? `vm-${randomUUID().slice(0, 8)}`;
    const targetType = (body.target_type as string) ?? "atomos_local_ip";
    const isCloudTarget = targetType === "meson_public" || targetType === "meson_private";
    const vm = {
      uniqueID: randomUUID(),
      serverurl: body.serverurl ?? null,
      target_type: targetType,
      req_json: {
        vm_name: vmName,
        allowSMT: false,
        arch: "x86_64",
        creation_date: new Date().toISOString(),
        flags: [],
        netdevs: [],
        os_family: body.os_family ?? "linux",
        os_flavour: body.os_flavour ?? "ubuntu",
        instance_flavour_catalog: body.instance_flavour_catalog ?? null,
        instance_flavour: body.instance_flavour ?? null,
        block_storage_gb: body.block_storage_gb ?? null,
        deployment_region: body.deployment_region ?? null,
        network_config: isCloudTarget
          ? (body.network_config ?? cloudVmNetworkConfig(store.vms.length % 150))
          : null,
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
    enrichEphemeralVmRecord(vm);
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

  router.post(rk(keys, "PORTTUNNEL_VNC_WITH_WS"), (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const tunnel = store.createVncTunnel({
      vm_uuid: typeof body.vm_uuid === "string" ? body.vm_uuid : undefined,
      server_host: typeof body.server_host === "string" ? body.server_host : undefined,
    });
    json(res, tunnel);
  });

  router.delete(rk(keys, "PORTTUNNEL_STOP_VNC_WITH_WS"), (req: Request, res: Response) => {
    const instanceId = (req.body?.instance_id as string) ?? "";
    store.removeVncTunnel(instanceId);
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

  router.use(createCatchAllRouter(base));

  return router;
}
