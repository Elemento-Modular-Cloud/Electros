#!/usr/bin/env node
/**
 * Scrape mounted production daemon routes from elemento-monorepo-client
 * and write catalog/production-routes.json.
 *
 * Usage:
 *   ELEMENTO_MONOREPO_CLIENT=/path/to/elemento-monorepo-client npm run sync:catalog
 *
 * Defaults to sibling ../elemento-monorepo-client relative to ElectrosGUI root.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PACKAGE_ROOT, "..");
const MONOREPO = resolve(
  process.env.ELEMENTO_MONOREPO_CLIENT
    ?? join(REPO_ROOT, "..", "elemento-monorepo-client")
);

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!existsSync(MONOREPO)) {
  die(`Monorepo not found at ${MONOREPO}. Set ELEMENTO_MONOREPO_CLIENT.`);
}

const restKeysPath = join(MONOREPO, "modules/common_definitions/restkeys.json");
if (!existsSync(restKeysPath)) {
  die(`restkeys.json missing at ${restKeysPath}`);
}
const restKeys = JSON.parse(readFileSync(restKeysPath, "utf8"));

function resolveRkExpr(expr) {
  let out = expr.trim();
  out = out.replace(/rk\.([A-Z0-9_]+)/g, (_, key) => {
    const val = restKeys[key];
    if (val === undefined) {
      throw new Error(`Unknown restkey ${key} in: ${expr}`);
    }
    return JSON.stringify(val);
  });
  // Evaluate string concatenations like "/api" + "/foo" + "/bar"
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${out});`)();
}

function joinPath(prefix, path) {
  const p = path === "" ? "" : path;
  if (!prefix) {
    return p.startsWith("/") ? p : `/${p}`;
  }
  if (!p || p === "/") {
    return prefix.endsWith("/") ? prefix.slice(0, -1) || "/" : prefix || "/";
  }
  const left = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const right = p.startsWith("/") ? p : `/${p}`;
  return `${left}${right}`;
}

function normalizeParamPath(path) {
  return path
    .replace(/<([^>]+)>/g, "{$1}")
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}

function routeId(daemon, method, path) {
  return `${daemon}:${method.toUpperCase()} ${normalizeParamPath(path)}`;
}

function read(path) {
  return readFileSync(path, "utf8");
}

function listPyFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "middev" || ent.name === "__pycache__") continue;
      out.push(...listPyFiles(full));
    } else if (ent.name.endsWith(".py")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Parse api_layer/router.py include_router calls → { moduleAlias, attr, prefixExpr }
 */
function parseIncludes(routerPy) {
  const text = read(routerPy);
  const includes = [];
  const re = /api_router\.include_router\(\s*([A-Za-z0-9_.]+)\s*,\s*prefix\s*=\s*([A-Za-z0-9_.]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    includes.push({ routerRef: m[1], prefixRef: m[2] });
  }
  return includes;
}

/**
 * Resolve import aliases in router.py to absolute module file paths.
 */
function resolveRouteModules(apiLayerDir, routerPy) {
  const text = read(routerPy);
  const aliasToFile = new Map();

  // from ...routes import ( local, auth, ... )
  const multi = /from\s+[.\w]+\.routes(?:\.(\w+))?\s+import\s*\(([^)]+)\)/gs;
  let m;
  while ((m = multi.exec(text)) !== null) {
    const subpkg = m[1]; // e.g. privileged
    const names = m[2].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
    for (const name of names) {
      const file = subpkg
        ? join(apiLayerDir, "routes", subpkg, `${name}.py`)
        : join(apiLayerDir, "routes", `${name}.py`);
      aliasToFile.set(name, file);
    }
  }

  // from ...routes.privileged import ( org_targets, ... )
  const fromPkg = /from\s+[.\w]+\.routes\.(\w+)\s+import\s*\(([^)]+)\)/gs;
  while ((m = fromPkg.exec(text)) !== null) {
    const subpkg = m[1];
    const names = m[2].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
    for (const name of names) {
      aliasToFile.set(name, join(apiLayerDir, "routes", subpkg, `${name}.py`));
    }
  }

  const flat = /from\s+[.\w]+\.routes\s+import\s+([A-Za-z0-9_,\s]+)/g;
  while ((m = flat.exec(text)) !== null) {
    if (m[1].includes("(")) continue;
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      aliasToFile.set(name, join(apiLayerDir, "routes", `${name}.py`));
    }
  }

  return aliasToFile;
}

function extractPrefixBindings(fileText) {
  const bindings = {};
  const re = /^(PREFIX|ROOT_PREFIX)(?:\s*:\s*[^=]+)?\s*=\s*(.+)$/gm;
  let m;
  while ((m = re.exec(fileText)) !== null) {
    let expr = m[2].trim();
    // strip trailing comments
    expr = expr.replace(/#.*$/, "").trim();
    bindings[m[1]] = resolveRkExpr(expr);
  }
  return bindings;
}

function extractFastApiRoutes(fileText) {
  const routes = [];
  // Match @router.get( ... path = "..." ...) spanning multiple lines
  const decoratorRe = /@router\.(get|post|put|patch|delete|head|options)\s*\(([\s\S]*?)\)\s*\n/gi;
  let m;
  while ((m = decoratorRe.exec(fileText)) !== null) {
    const method = m[1].toLowerCase();
    const args = m[2];
    let path = null;
    const named = args.match(/path\s*=\s*(['"])([\s\S]*?)\1/);
    if (named) {
      path = named[2];
    } else {
      const pos = args.match(/^\s*(['"])([\s\S]*?)\1/);
      if (pos) path = pos[2];
      else {
        // path = rk.SOME_KEY
        const rkPath = args.match(/path\s*=\s*(rk\.[A-Z0-9_]+)/);
        if (rkPath) path = resolveRkExpr(rkPath[1]);
      }
    }
    if (path == null) continue;
    // Skip if decorator is inside a comment block roughly — ignore lines that start with #
    const lineStart = fileText.lastIndexOf("\n", m.index) + 1;
    const line = fileText.slice(lineStart, m.index);
    if (line.trimStart().startsWith("#")) continue;
    routes.push({ method, path });
  }
  return routes;
}

function scrapeFastApiDaemon(daemon, apiLayerRel) {
  const apiLayerDir = join(MONOREPO, apiLayerRel);
  const routerPy = join(apiLayerDir, "router.py");
  if (!existsSync(routerPy)) {
    die(`Missing ${routerPy}`);
  }
  const includes = parseIncludes(routerPy);
  const aliasToFile = resolveRouteModules(apiLayerDir, routerPy);
  const routes = [];

  for (const inc of includes) {
    const [modAlias, attr] = (() => {
      const parts = inc.routerRef.split(".");
      return [parts[0], parts.slice(1).join(".") || "router"];
    })();
    const file = aliasToFile.get(modAlias);
    if (!file || !existsSync(file)) {
      console.warn(`[warn] unresolved include ${inc.routerRef}`);
      continue;
    }
    // Skip middev even if somehow included
    if (file.includes(`${join("routes", "middev")}`)) continue;

    const text = read(file);
    const prefixes = extractPrefixBindings(text);
    const prefixAttr = inc.prefixRef.split(".").pop(); // PREFIX or ROOT_PREFIX
    const prefix = prefixes[prefixAttr];
    if (prefix === undefined) {
      console.warn(`[warn] missing ${prefixAttr} in ${file}`);
      continue;
    }

    // Only extract routes for the router attr referenced (router vs root_router)
    // Both use @router. / @root_router. — check decorator name
    const decoratorName = attr === "root_router" ? "root_router" : "router";
    const decorated = extractFastApiRoutes(
      text.replace(new RegExp(`@${decoratorName}\\.`, "g"), "@router.")
        // If scraping root_router file that also has @router., filter by original
    );

    // For org.py: root_router and router share file; filter by which decorator was originally used
    let filtered = decorated;
    if (attr === "root_router") {
      const rootOnly = [];
      const rootRe = /@root_router\.(get|post|put|patch|delete|head|options)\s*\(([\s\S]*?)\)\s*\n/gi;
      let rm;
      while ((rm = rootRe.exec(text)) !== null) {
        const method = rm[1].toLowerCase();
        const args = rm[2];
        const named = args.match(/path\s*=\s*(['"])([\s\S]*?)\1/);
        if (named) rootOnly.push({ method, path: named[2] });
      }
      filtered = rootOnly;
    } else if (text.includes("@root_router.")) {
      // exclude root_router decorators already handled
      filtered = extractFastApiRoutes(
        text.replace(/@root_router\.(get|post|put|patch|delete|head|options)\s*\([\s\S]*?\)\s*\n/gi, "")
      );
    }

    for (const r of filtered) {
      const full = normalizeParamPath(joinPath(prefix, r.path));
      routes.push({
        daemon,
        method: r.method.toUpperCase(),
        path: full,
        methodPath: `${r.method.toUpperCase()} ${full}`,
        id: routeId(daemon, r.method, full),
        sourceFile: relative(MONOREPO, file).replace(/\\/g, "/"),
      });
    }
  }

  return routes;
}

function scrapeFlaskFile(daemon, relPath) {
  const file = join(MONOREPO, relPath);
  if (!existsSync(file)) {
    die(`Missing ${file}`);
  }
  const text = read(file);
  const routes = [];
  const re = /^([ \t]*)@(?:self\.)?(?:esc\.)?(?:restAPIApp|rest_api_app)\.route\(\s*([^)]+?)\)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const indent = m[1];
    // Skip commented decorators
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const fullLine = text.slice(lineStart, text.indexOf("\n", m.index));
    if (fullLine.trimStart().startsWith("#")) continue;

    const args = m[2];
    // First arg is path expression
    const pathMatch = args.match(/^([^,]+)/);
    if (!pathMatch) continue;
    let pathExpr = pathMatch[1].trim();
    const methodsMatch = args.match(/methods\s*=\s*\[([^\]]+)\]/i);
    let methods = ["GET"];
    if (methodsMatch) {
      methods = methodsMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, "").toUpperCase())
        .filter(Boolean);
    }

    let path;
    try {
      if (pathExpr.startsWith("'") || pathExpr.startsWith('"')) {
        path = Function(`"use strict"; return (${pathExpr});`)();
      } else {
        path = resolveRkExpr(pathExpr);
      }
    } catch (err) {
      console.warn(`[warn] could not resolve flask path ${pathExpr}: ${err.message}`);
      continue;
    }

    const full = normalizeParamPath(path);
    for (const method of methods) {
      routes.push({
        daemon,
        method,
        path: full,
        methodPath: `${method} ${full}`,
        id: routeId(daemon, method, full),
        sourceFile: relPath.replace(/\\/g, "/"),
      });
    }
  }
  return routes;
}

function scrapeMcp() {
  const file = join(MONOREPO, "client_daemons/mcp_client/src/electros_mcp/server.py");
  if (!existsSync(file)) {
    die(`Missing ${file}`);
  }
  const text = read(file);
  const routes = [];
  const re = /@mcp\.custom_route\(\s*["']([^"']+)["']\s*,\s*methods\s*=\s*\[([^\]]+)\]\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const path = normalizeParamPath(m[1]);
    const methods = m[2]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, "").toUpperCase())
      .filter((x) => x && x !== "OPTIONS");
    for (const method of methods) {
      routes.push({
        daemon: "mcp",
        method,
        path,
        methodPath: `${method} ${path}`,
        id: routeId("mcp", method, path),
        sourceFile: "client_daemons/mcp_client/src/electros_mcp/server.py",
      });
    }
  }
  return routes;
}

function dedupe(routes) {
  const seen = new Set();
  const out = [];
  for (const r of routes) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  out.sort((a, b) => a.daemon.localeCompare(b.daemon) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return out;
}

const all = [];

all.push(...scrapeFastApiDaemon("auth", "client_daemons/access_client/api_layer"));
all.push(...scrapeFastApiDaemon("target", "client_daemons/target_client/api_layer"));
all.push(...scrapeFlaskFile("compute", "client_daemons/matcher_client/matcherclient.py"));
all.push(...scrapeFlaskFile("storage", "client_daemons/storage_client/storageapi.py"));
all.push(...scrapeFlaskFile("network", "client_daemons/network_client/networkclient.py"));
all.push(...scrapeFlaskFile("services", "client_daemons/service_client/serviceclient.py"));
all.push(...scrapeMcp());

const routes = dedupe(all);

const catalog = {
  generatedAt: new Date().toISOString(),
  monorepoPath: MONOREPO,
  source: "elemento-monorepo-client mounted routers (FastAPI include_router + Flask @route + mcp custom_route)",
  routeCount: routes.length,
  routes,
};

const outDir = join(PACKAGE_ROOT, "catalog");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "production-routes.json");
writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);

const byDaemon = {};
for (const r of routes) {
  byDaemon[r.daemon] = (byDaemon[r.daemon] ?? 0) + 1;
}
console.log(`Wrote ${routes.length} routes → ${outPath}`);
console.log(byDaemon);
