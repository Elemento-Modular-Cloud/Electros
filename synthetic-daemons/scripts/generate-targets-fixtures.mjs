/**
 * Regenerates portal-shaped target fixtures: org-targets, grants, scenarios, connections.
 *
 * Usage: node scripts/generate-targets-fixtures.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const DEMO_USER = "demo@synthetic.local";
const DEMO_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SCENARIO_LAB_ID = "44444444-4444-4444-8444-444444444444";
const SCENARIO_PUBLIC_ID = "55555555-5555-5555-8555-555555555555";
const SCENARIO_HYPERVISOR_ID = "66666666-6666-6666-8666-666666666666";
const SCENARIO_STORAGE_ID = "77777777-7777-7777-8777-777777777777";
const SCENARIO_EDGE_ID = "88888888-8888-8888-8888-888888888888";
const assignedAt = "2026-01-15T10:00:00.000Z";
const OBJECT_STORAGE_PROVIDERS = new Set(["wasabi", "impossiblecloud"]);

const catalog = JSON.parse(readFileSync(ECD_PROVIDERS, "utf8")).ELEMENTO_SUPPORTED_PROVIDERS;

/** @type {Record<string, unknown>[]} */
const orgTargets = [
  {
    target_id: "atomos-lab",
    target_name: "AtomOS Lab",
    target_type: "atomos_local_ip",
    target_config: { ips: ["192.168.1.10"] },
  },
  {
    target_id: "atomos-meson-edge",
    target_name: "AtomOS Meson Edge",
    target_type: "atomos_local_ip",
    target_config: { ips: ["10.0.0.5"] },
  },
  {
    target_id: "atomosphere-private-lab",
    target_name: "Atomosphere Private Lab",
    target_type: "meson_private",
    target_config: {
      provider: "ovh",
      meson_ip: "10.0.0.5",
      meson_credentials: { username: "demo", password: "synthetic" },
    },
  },
  {
    target_id: "proxmox-hv",
    target_name: "Proxmox Hypervisor",
    target_type: "hypervisor_proxmox",
    target_config: {
      host: "https://192.168.1.20:8006",
      user: "root@pam",
      password: "synthetic",
      verify_ssl: false,
    },
  },
  {
    target_id: "esxi-hv",
    target_name: "ESXi Hypervisor",
    target_type: "hypervisor_esxi",
    target_config: {
      host: "https://192.168.1.30",
      user: "root",
      password: "synthetic",
      verify_ssl: false,
    },
  },
];

for (const [providerKey, meta] of Object.entries(catalog)) {
  if (meta.status !== "production" && providerKey !== "aws") {
    continue;
  }
  const targetId = `${providerKey}-demo-public`;
  orgTargets.push({
    target_id: targetId,
    target_name: `${providerKey} public meson`,
    target_type: "meson_public",
    target_config: { provider: providerKey },
  });
}

const targetGrants = orgTargets.map((t) => ({
  target_id: t.target_id,
  member: DEMO_USER,
  assigned_at: assignedAt,
}));

const idsOf = (...types) => orgTargets
  .filter((t) => types.includes(t.target_type))
  .map((t) => t.target_id);

const publicMeson = orgTargets.filter((t) => t.target_type === "meson_public");
const publicComputeIds = publicMeson
  .filter((t) => !OBJECT_STORAGE_PROVIDERS.has(t.target_config.provider))
  .map((t) => t.target_id);
const objectStorageIds = publicMeson
  .filter((t) => OBJECT_STORAGE_PROVIDERS.has(t.target_config.provider))
  .map((t) => t.target_id);

const labPools = idsOf("atomos_local_ip", "meson_private", "hypervisor_proxmox", "hypervisor_esxi");

const scenarios = [
  {
    id: SCENARIO_LAB_ID,
    name: "Lab fleet",
    org_id: DEMO_ORG_ID,
    pools: labPools,
    users: [DEMO_USER],
    active: false,
  },
  {
    id: SCENARIO_PUBLIC_ID,
    name: "Public clouds",
    org_id: DEMO_ORG_ID,
    pools: publicComputeIds,
    users: [DEMO_USER],
    active: true,
  },
  {
    id: SCENARIO_HYPERVISOR_ID,
    name: "Hypervisors",
    org_id: DEMO_ORG_ID,
    pools: idsOf("hypervisor_proxmox", "hypervisor_esxi"),
    users: [DEMO_USER],
    active: false,
  },
  {
    id: SCENARIO_STORAGE_ID,
    name: "Object storage",
    org_id: DEMO_ORG_ID,
    pools: objectStorageIds,
    users: [DEMO_USER],
    active: false,
  },
  {
    id: SCENARIO_EDGE_ID,
    name: "Private edge",
    org_id: DEMO_ORG_ID,
    pools: idsOf("atomos_local_ip", "meson_private"),
    users: [DEMO_USER],
    active: false,
  },
];

// Lab + public compute mesons so PaaS/SaaS create host pickers list every cloud host.
const connections = {
  active_target_ids: [ ...new Set([ ...labPools, ...publicComputeIds ]) ],
  active_scenario_id: SCENARIO_PUBLIC_ID,
  max_connections: 32,
};

writeFileSync(join(FIXTURES_DIR, "org-targets.json"), `${JSON.stringify(orgTargets, null, 2)}\n`);
writeFileSync(join(FIXTURES_DIR, "target-grants.json"), `${JSON.stringify(targetGrants, null, 2)}\n`);
writeFileSync(join(FIXTURES_DIR, "scenarios.json"), `${JSON.stringify(scenarios, null, 2)}\n`);
writeFileSync(join(FIXTURES_DIR, "connections.json"), `${JSON.stringify(connections, null, 2)}\n`);

console.log(
  `Wrote ${orgTargets.length} org targets (`
  + `${orgTargets.filter((t) => t.target_type === "meson_public").length} meson_public), `
  + `${targetGrants.length} grants, ${scenarios.length} scenarios`
);
