/** Default flavour + network details for synthetic ephemeral (meson) VMs. */
import { providerFromServerUrl } from "./resourceProviders.js";
export const EPHEMERAL_VM_REGIONS = [
  "fr-par",
  "gra7",
  "rbx",
  "europe-west1",
  "europe-west4",
  "nl-ams",
] as const;

export const EPHEMERAL_VM_FLAVOURS = [
  { catalog: "aws", name: "t3.medium", block: 30 },
  { catalog: "aws", name: "t3.large", block: 50 },
  { catalog: "azure", name: "D2s_v5", block: 30 },
  { catalog: "google", name: "e2-medium", block: 30 },
  { catalog: "scaleway", name: "GP1-S", block: 40 },
  { catalog: "ovh", name: "b2-15", block: 50 },
] as const;

export function cloudVmNetworkConfig(index: number): Record<string, unknown> {
  const hostOctet = 100 + index;
  return {
    interface: "eth0",
    ipv4: `10.64.1.${hostOctet}`,
    mac: `52:54:00:b0:00:${String(index + 1).padStart(2, "0")}`,
    model: "virtio",
    name: "default",
    source: "default",
    type: "bridge",
    is_reachable_from_host: true,
  };
}

/** Ensure meson VMs expose flavour, block storage, and IP in `req_json`. */
export function enrichEphemeralVmRecord(vm: Record<string, unknown>): void {
  const targetType = vm.target_type as string | undefined;
  if (targetType !== "meson_public" && targetType !== "meson_private") {
    return;
  }

  const req = vm.req_json as Record<string, unknown> | undefined;
  if (!req || typeof req !== "object") {
    return;
  }

  const vmName = req.vm_name as string | undefined;
  const match = vmName?.match(/^ephemeral-.+-(\d+)$/);
  const flavourIndex = match ? parseInt(match[1], 10) - 1 : -1;
  const flavour = flavourIndex >= 0 ? EPHEMERAL_VM_FLAVOURS[flavourIndex] : undefined;

  if (flavour) {
    if (req.instance_flavour_catalog == null) {
      req.instance_flavour_catalog = flavour.catalog;
    }
    if (req.instance_flavour == null) {
      req.instance_flavour = flavour.name;
    }
    if (req.block_storage_gb == null) {
      req.block_storage_gb = flavour.block;
    }
    if (req.deployment_region == null) {
      req.deployment_region = EPHEMERAL_VM_REGIONS[flavourIndex % EPHEMERAL_VM_REGIONS.length];
    }
  }

  if (req.network_config == null && flavourIndex >= 0) {
    req.network_config = cloudVmNetworkConfig(flavourIndex);
  }

  if (req.provider == null) {
    req.provider = providerFromServerUrl(vm.serverurl as string);
  }
  if (vm.provider == null && req.provider) {
    vm.provider = req.provider;
  }
}
