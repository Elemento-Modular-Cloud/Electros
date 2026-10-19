import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Prefer `<packageRoot>/ecd` when a packaged bundle ships `restkeys.json` there.
 * `packageRoot` is the parent of `src/` or `dist/`.
 * Otherwise use the repo checkout at `../../elemento-gui-new/electros/ecd`.
 */
export function resolveEcdDir(moduleDir: string): string {
  const bundled = join(resolve(moduleDir, ".."), "ecd");
  if (existsSync(join(bundled, "restkeys.json"))) {
    return bundled;
  }
  return join(resolve(moduleDir, "../.."), "elemento-gui-new/electros/ecd");
}

const ECD_DIR = resolveEcdDir(__dirname);
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

export function scenarioFixturesDir(scenario: string): string {
  return join(FIXTURES_ROOT, scenario);
}

export interface PublishedFixtureOrg {
  scenario: string;
  dir: string;
  orgId: string;
  orgName: string;
}

/** One organisation per fixture directory, taken from that set's auth-status.json. */
export function listPublishedFixtureOrgs(): PublishedFixtureOrg[] {
  const names = readdirSync(FIXTURES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const orgs: PublishedFixtureOrg[] = [];
  for (const scenario of names) {
    const dir = scenarioFixturesDir(scenario);
    const authPath = join(dir, "auth-status.json");
    if (!existsSync(authPath)) {
      continue;
    }
    const auth = JSON.parse(readFileSync(authPath, "utf8")) as {
      org_id?: string;
      org_name?: string;
      org?: string;
    };
    if (!auth.org_id) {
      continue;
    }
    orgs.push({
      scenario,
      dir,
      orgId: auth.org_id,
      orgName: auth.org_name ?? auth.org ?? scenario,
    });
  }
  return orgs;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): AppConfig {
  const { scenario, persistState } = parseCliArgs(argv);
  const fixturesDir = scenarioFixturesDir(scenario);

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
