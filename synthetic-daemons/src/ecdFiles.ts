import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEcdDir } from "./config.js";

const ECD_DIR = resolveEcdDir(dirname(fileURLToPath(import.meta.url)));

export function loadEcdJson(filename: string): unknown {
  const path = join(ECD_DIR, filename.endsWith(".json") ? filename : `${filename}.json`);
  if (!existsSync(path)) {
    throw new Error(`ECD file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

/** Shape returned by TargetDaemons.getFile("supported_providers"). */
export function loadSupportedProvidersMap(scenario?: string): Record<string, unknown> {
  const full = loadEcdJson("supported_providers.json") as {
    ELEMENTO_SUPPORTED_PROVIDERS: Record<string, unknown>;
  };
  const providers = full.ELEMENTO_SUPPORTED_PROVIDERS ?? {};
  if (scenario !== "demo") {
    return providers;
  }
  return withDemoScalewayDatabase(providers);
}

/**
 * The production catalog does not offer DBaaS on Scaleway, so the Database page
 * stays unavailable. The Paris demo needs that page for the managed PostgreSQL.
 */
function withDemoScalewayDatabase(providers: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(providers);
  const scaleway = clone.scaleway as { services?: Array<Record<string, unknown>> } | undefined;
  if (!scaleway?.services || scaleway.services.some((service) => service.sub_type === "dbaas")) {
    return clone;
  }

  scaleway.services.push({
    name: "dbaas",
    display_name: "Database as a Service",
    type: "service",
    sub_type: "dbaas",
    support_level: "full",
    regions: {
      "fr-par": {
        country: "France",
        location: "Paris",
        plus_code: "",
        certifications: [],
      },
    },
  });
  return clone;
}
