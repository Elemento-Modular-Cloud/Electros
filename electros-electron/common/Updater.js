import {app} from "electron";
import path from "path";
import fs from "fs";
import {spawn, execFile, execFileSync} from "child_process";
import {promisify} from "util";
import {Readable} from "stream";
import {pipeline} from "stream/promises";


/**
 * @summary In-app updater: finds a newer release on GitHub and installs its asset.
 * Asset names follow `build.sh`: `Electros-<tag>-<os>-<arch>.<ext>`.
 */
export class Updater {
    static _API = "https://api.github.com/repos/Elemento-Modular-Cloud/Electros/releases";
    static _Pending = null;

    /**
     * `vX.Y.Z[-aN|-rc[N]][-beta]` → sortable key: alpha < rc < final.
     * Anything else (nightly, malformed) → null, so it's never offered.
     */
    static _Key(tag) {
        const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-(a|rc)(\d*))?(?:-beta)?$/.exec(tag);
        if (!m) { return null; }
        return [+m[1], +m[2], +m[3], {a: 0, rc: 1}[m[4]] ?? 2, +(m[5] || 0)];
    }

    static _Newer(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) { return a[i] > b[i]; }
        }
        return false;
    }

    static _Ext(platform) {
        if (platform.isMac()) { return "dmg"; }
        if (platform.isWin()) { return "exe"; }
        if (process.env.APPIMAGE) { return "AppImage"; }
        // ponytail: dpkg presence decides deb vs rpm, ask the package manager if distros with both show up
        return fs.existsSync("/usr/bin/dpkg") ? "deb" : "rpm";
    }

    static async _Get(url) {
        const res = await fetch(url, {headers: {"Accept": "application/vnd.github+json"}});
        if (!res.ok) { throw new Error(`GitHub ${res.status} on ${url}`); }
        return res.json();
    }

    /**
     * @param {Platform} platform
     * @param {string} current tag of the running build
     * @param {"release"|"beta"|"development"} channel
     * @return {Promise<string|null>} tag of the available update
     */
    static async Check(platform, current, channel) {
        // Renderer reloaded mid/after download: keep it, `Download` will return the same one
        if (Updater._Pending?.download) { return Updater._Pending.tag; }
        Updater._Pending = null;
        const currentKey = Updater._Key(current);
        if (channel === "development" || !currentKey) { return null; }

        // Stable = the release promoted by hand to "latest"; beta = any `-beta` release.
        const releases = channel === "beta"
            ? (await Updater._Get(`${Updater._API}?per_page=50`)).filter(r => !r.draft && r.tag_name.endsWith("-beta"))
            : [await Updater._Get(`${Updater._API}/latest`)];

        const ext = Updater._Ext(platform);
        let best = null;
        for (const r of releases) {
            const key = Updater._Key(r.tag_name);
            const asset = r.assets.find(a => a.name === `Electros-${r.tag_name}-${platform.os}-${platform.arch}.${ext}`);
            // No asset yet = CI still uploading, skip it
            if (!key || !asset || !Updater._Newer(key, best?.key ?? currentKey)) { continue; }
            best = {key, tag: r.tag_name, url: asset.browser_download_url, name: asset.name, ext};
        }

        Updater._Pending = best;
        return best?.tag ?? null;
    }

    /**
     * Downloads the update found by `Check`. The URL never comes from the renderer.
     * Calling it again while running returns the same download.
     *
     * @param {(percent: number) => void} onProgress called on every whole-percent change
     */
    static Download(onProgress) {
        const u = Updater._Pending;
        if (!u) { return Promise.reject(new Error("No pending update, call Check first")); }

        u.download ??= (async() => {
            const file = u.ext === "AppImage" ? `${process.env.APPIMAGE}.new` : path.join(app.getPath("temp"), u.name);
            const res = await fetch(u.url);
            if (!res.ok) { throw new Error(`Download failed: ${res.status}`); }

            const total = +res.headers.get("content-length") || 0;
            let received = 0, last = -1;
            const body = Readable.fromWeb(res.body);
            body.on("data", chunk => {
                received += chunk.length;
                const percent = total ? Math.floor(received * 100 / total) : 0;
                if (percent !== last) { onProgress(last = percent); }
            });
            await pipeline(body, fs.createWriteStream(file));
            u.file = file;
        })();
        // A failed download can be retried
        u.download.catch(() => { u.download = null; });
        return u.download;
    }

    /**
     * Installs the downloaded update; the app quits/relaunches on success.
     */
    static async Apply() {
        const u = Updater._Pending;
        if (!u?.file) { throw new Error("No downloaded update, call Download first"); }
        const file = u.file;

        switch (u.ext) {
        case "dmg": return Updater._InstallMac(file);
        case "exe":
            // electron-builder NSIS: silent update, relaunch when done. It waits for/kills the running app.
            spawn(file, ["--updated", "/S", "--force-run"], {detached: true, stdio: "ignore"}).unref();
            return app.quit();
        case "AppImage":
            fs.chmodSync(file, 0o755);
            fs.renameSync(file, process.env.APPIMAGE);
            app.relaunch({execPath: process.env.APPIMAGE});
            return app.quit();
        default:
            await promisify(execFile)("pkexec", u.ext === "deb" ? ["dpkg", "-i", file] : ["rpm", "-U", file]);
            app.relaunch();
            return app.quit();
        }
    }

    static _InstallMac(dmg) {
        const appPath = path.resolve(process.execPath, "../../..");
        // Throws when translocated or not writable (e.g. run from the DMG): the caller falls back to the site
        fs.accessSync(path.dirname(appPath), fs.constants.W_OK);

        const mnt = fs.mkdtempSync(path.join(app.getPath("temp"), "electros-update-"));
        execFileSync("hdiutil", ["attach", dmg, "-nobrowse", "-readonly", "-mountpoint", mnt]);
        const newApp = path.join(mnt, fs.readdirSync(mnt).find(f => f.endsWith(".app")));
        try {
            // Developer ID signed + notarized, otherwise refuse
            execFileSync("spctl", ["--assess", "--type", "execute", newApp]);
        } catch (e) {
            execFileSync("hdiutil", ["detach", mnt, "-quiet"]);
            throw e;
        }

        // After we exit: copy next to the old app, swap, detach, reopen. The old app is removed only once the copy succeeded.
        const script = `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.5; done
ditto "$2" "$1.new" && rm -rf "$1" && mv "$1.new" "$1"
hdiutil detach "$3" -quiet
open "$1"`;
        spawn("/bin/sh", ["-c", script, "sh", appPath, newApp, mnt], {detached: true, stdio: "ignore"}).unref();
        app.quit();
    }
}
