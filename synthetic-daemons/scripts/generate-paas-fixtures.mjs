/**
 * Regenerates fixtures/default/services.json and billing-transactions.json
 * with a light set of synthetic instances per PaaS sub_type (ECD supported_intents).
 * Core types stay at 18; catalog pages that were empty (registry, publicip,
 * loadbalancer, privatenetwork, publicgateway, serverless, aiserverless,
 * queueaas, filestorage) get 4 each so lists are not empty. kops is skipped.
 *
 * Usage: node scripts/generate-paas-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "default");
const PER_TYPE = 18;
const DEV_PAAS_PER_TYPE = 4;

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
const SERVERLESS_RUNTIMES = [
  "python3.14",
  "python3.13",
  "python3.12",
  "nodejs24.x",
  "nodejs22.x",
  "nodejs20.x",
  "php8.5",
  "go1.26",
  "rust1.96",
];
const AI_MODELS = [
  "claude-sonnet-5",
  "claude-haiku-4.5",
  "nova-pro",
  "nova-lite",
  "llama-3.3-70b",
  "mistral-large-3",
  "glm-5.2",
  "deepseek-v4-flash-0731",
  "qwen3.5-397b-a17b",
  "gpt-oss-120b",
];
const KAFKA_VERSIONS = ["4.1.0", "4.0.0", "3.9.0", "3.8.0"];
const NODE_SIZES = ["S", "M", "L"];
const BILLING_INTERVALS = ["day", "week", "month", "year"];
const BILLING_STATUSES = ["running", "running", "running", "to_delete", "suspended"];
const PAAS_PROVIDERS = ["scaleway", "ovh", "google", "azure", "upcloud"];

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
    region,
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
  const n8nName = `n8n-${provider}-${region}-${n}`;
  const n8nStatus = pick(VM_STATUSES, i);
  services.push({
    service_type: "n8n",
    service_uuid: `n8n-synth-${n}`,
    billing_uuid: billingUuid,
    uniqueID: `n8n-synth-${n}`,
    vm_name: n8nName,
    status: n8nStatus,
    states: n8nStatus,
    region,
    req_json: { vm_name: n8nName },
  });
  addBilling("n8n", i, billingUuid, 40 + (i % 4) * 12, i);
}

for (let i = 0; i < PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-openclaw-${n}`;
  const region = pick(REGIONS, i + 11);
  const provider = pick(["google", "azure"], i);
  const clawName = `claw-${provider}-${region}-${n}`;
  const clawStatus = pick(VM_STATUSES, i + 2);
  services.push({
    service_type: "openclaw",
    service_uuid: `openclaw-synth-${n}`,
    billing_uuid: billingUuid,
    uniqueID: `openclaw-synth-${n}`,
    vm_name: clawName,
    status: clawStatus,
    states: clawStatus,
    region,
    req_json: { vm_name: clawName },
  });
  addBilling("openclaw", i, billingUuid, 28 + (i % 5) * 15, i + 3);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-registry-${n}`;
  const region = pick(REGIONS, i + 3);
  const provider = pick(PAAS_PROVIDERS, i);
  const registryName = `${provider}-${region}-registry-${n}`;
  const status = pick(VM_STATUSES, i + 1);
  services.push({
    service_type: "registry",
    service_uuid: `registry-synth-${n}`,
    billing_uuid: billingUuid,
    uniqueID: `registry-synth-${n}`,
    vm_name: registryName,
    name: registryName,
    status,
    states: status,
    region,
    size_gb: [10, 20, 50, 100, 200][i % 5],
    is_public: i % 3 === 0,
    req_json: { vm_name: registryName },
  });
  addBilling("registry", i, billingUuid, 16 + (i % 5) * 8, i + 1);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-publicip-${n}`;
  const region = pick(REGIONS, i + 4);
  const provider = pick(PAAS_PROVIDERS, i + 1);
  const ipType = i % 3 === 0 ? "v6" : "v4";
  const publicIp = ipType === "v6" ? `2001:db8:${n}::1` : `203.0.113.${(i % 250) + 1}`;
  services.push({
    service_type: "publicip",
    service_uuid: `pip-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-pip-${n}`,
    region,
    type: ipType,
    public_ip: publicIp,
    todo: publicIp,
    status: pick(VM_STATUSES, i + 2),
  });
  addBilling("publicip", i, billingUuid, 8 + (i % 4) * 3, i + 2);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-lb-${n}`;
  const region = pick(REGIONS, i + 6);
  const provider = pick(PAAS_PROVIDERS, i + 2);
  const isPublic = i % 2 === 0;
  const frontendPort = [80, 443, 8080][i % 3];
  services.push({
    service_type: "loadbalancer",
    service_uuid: `lb-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-lb-${n}`,
    region,
    is_public: isPublic,
    frontend_port: frontendPort,
    todo: `${isPublic ? "public" : "private"} :${frontendPort}`,
    status: pick(VM_STATUSES, i + 3),
  });
  addBilling("loadbalancer", i, billingUuid, 22 + (i % 5) * 9, i + 3);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-pn-${n}`;
  const region = pick(REGIONS, i + 8);
  const provider = pick(PAAS_PROVIDERS, i + 3);
  const cidr = `10.${80 + (i % 40)}.${i % 256}.0/22`;
  services.push({
    service_type: "privatenetwork",
    service_uuid: `pn-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-vpc-${n}`,
    region,
    cidr,
    dhcp: i % 4 !== 0,
    auto_assign_cidr: i % 5 !== 0,
    todo: cidr,
    status: pick(VM_STATUSES, i + 4),
  });
  addBilling("privatenetwork", i, billingUuid, 6 + (i % 3) * 4, i + 4);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-pgw-${n}`;
  const region = pick(REGIONS, i + 8);
  const provider = pick(PAAS_PROVIDERS, i + 3);
  const publicIp = `198.51.100.${(i % 250) + 1}`;
  services.push({
    service_type: "publicgateway",
    service_uuid: `pgw-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-gw-${n}`,
    region,
    network_uuid: `pn-synth-${n}`,
    public_ip: publicIp,
    status: pick(VM_STATUSES, i + 5),
  });
  addBilling("publicgateway", i, billingUuid, 14 + (i % 4) * 6, i + 5);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-fn-${n}`;
  const region = pick(REGIONS, i + 9);
  const provider = pick(PAAS_PROVIDERS, i);
  const runtime = pick(SERVERLESS_RUNTIMES, i);
  services.push({
    service_type: "serverless",
    service_uuid: `fn-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-fn-${n}`,
    region,
    runtime,
    handler: "index.handler",
    memory: [128, 256, 512, 1024, 2048][i % 5],
    timeout: [3, 10, 30, 60, 120][i % 5],
    is_public: i % 2 === 0,
    status: pick(VM_STATUSES, i),
  });
  addBilling("serverless", i, billingUuid, 5 + (i % 6) * 4, i + 6);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-aifn-${n}`;
  const region = pick(REGIONS, i + 10);
  const provider = pick(PAAS_PROVIDERS, i + 1);
  services.push({
    service_type: "aiserverless",
    service_uuid: `aifn-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-aifn-${n}`,
    region,
    model_name: pick(AI_MODELS, i),
    enable_streaming: i % 2 === 0,
    status: pick(VM_STATUSES, i + 1),
  });
  addBilling("aiserverless", i, billingUuid, 45 + (i % 5) * 20, i);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-kafka-${n}`;
  const region = pick(REGIONS, i + 12);
  const provider = pick(PAAS_PROVIDERS, i + 2);
  const created = new Date(Date.UTC(2025, i % 12, (i % 27) + 1));
  services.push({
    service_type: "queueaas",
    service_uuid: `kafka-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-kafka-${n}`,
    region,
    model_name: pick(KAFKA_VERSIONS, i),
    node_number: (i % 3) + 1,
    node_size: pick(NODE_SIZES, i),
    size_gb: [10, 25, 50, 100][i % 4],
    is_ha: i % 3 !== 0,
    is_public: i % 4 === 0,
    private_network_id: `pn-synth-${n}`,
    creation_date: created.toISOString().slice(0, 10),
    status: pick(KAAS_STATUSES, i + 2),
  });
  addBilling("queueaas", i, billingUuid, 55 + (i % 4) * 18, i + 1);
}

for (let i = 0; i < DEV_PAAS_PER_TYPE; i++) {
  const n = pad3(i + 1);
  const billingUuid = `billing-fs-${n}`;
  const region = pick(REGIONS, i + 13);
  const provider = pick(PAAS_PROVIDERS, i + 4);
  const sizeGb = [10, 20, 50, 100, 200][i % 5];
  const usedGb = Math.round(sizeGb * (0.12 + (i % 7) * 0.08));
  services.push({
    service_type: "filestorage",
    service_uuid: `fs-synth-${n}`,
    billing_uuid: billingUuid,
    name: `${provider}-${region}-fs-${n}`,
    dns_name: `fs-${n}.${region}.synthetic.local`,
    size_gb: sizeGb * 1024 ** 3,
    used_gb: usedGb * 1024 ** 3,
    is_public: i % 5 === 0,
    region,
    status: pick(VM_STATUSES, i + 2),
  });
  addBilling("filestorage", i, billingUuid, 11 + (i % 6) * 7, i + 2);
}

/** Marketplace SaaS apps (non-database) mirrored from elemento-marketplace. */
const MARKETPLACE_SAAS = [
  "caddy_ca",
  "hermes",
  "litellm",
  "llmstudio",
  "minio",
  "n8n_runner",
  "npm",
  "openwebui",
  "searxng",
];
const MARKETPLACE_SAAS_PER_TYPE = 6;

for (const serviceType of MARKETPLACE_SAAS) {
  for (let i = 0; i < MARKETPLACE_SAAS_PER_TYPE; i++) {
    const n = pad3(i + 1);
    const billingUuid = `billing-${serviceType}-${n}`;
    const region = pick(REGIONS, i + serviceType.length);
    const provider = pick(["google", "azure", "upcloud"], i);
    const vmName = `${serviceType}-${provider}-${region}-${n}`;
    const status = pick(VM_STATUSES, i + serviceType.length);
    services.push({
      service_type: serviceType,
      service_uuid: `${serviceType}-synth-${n}`,
      billing_uuid: billingUuid,
      uniqueID: `${serviceType}-synth-${n}`,
      vm_name: vmName,
      status,
      states: status,
      region,
      req_json: { vm_name: vmName },
    });
    addBilling(serviceType, i, billingUuid, 22 + (i % 5) * 9, i + 4);
  }
}

/** Simulated hosting — one SaaS type with platform = wordpress|prestashop|magento. */
const HOSTING_PLATFORMS = ["wordpress", "prestashop", "magento"];
const HOSTING_PER_PLATFORM = 8;

for (let i = 0; i < HOSTING_PER_PLATFORM * HOSTING_PLATFORMS.length; i++) {
  const n = pad3(i + 1);
  const platform = pick(HOSTING_PLATFORMS, i);
  const billingUuid = `billing-hosting-${n}`;
  const region = pick(REGIONS, i + 17);
  const provider = pick(["google", "azure", "upcloud"], i);
  const siteName = `${platform}-site-${provider}-${region}-${n}`;
  const status = pick(VM_STATUSES, i + 1);
  services.push({
    service_type: "hosting",
    service_uuid: `hosting-synth-${n}`,
    billing_uuid: billingUuid,
    uniqueID: `hosting-synth-${n}`,
    vm_name: siteName,
    platform,
    status,
    states: status,
    region,
    req_json: { vm_name: siteName, platform },
  });
  addBilling("hosting", i, billingUuid, 18 + (i % 6) * 7, i + 5);
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
