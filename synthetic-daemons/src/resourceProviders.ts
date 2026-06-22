/** Resolve and back-fill `provider` on synthetic IaaS / target records. */

const HOST_PROVIDER_BY_IP: Record<string, string> = {
  "192.168.1.10": "atomos",
  "10.0.0.5": "ovh",
  "192.168.1.20": "proxmox",
  "192.168.1.30": "esxi",
};

const KNOWN_PROVIDER_PREFIXES = new Set([
  "aws",
  "azure",
  "google",
  "ovh",
  "scaleway",
  "oracle",
  "upcloud",
  "wasabi",
  "impossiblecloud",
  "proxmox",
  "esxi",
  "vmware",
  "atomos",
]);


export function plainHostFromUrl(serverurl: string | null | undefined): string {
  if (!serverurl || typeof serverurl !== "string") {
    return "";
  }
  return serverurl.replace(/^https?:\/\//, "").split(":")[0];
}


export function providerFromServerUrl(serverurl: string | null | undefined): string | null {
  const host = plainHostFromUrl(serverurl);
  if (!host) {
    return null;
  }
  if (host.startsWith("cloud.")) {
    return host.slice("cloud.".length);
  }
  return HOST_PROVIDER_BY_IP[host] ?? null;
}


export function providerFromServerIp(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") {
    return null;
  }
  const plain = ip.replace(/^https?:\/\//, "").split(":")[0];
  return HOST_PROVIDER_BY_IP[plain] ?? null;
}


export function providerFromTargetType(
  targetType: string | null | undefined,
  serverurl?: string | null,
  explicitProvider?: string | null
): string | null {
  if (explicitProvider) {
    return explicitProvider;
  }
  if (targetType === "hypervisor_proxmox") {
    return "proxmox";
  }
  if (targetType === "hypervisor_esxi") {
    return "esxi";
  }
  if (targetType === "atomos_local_ip") {
    return providerFromServerUrl(serverurl) ?? "atomos";
  }
  if (targetType === "meson_public" || targetType === "meson_private") {
    return providerFromServerUrl(serverurl);
  }
  return providerFromServerUrl(serverurl);
}


export function inferProviderFromResourceName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  const prefix = name.toLowerCase().split("-")[0];
  return KNOWN_PROVIDER_PREFIXES.has(prefix) ? prefix : null;
}


export function enrichVmProvider(vm: Record<string, unknown>): void {
  if (vm.provider) {
    return;
  }

  const req = vm.req_json as Record<string, unknown> | undefined;
  const provider = providerFromTargetType(
    vm.target_type as string,
    vm.serverurl as string,
    req?.provider as string | undefined
  );

  if (provider) {
    vm.provider = provider;
    if (req && !req.provider) {
      req.provider = provider;
    }
  }
}


export function enrichVolumeProvider(volume: Record<string, unknown>): void {
  const server = (volume.server as string | undefined)
    ?? ((volume.servers as string[] | undefined)?.[0]);
  const plain = server?.replace(/^https?:\/\//, "").split(":")[0];

  if (!volume.target_type && plain) {
    if (plain === "192.168.1.30") {
      volume.target_type = "hypervisor_esxi";
    } else if (plain === "192.168.1.20") {
      volume.target_type = "hypervisor_proxmox";
    } else if (plain === "192.168.1.10" || plain === "10.0.0.5") {
      volume.target_type = "atomos_local_ip";
    }
  }

  if (volume.provider) {
    return;
  }

  const provider = providerFromServerIp(server)
    ?? providerFromTargetType(volume.target_type as string);

  if (provider) {
    volume.provider = provider;
  }
}


export function enrichNetworkProvider(network: Record<string, unknown>): void {
  if (network.provider) {
    return;
  }

  const server = (network.servers as string[] | undefined)?.[0];
  const provider = providerFromServerIp(server);

  if (provider) {
    network.provider = provider;
  }
}


export function enrichPortForwardProvider(portForward: Record<string, unknown>): void {
  if (portForward.provider) {
    return;
  }

  const provider = providerFromServerUrl(portForward.serverurl as string);
  if (provider) {
    portForward.provider = provider;
  }
}


export function enrichServiceProvider(service: Record<string, unknown>): void {
  if (service.provider) {
    return;
  }

  const candidates = [service.cluster_name, service.name, service.vm_name];
  for (const candidate of candidates) {
    const inferred = inferProviderFromResourceName(
      typeof candidate === "string" ? candidate : null
    );
    if (inferred) {
      service.provider = inferred;
      return;
    }
  }
}


export function enrichTargetProvider(target: Record<string, unknown>): void {
  const config = target.target_config as Record<string, unknown> | undefined;
  if (!config || config.provider) {
    return;
  }

  const targetType = target.target_type as string;
  if (targetType === "hypervisor_proxmox") {
    config.provider = "proxmox";
  } else if (targetType === "hypervisor_esxi") {
    config.provider = "esxi";
  } else if (targetType === "atomos_local_ip") {
    config.provider = "atomos";
  }
}


export function enrichAllResourceProviders(store: {
  vms: Record<string, unknown>[];
  volumes: Record<string, unknown>[];
  networks: Record<string, unknown>[];
  portForwards: Record<string, unknown>[];
  services: Record<string, unknown>[];
  targets: { data: Record<string, unknown>[] };
}): void {
  for (const vm of store.vms) {
    enrichVmProvider(vm);
  }
  for (const volume of store.volumes) {
    enrichVolumeProvider(volume);
  }
  for (const network of store.networks) {
    enrichNetworkProvider(network);
  }
  for (const portForward of store.portForwards) {
    enrichPortForwardProvider(portForward);
  }
  for (const service of store.services) {
    enrichServiceProvider(service);
  }
  for (const target of store.targets.data) {
    enrichTargetProvider(target);
  }
}
