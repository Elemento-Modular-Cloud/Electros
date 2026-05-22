import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const ECD_DIR = join(REPO_ROOT, "elemento-gui-new/electros/ecd");
const FIXTURES_ROOT = join(__dirname, "../fixtures");

export interface RestKeysJson {
  [key: string]: string;
}

export interface NetworkingJson {
  MATCHER_CLIENT_REST_API_PORT: number;
  STORAGE_CLIENT_REST_API_PORT: number;
  NETWORK_CLIENT_REST_API_PORT: number;
  AUTH_CLIENT_REST_API_PORT: number;
  TARGET_CLIENT_REST_API_PORT: number;
  SERVICE_CLIENT_REST_API_PORT: number;
  MCP_SERVER_PORT: number;
}

export interface AppConfig {
  scenario: string;
  fixturesDir: string;
  restKeys: RestKeysJson;
  networking: NetworkingJson;
  persistState: boolean;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function parseCliArgs(argv: string[]): { scenario: string; persistState: boolean } {
  let scenario = "default";
  let persistState = false;

  for (const arg of argv) {
    if (arg.startsWith("--scenario=")) {
      scenario = arg.slice("--scenario=".length);
    } else if (arg === "--persist-state") {
      persistState = true;
    }
  }

  return { scenario, persistState };
}

export function loadConfig(argv: string[] = process.argv.slice(2)): AppConfig {
  const { scenario, persistState } = parseCliArgs(argv);
  const fixturesDir = join(FIXTURES_ROOT, scenario);

  return {
    scenario,
    fixturesDir,
    restKeys: readJson<RestKeysJson>(join(ECD_DIR, "restkeys.json")),
    networking: readJson<NetworkingJson>(join(ECD_DIR, "networking.json")),
    persistState,
  };
}

/** Resolve a restkeys.json entry (e.g. STATUS_API_KEY) to its path suffix. */
export function rk(keys: RestKeysJson, name: keyof RestKeysJson | string): string {
  const value = keys[name as string];
  if (!value) {
    throw new Error(`Missing rest key: ${String(name)}`);
  }
  return value;
}
