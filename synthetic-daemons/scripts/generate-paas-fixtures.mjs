/**
 * Regenerates fixtures/default/services.json and billing-transactions.json
 * with ~18 synthetic instances per PaaS sub_type (ECD supported_intents).
 *
 * Usage: node scripts/generate-paas-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "default");
const PER_TYPE = 18;

const PROVIDERS = ["google", "ovh", "upcloud", "scaleway", "azure", "wasabi", "impossiblecloud"];
const REGIONS = [
  "fr-par",
  "gra7",
  "rbx",
  "europe-west1",
  "europe-west4",
  "nl-ams",
  "fi-hel2",
  "de-fra1",
  "pl-waw1",
  "us-east1",
  "eastus",
  "westeurope",
  "eu-central-1",
  "eu-central-2",
  "uk-lon1",
];

const KAAS_STATUSES = ["running", "running", "running", "stopped", "updating", "error", "provisioning"];
const KAAS_VERSIONS = ["1.32", "1.33", "1.34"];
const VM_STATUSES = ["running", "running", "stopped", "updating", "error", "provisioning"];
const DB_ENGINES = ["postgres", "mysql", "redis", "sqlserver"];
const BILLING_INTERVALS = ["day", "week", "month", "year"];
const BILLING_STATUSES = ["running", "running", "running", "to_delete", "suspended"];

function pad3(n) {
  return String(n).padStart(3, "0");
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function objectStorageEndpoint(provider, region) {
  switch (provider) {
    case "ovh":
      return `https://s3.${region}.io.cloud.ovh.net`;
    case "scaleway":
      return `https://s3.${region}.scw.cloud`;
    case "google":
      return `https://storage.googleapis.com/${region}-bucket`;
    case "azure":
      return `https://${region}.blob.core.windows.net`;
    case "wasabi":
      return `https://s3.${region}.wasabisys.com`;
    case "impossiblecloud":
      return `https://storage.${region}.impossiblecloud.io`;
    case "upcloud":
      return `https://object.${region}.upcloudobjects.com`;
    default:
      return `https://s3.${region}.synthetic.local`;
  }
}

/** @type {Record<string, unknown>[]} */
const services = [];
/** @type {Record<string, unknown>[]} */
const billing = [];

function addBilling(serviceType, index, billingUuid, price, intervalIdx) {
  const month = (index % 12) + 1;
  const day = (index % 27) + 1;
  billing.push({
    billing_uuid: billingUuid,
    client_uuid: "synthetic-client-001",
    organisation_name: pick(["demo", "acme", "staging-org", "qa-lab"], index),
    status: pick(BILLING_STATUSES, index),
    interval: pick(BILLING_INTERVALS, intervalIdx),
    start_timestamp: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`,
    end_timestamp: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`,
    price: Math.round((price + index * 3.17) * 100) / 100,
  });
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-kaas-${n}`;
  const region = pick(REGIONS, i);
  const provider = pick(PROVIDERS.filter((p) => ["google", "ovh", "upcloud", "scaleway"].includes(p)), i);
  services.push({
    service_type: "kaas",
    service_uuid: `kaas-synth-${n}`,
    billing_uuid: billingUuid,
    cluster_name: `${provider}-${region}-k8s-${n}`,
    status: pick(KAAS_STATUSES, i),
    version: pick(KAAS_VERSIONS, i + Math.floor(i / 3)),
    network_cidr: `10.${40 + (i % 200)}.${i % 256}.0/16`,
    location: region,
  });
  addBilling("kaas", i, billingUuid, 79 + (i % 5) * 25, i);
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-os-${n}`;
  const region = pick(REGIONS, i + 2);
  const provider = pick(
    ["ovh", "scaleway", "google", "azure", "wasabi", "impossiblecloud", "upcloud"],
    i
  );
  const sizeGb = [1, 5, 10, 50, 100, 250, 500, 1024, 2048, 4096][i % 10];
  services.push({
    service_type: "objectstorage",
    service_uuid: `os-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-bucket-${n}`,
    endpoint: objectStorageEndpoint(provider, region),
    region,
    active_storage: sizeGb * 1024 ** 3,
  });
  addBilling("objectstorage", i, billingUuid, 12 + (i % 8) * 11, i + 1);
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-dbaas-${n}`;
  const region = pick(REGIONS, i + 5);
  const engine = pick(DB_ENGINES, i);
  const nodes = String((i % 3) + 1);
  const diskGb = [10, 25, 50, 100, 200, 500][i % 6];
  services.push({
    service_type: "dbaas",
    service_uuid: `dbaas-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${engine}-${region}-${n}`,
    region,
    engine,
    backup_time: 1704067200 + i * 86400,
    disk_size: diskGb * 1024 ** 3,
    nodes_number: nodes,
  });
  addBilling("dbaas", i, billingUuid, 35 + (i % 6) * 18, i + 2);
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-n8n-${n}`;
  const region = pick(REGIONS, i + 7);
  const provider = pick(["google", "upcloud"], i);
  services.push({
    service_type: "n8n",
    service_uuid: `n8n-synth-${n}`,
    billing_uuid: billingUuid,
    vm_name: `n8n-${provider}-${region}-${n}`,
    status: pick(VM_STATUSES, i),
    region,
  });
  addBilling("n8n", i, billingUuid, 40 + (i % 4) * 12, i);
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-openclaw-${n}`;
  const region = pick(REGIONS, i + 11);
  const provider = pick(["google", "azure"], i);
  services.push({
    service_type: "openclaw",
    service_uuid: `openclaw-synth-${n}`,
    billing_uuid: billingUuid,
    vm_name: `claw-${provider}-${region}-${n}`,
    status: pick(VM_STATUSES, i + 2),
    region,
  });
  addBilling("openclaw", i, billingUuid, 28 + (i % 5) * 15, i + 3);
}

const servicesPath = join(FIXTURES_DIR, "services.json");
const billingPath = join(FIXTURES_DIR, "billing-transactions.json");

writeFileSync(servicesPath, `${JSON.stringify(services, null, 2)}\n`);
writeFileSync(billingPath, `${JSON.stringify(billing, null, 2)}\n`);

const counts = services.reduce((acc, s) => {
  const t = s.service_type;
  acc[t] = (acc[t] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${services.length} services to ${servicesPath}`);
console.log(`Wrote ${billing.length} billing rows to ${billingPath}`);
console.log("Per type:", counts);
