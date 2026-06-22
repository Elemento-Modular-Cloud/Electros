import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ECD_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../elemento-gui-new/electros/ecd");

export function loadEcdJson(filename: string): unknown {
  const path = join(ECD_DIR, filename.endsWith(".json") ? filename : `${filename}.json`);
  if (!existsSync(path)) {
    throw new Error(`ECD file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

/** Shape returned by TargetDaemons.getFile("supported_providers"). */
export function loadSupportedProvidersMap(): Record<string, unknown> {
  const full = loadEcdJson("supported_providers.json") as {
    ELEMENTO_SUPPORTED_PROVIDERS: Record<string, unknown>;
  };
  return full.ELEMENTO_SUPPORTED_PROVIDERS ?? {};
}
