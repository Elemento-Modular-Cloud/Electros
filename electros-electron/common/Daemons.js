import {app} from "electron";
import path from "path";
import fs from "fs";
import {spawn, execSync} from "child_process";
import {Terminal} from "../windows/Terminal.js";


export class DaemonsNotEnabledError extends Error {
}


export class Daemons {
    static _Process = null;
    static _Ports = {};
    static _IsSynthetic = false;
    static _ElectronDir = null;
    static _Platform = null;
    static _SwitchSettleMs = 750;

    static _DaemonsLogArray = [];
    static BUFFER_SIZE = 2000;

    static DataUpdateCriticalHook = null;

    /**
     * @param {object} platform
     * @param {string} __dirname
     * @param {{ synthetic?: boolean }} [options]
     */
    static Launch(platform, __dirname, options = {}) {
        Daemons._ElectronDir = __dirname;
        Daemons._Platform = platform;

        if (app.commandLine.hasSwitch("no-daemons") && !options.synthetic) {
            console.log("Daemons have been disabled by `--no-daemons`");
            Terminal.Write("[INFO] Elemento Client Daemons have been disabled by `--no-daemons`.");
            throw new DaemonsNotEnabledError();
        }

        const useSynthetic = options.synthetic === true
            || app.commandLine.hasSwitch("synthetic-daemons");

        if (useSynthetic) {
            Daemons._LaunchSynthetic(__dirname);
            return;
        }

        Daemons._LaunchNative(platform, __dirname);
    }

    /**
     * Switch to synthetic-daemons via `npm start` (Developer menu).
     * Terminates any existing daemon process first.
     * @param {string} [electronDir]
     */
    static async LaunchSynthetic(electronDir) {
        const dir = electronDir || Daemons._ElectronDir;
        if (!dir) {
            throw new Error("LaunchSynthetic requires electronDir (call Daemons.Launch first, or pass __dirname)");
        }
        await Daemons._SwitchTo(() => Daemons._LaunchSynthetic(dir));
    }

    /**
     * Switch to native client daemons (Developer menu).
     * Terminates any existing daemon process first; ignores --no-daemons / --synthetic-daemons.
     * @param {object} [platform]
     * @param {string} [electronDir]
     */
    static async LaunchNative(platform, electronDir) {
        const dir = electronDir || Daemons._ElectronDir;
        const plat = platform || Daemons._Platform;
        if (!dir || !plat) {
            throw new Error("LaunchNative requires platform and electronDir (call Daemons.Launch first)");
        }
        await Daemons._SwitchTo(() => Daemons._LaunchNative(plat, dir));
    }

    static IsSynthetic() {
        return Daemons._IsSynthetic;
    }

    static IsRunning() {
        return Daemons._Process !== null && !Daemons._Process.killed;
    }

    static async _SwitchTo(launchFn) {
        Daemons.Terminate();
        // Allow ports to be released before binding the other daemon set
        await new Promise((resolve) => setTimeout(resolve, Daemons._SwitchSettleMs));
        launchFn();
    }

    static _LaunchNative(platform, __dirname) {
        if (!app.isPackaged) {
            Terminal.Write("[WARN] Electros is not packaged. Daemons might have to be manually started.");
            console.warn("Electros is not packaged. Daemons might have to be manually started.");
        }

        const execPath = Daemons._GetCommand(platform, __dirname);
        if (!execPath) {
            const msg = "[ERROR] Native daemon binary not found for this platform.";
            console.error(msg);
            Terminal.Write(msg);
            throw new Error(msg);
        }

        Terminal.Write(`[INFO] Starting native client daemons (${execPath})`);
        console.log("Launching native daemons from", execPath);
        console.trace(execPath);

        Daemons._ElectronDir = __dirname;
        Daemons._Platform = platform;
        Daemons._IsSynthetic = false;
        Daemons._SpawnProcess(execPath, [], {
            env: {...process.env, GUI_APP: '1'},
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });
    }

    static _LaunchSynthetic(__dirname) {
        if (app.isPackaged) {
            const msg = "[ERROR] Synthetic daemons are only available in unpackaged (dev) builds.";
            console.error(msg);
            Terminal.Write(msg);
            throw new Error("Synthetic daemons unavailable in packaged builds");
        }

        const syntheticRoot = Daemons._GetSyntheticPath(__dirname);
        const packageJson = path.join(syntheticRoot, 'package.json');
        if (!fs.existsSync(packageJson)) {
            const msg = `[ERROR] synthetic-daemons not found at ${syntheticRoot}`;
            console.error(msg);
            Terminal.Write(msg);
            throw new Error(msg);
        }

        Terminal.Write(`[INFO] Starting synthetic-daemons via npm start (${syntheticRoot})`);
        console.log("Launching synthetic-daemons from", syntheticRoot);

        const isWin = process.platform === 'win32';
        const npmCmd = isWin ? 'npm.cmd' : 'npm';

        Daemons._ElectronDir = __dirname;
        Daemons._IsSynthetic = true;
        Daemons._SpawnProcess(npmCmd, ['start'], {
            cwd: syntheticRoot,
            env: {...process.env, GUI_APP: '1'},
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: isWin,
            // New process group on Unix so Terminate can kill npm + node children
            detached: !isWin,
        });
    }

    static _GetSyntheticPath(electronDir) {
        return path.join(electronDir, '..', 'synthetic-daemons');
    }

    static _SpawnProcess(command, args, spawnOptions) {
        Daemons._Process = spawn(command, args, spawnOptions);

        Daemons._Process.stdout.on("data", (data) => {
            this._DaemonsLogArray.push(data);
            Terminal.Write(data);
        });

        Daemons._Process.stderr.on("data", (data) => {
            this._DaemonsLogArray.push(data);
            Terminal.Write(data);
        });

        while (this._DaemonsLogArray.length > this.BUFFER_SIZE) {
            this._DaemonsLogArray.shift();
        }

        Daemons._Process.on("error", (data) => {
            if (Daemons.DataUpdateCriticalHook) {
                Daemons.DataUpdateCriticalHook(data);
            }
        });
    }

    static GetDaemonsLogBuffer() {
        return this._DaemonsLogArray;
    }

    static Terminate() {
        let r = true;
        if (Daemons._Process !== null) {
            if (!Daemons._Process.killed) {
                if (process.platform === 'win32') {
                    try {
                        execSync(`taskkill /pid ${Daemons._Process.pid} /T /F`);
                    } catch (e) {
                        console.error("Failed to kill process with taskkill:", e);
                        r = false;
                    }
                } else if (Daemons._IsSynthetic && Daemons._Process.pid) {
                    // Kill the whole process group (npm + node dist/index.js)
                    try {
                        process.kill(-Daemons._Process.pid, 'SIGTERM');
                    } catch (e) {
                        console.error("Failed to kill synthetic-daemons process group:", e);
                        r = Daemons._Process.kill();
                    }
                } else {
                    r = Daemons._Process.kill();
                }
            }
            Daemons._Process = null;
            Daemons._IsSynthetic = false;
        }

        return r;
    }

    static _GetPath(platform, __dirname) {
        const baseDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
        return path.join(baseDir, 'electros-daemons', platform.os, platform.arch);
    }

    static _GetCommand(platform, __dirname) {
        const daemonsPath = Daemons._GetPath(platform, __dirname);
        let daemonsCmd = '';

        if (platform.isMac()) {
            const possibleNames = [
              "elemento_client_daemons.app/Contents/MacOS/elemento_client_daemons",
              "elemento_client_daemons.app/Contents/MacOS/daemon_launcher"
            ];

            let actualName = "";

            for (const name of possibleNames) {
                const attemptedName = path.join(daemonsPath, name);
                if (fs.existsSync(attemptedName)) {
                    actualName = attemptedName;
                    break;
                }
            }

            daemonsCmd = actualName;
        } else if (platform.isLinux()) {
            if (platform.arch === 'arm64') {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_linux_arm`);
            } else {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_linux_x86`);
            }
        } else if (platform.isWin()) {
            if (platform.arch === 'x64' || platform.arch === 'x86') {
                const possibleNames = [
                    "elemento_daemons_win_x86.exe",
                    "elemento_daemons_win_x64.exe",
                    "elemento_daemons_windows_x86.exe",
                    "elemento_daemons_windows_x64.exe"
                ];

                for (const possibleName of possibleNames) {
                    const attemptedName = path.join(daemonsPath, possibleName);
                    if (fs.existsSync(attemptedName)) {
                        daemonsCmd = attemptedName;
                    }
                }
            } else {
                const possibleNames = [
                    "elemento_daemons_win_arm64.exe",
                    "elemento_daemons_win_aarch64.exe",
                    "elemento_daemons_windows_arm64.exe",
                    "elemento_daemons_windows_aarch64.exe"
                ];

                for (const possibleName of possibleNames) {
                    const attemptedName = path.join(daemonsPath, possibleName);
                    if (fs.existsSync(attemptedName)) {
                        daemonsCmd = attemptedName;
                    }
                }
            }
        }

        return daemonsCmd;
    }
}
