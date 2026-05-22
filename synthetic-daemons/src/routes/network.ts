import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { rk } from "../config.js";
import type { MemoryStore, NetworkRecord, PortForwardRecord } from "../MemoryStore.js";
import { json, ok } from "../createServer.js";
import { createCatchAllRouter } from "../catchAll.js";

function normalizeNetworkBody(body: Record<string, unknown>): NetworkRecord {
  const networkName = (body.network_name as string) ?? (body.name as string) ?? `net-${randomUUID().slice(0, 8)}`;

  return {
    servers: Array.isArray(body.servers) ? body.servers : ["192.168.1.10"],
    network_name: networkName,
    type: (body.type as string) ?? "libvirt",
    mode: body.mode === undefined ? "bridge" : (body.mode as string | null),
    private: Boolean(body.private),
    network_uid: (body.network_uid as string) ?? randomUUID(),
    creator_uid: (body.creator_uid as string) ?? "synthetic",
    device_name: (body.device_name as string) ?? "",
    libvirt_network: (body.libvirt_network as string) ?? networkName,
    ...(body.ip !== undefined ? { ip: body.ip } : {}),
    ...(body.routes !== undefined ? { routes: body.routes } : {}),
    ...(body.headscale !== undefined ? { headscale: body.headscale } : {}),
  };
}

function normalizePortForwardBody(body: Record<string, unknown>): PortForwardRecord {
  return {
    serverurl: (body.serverurl as string) ?? "192.168.1.10",
    protocol: (body.protocol as string) ?? "tcp",
    port: Number(body.port ?? 0),
    target: (body.target as string) ?? "",
    target_vm_uid: (body.target_vm_uid as string) ?? "",
    target_port: Number(body.target_port ?? 0),
    tailscale: Boolean(body.tailscale),
    force: Boolean(body.force),
    forward_uid: (body.forward_uid as string) ?? randomUUID(),
  };
}

export function networkRouter(store: MemoryStore, config: AppConfig): Router {
  const router = Router();
  const keys = config.restKeys;
  const base = rk(keys, "NETWORK_CLIENT_API_URL_KEY");

  router.get(rk(keys, "LIST_NETWORKS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.networks);
  });

  router.get(rk(keys, "INFO_NETWORK_API_KEY"), (req: Request, res: Response) => {
    const uid = String(req.query.network_uid ?? req.query.uid ?? "");
    const net = store.findNetwork(uid);
    if (!net) {
      json(res, {}, 404);
      return;
    }
    json(res, net);
  });

  router.post(rk(keys, "CREATE_NETWORK_API_KEY"), (req: Request, res: Response) => {
    const net = normalizeNetworkBody((req.body ?? {}) as Record<string, unknown>);
    store.addNetwork(net);
    json(res, net);
  });

  router.delete(rk(keys, "DELETE_NETWORK_API_KEY"), (req: Request, res: Response) => {
    const uid = (req.body?.network_uid as string) ?? "";
    store.removeNetwork(uid);
    ok(res);
  });

  router.post(rk(keys, "START_EXPORT_NETWORK_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.post(rk(keys, "STOP_EXPORT_NETWORK_API_KEY"), (_req: Request, res: Response) => {
    ok(res);
  });

  router.get(rk(keys, "LIST_FORWARDED_PORTS_API_KEY"), (_req: Request, res: Response) => {
    json(res, store.portForwards);
  });

  router.post(rk(keys, "FORWARD_PORT_API_KEY"), (req: Request, res: Response) => {
    const pf = normalizePortForwardBody((req.body ?? {}) as Record<string, unknown>);
    store.addPortForward(pf);
    json(res, pf);
  });

  router.delete(rk(keys, "UNFORWARD_PORT_API_KEY"), (req: Request, res: Response) => {
    const uid = (req.body?.forward_uid as string) ?? (req.query.forward_uid as string) ?? "";
    store.removePortForward(uid);
    ok(res);
  });

  router.use(createCatchAllRouter(base));

  return router;
}
