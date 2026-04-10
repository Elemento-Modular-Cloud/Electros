#!/usr/bin/env node
import { execSync } from "child_process";
import { cpSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`\n\x1b[36m▶\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function fail(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); }

function run(cmd, cwd = __dirname) {
    execSync(cmd, { cwd, stdio: "inherit" });
}

function cleanup() {
    log("Cleaning up copied dist-renderer…");
    if (existsSync(DIST_DEST)) {
        rmSync(DIST_DEST, { recursive: true, force: true });
        ok("dist-renderer removed from electron folder.");
    } else {
        ok("Nothing to clean up.");
    }
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

        // 3. electron-builder (forward any extra args, e.g. --mac --config.mac.identity=null)
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

    // 4. Cleanup (happy path)
    cleanup();
    console.log("\n\x1b[32m● All done!\x1b[0m\n");
})();