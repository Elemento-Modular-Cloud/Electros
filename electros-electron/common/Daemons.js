import {app} from "electron";
import path from "path";
import fs from "fs";
import {spawn, execSync} from "child_process";
import {Terminal} from "../windows/Terminal.js";


export class DaemonsNotEnabledError extends Error {}


export class Daemons {
    static _Process = null;
    static _Ports = {};

    static _DaemonsLogArray = [];
    static BUFFER_SIZE = 2000;

    static DataUpdateCriticalHook = null;

    static Launch(platform, __dirname) {
        if (app.commandLine.hasSwitch("no-daemons")) {
            console.log("Daemons have been disabled by `--no-daemons`");
            Terminal.Write("[INFO] Elemento Client Daemons have been disabled by `--no-daemons`.");
            throw new DaemonsNotEnabledError();
        }

        if (!app.isPackaged) {
            Terminal.Write("[WARNING] Electros is not packaged. Daemons might have to be manually started.")
            console.warn("Electros is not packaged. Daemons might have to be manually started.")
        }

        const execPath = Daemons._GetCommand(platform, __dirname);
        console.trace(execPath);

        Daemons._Process = spawn(
            execPath, [], {
                env: { ...process.env, GUI_APP: '1' },
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
            }
        );

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
            if (Daemons.DataUpdateCriticalHook) { Daemons.DataUpdateCriticalHook(data); }
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
                    }
                } else {
                    r = Daemons._Process.kill();
                }
            }
            Daemons._Process = null;
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
            daemonsCmd = path.join(daemonsPath, "elemento_client_daemons.app/Contents/MacOS/elemento_client_daemons");
        } else if (platform.isLinux()) {
            if (platform.arch === 'arm64') {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_linux_arm`);
            } else {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_linux_x86`);
            }
        } else if (platform.isWin()) {
            if (platform.arch === 'x64' || platform.arch === 'x86') {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_win_x86.exe`);
                if (!fs.existsSync(daemonsCmd)) {
                    daemonsCmd = path.join(daemonsPath, `elemento_daemons_win_x64.exe`);
                }
            } else {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_win_arm64.exe`);
            }
        }

        return daemonsCmd;
    }
}

