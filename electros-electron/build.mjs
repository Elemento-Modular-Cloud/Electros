#!/usr/bin/env node
import { execSync } from "child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";


process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = '1';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// Root of electros-electron (where this script lives)
const ELECTRON_ROOT   = resolve(__dirname);
// Root of elemento-gui-new (sibling folder)
const GUI_ROOT        = resolve(__dirname, "../elemento-gui-new");
// Where Vite drops its output
const DIST_SRC        = resolve(GUI_ROOT, "dist-renderer");
// Where Electron expects the renderer
const DIST_DEST       = resolve(ELECTRON_ROOT, "dist-renderer");
// Prebuilt synthetic-daemons copied into the app as extraResources
const SYNTHETIC_ROOT  = resolve(__dirname, "../synthetic-daemons");
const SYNTHETIC_BUNDLE = resolve(ELECTRON_ROOT, "synthetic-daemons-bundle");
const ECD_SRC         = resolve(GUI_ROOT, "electros/ecd");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`\n\x1b[36m▶\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function fail(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); }

function run(cmd, cwd = __dirname) {
    execSync(cmd, { cwd, stdio: "inherit" });
}

function cleanup() {
    log("Cleaning up staged build files…");
    let removed = false;
    for (const dir of [DIST_DEST, SYNTHETIC_BUNDLE]) {
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
            ok(`${dir} removed.`);
            removed = true;
        }
    }
    if (!removed) {
        ok("Nothing to clean up.");
    }
}

function stageSyntheticDaemons() {
    log("Staging synthetic-daemons bundle…");
    if (existsSync(SYNTHETIC_BUNDLE)) {
        rmSync(SYNTHETIC_BUNDLE, { recursive: true, force: true });
    }
    mkdirSync(SYNTHETIC_BUNDLE, { recursive: true });

    run("npm run build", SYNTHETIC_ROOT);

    for (const name of ["dist", "fixtures", "catalog"]) {
        const src = resolve(SYNTHETIC_ROOT, name);
        if (!existsSync(src)) {
            throw new Error(`synthetic-daemons ${name} not found at: ${src}`);
        }
        cpSync(src, resolve(SYNTHETIC_BUNDLE, name), { recursive: true });
    }
    cpSync(resolve(SYNTHETIC_ROOT, "package.json"), resolve(SYNTHETIC_BUNDLE, "package.json"));
    cpSync(resolve(SYNTHETIC_ROOT, "package-lock.json"), resolve(SYNTHETIC_BUNDLE, "package-lock.json"));

    const ecdDest = resolve(SYNTHETIC_BUNDLE, "ecd");
    mkdirSync(ecdDest, { recursive: true });
    if (!existsSync(ECD_SRC)) {
        throw new Error(`ECD configs not found at: ${ECD_SRC}`);
    }
    let ecdCount = 0;
    for (const name of readdirSync(ECD_SRC)) {
        if (!name.endsWith(".json")) {
            continue;
        }
        cpSync(resolve(ECD_SRC, name), resolve(ecdDest, name));
        ecdCount += 1;
    }
    if (ecdCount === 0) {
        throw new Error(`No ECD JSON files found in: ${ECD_SRC}`);
    }

    run("npm ci --omit=dev", SYNTHETIC_BUNDLE);
    ok("synthetic-daemons bundle staged.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
    // Register cleanup on unexpected exits too
    process.on("SIGINT",  () => { cleanup(); process.exit(1); });
    process.on("SIGTERM", () => { cleanup(); process.exit(1); });

    try {
        // 1. Vite build (use local binary explicitly to avoid module resolution issues with temp config)
        const viteBin = resolve(GUI_ROOT, "node_modules/.bin/vite");
        log("Building renderer with Vite…");
        run(`"${viteBin}" build`, GUI_ROOT);
        ok("Vite build complete.");

        // 2. Copy dist-renderer into electros-electron
        log(`Copying dist-renderer → ${DIST_DEST}`);
        if (!existsSync(DIST_SRC)) {
            throw new Error(`Vite output not found at: ${DIST_SRC}`);
        }
        cpSync(DIST_SRC, DIST_DEST, { recursive: true });
        ok("dist-renderer copied.");

        // 3. Stage synthetic-daemons for extraResources
        stageSyntheticDaemons();

        // 4. electron-builder (forward any extra args, e.g. --mac --config.mac.identity=null)
        const extraArgs = process.argv.slice(2).join(" ");
        const ebBin = resolve(ELECTRON_ROOT, "node_modules/.bin/electron-builder");
        log(`Running electron-builder${extraArgs ? ` with args: ${extraArgs}` : ""}…`);
        run(`"${ebBin}" ${extraArgs}`, ELECTRON_ROOT);
        ok("Electron build complete.");

    } catch (err) {
        fail(`Build failed: ${err.message}`);
        cleanup();
        process.exit(1);
    }

    // 5. Cleanup (happy path)
    cleanup();
    console.log("\n\x1b[32m● All done!\x1b[0m\n");
})();