/**
 * Regenerates fixtures/default/targets.json with AtomOS, hypervisors, and
 * meson_public targets for every production provider in ECD.
 *
 * Usage: node scripts/generate-targets-fixtures.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "default");
const ECD_PROVIDERS = join(
  __dirname,
  "..",
  "..",
  "elemento-gui-new",
  "electros",
  "ecd",
  "supported_providers.json"
);

const catalog = JSON.parse(readFileSync(ECD_PROVIDERS, "utf8")).ELEMENTO_SUPPORTED_PROVIDERS;

/** @type {Record<string, unknown>[]} */
const data = [
  {
    target_id: "atomos-lab",
    target_type: "atomos_local_ip",
    target_config: { ips: ["192.168.1.10"] },
    ping_status: {
      target_id: "atomos-lab",
      target_type: "atomos_local_ip",
      pingable: true,
      trust_established: true,
    },
  },
  {
    target_id: "atomos-meson-edge",
    target_type: "atomos_local_ip",
    target_config: { ips: ["10.0.0.5"] },
    ping_status: {
      target_id: "atomos-meson-edge",
      target_type: "atomos_local_ip",
      pingable: true,
      trust_established: true,
    },
  },
  {
    target_id: "atomosphere-private-lab",
    target_type: "meson_private",
    target_config: {
      provider: "ovh",
      meson_ip: "10.0.0.5",
      meson_credentials: { username: "demo", password: "synthetic" },
    },
    ping_status: {
      target_id: "atomosphere-private-lab",
      target_type: "meson_private",
      pingable: true,
      trust_established: true,
    },
  },
  {
    target_id: "proxmox-hv",
    target_type: "hypervisor_proxmox",
    target_config: {
      host: "https://192.168.1.20:8006",
      user: "root@pam",
      password: "synthetic",
      verify_ssl: false,
    },
    ping_status: {
      target_id: "proxmox-hv",
      target_type: "hypervisor_proxmox",
      pingable: true,
    },
  },
  {
    target_id: "esxi-hv",
    target_type: "hypervisor_esxi",
    target_config: {
      host: "https://192.168.1.30",
      user: "root",
      password: "synthetic",
      verify_ssl: false,
    },
    ping_status: {
      target_id: "esxi-hv",
      target_type: "hypervisor_esxi",
      pingable: true,
    },
  },
];

for (const [providerKey, meta] of Object.entries(catalog)) {
  if (meta.status !== "production") {
    continue;
  }
  const targetId = `${providerKey}-demo-public`;
  data.push({
    target_id: targetId,
    target_type: "meson_public",
    target_config: { provider: providerKey },
    ping_status: {
      target_id: targetId,
      target_type: "meson_public",
      pingable: true,
    },
  });
}

const outPath = join(FIXTURES_DIR, "targets.json");
writeFileSync(outPath, `${JSON.stringify({ data }, null, 2)}\n`);
console.log(`Wrote ${data.length} targets (${data.filter((t) => t.target_type === "meson_public").length} meson_public)`);
