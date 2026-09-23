import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CatalogRoute {
  daemon: string;
  method: string;
  path: string;
  methodPath: string;
  id: string;
  sourceFile: string;
}

export interface ProductionCatalog {
  generatedAt: string;
  monorepoPath: string;
  source: string;
  routeCount: number;
  routes: CatalogRoute[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "..", "catalog", "production-routes.json");

let cached: ProductionCatalog | null = null;

export function loadProductionCatalog(): ProductionCatalog {
  if (cached) {
    return cached;
  }
  cached = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as ProductionCatalog;
  return cached;
}

export function routesForDaemon(daemon: string): CatalogRoute[] {
  return loadProductionCatalog().routes.filter((r) => r.daemon === daemon);
}

/** Convert OpenAPI/Flask `{param}` / keep Express-compatible `:param`. */
export function toExpressPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

export function normalizeMethodPath(method: string, path: string): string {
  const normalized = path
    .replace(/\{([^}]+)\}/g, ":$1")
    .replace(/<([^>]+)>/g, ":$1");
  return `${method.toUpperCase()} ${normalized}`;
}
