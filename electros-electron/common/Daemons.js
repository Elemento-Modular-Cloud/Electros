import {app} from "electron";
import path from "path";
import fs from "fs";
import {spawn} from "child_process";
import {Terminal} from "../Windows/Terminal.js";


export class DaemonsNotEnabledError extends Error {}


export class Daemons {
    static _Process = null;
    static _Ports = {};

    static stdoutBuffer = "";
    static stderrBuffer = "";
    static BUFFER_SIZE = 1024;
    static flushInterval = null;

    static DataUpdateCriticalHook = null;

    static Launch(platform, __dirname) {
        if (app.commandLine.hasSwitch("no-daemons")) {
            console.log("Daemons have been disabled by `--no-daemons`");
            throw new DaemonsNotEnabledError();
        }

        const execPath = Daemons._GetCommand(platform, __dirname);

        Daemons._Process = spawn(
            execPath, [], {
                env: { ...process.env, GUI_APP: '1' },
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
            }
        );

        Daemons._Process.stdout.on("data", (data) => {
            this.stdoutBuffer += data.toString();
            Terminal.Write(data);
        });

        Daemons._Process.stderr.on("data", (data) => {
            this.stderrBuffer += data.toString();
            Terminal.Write(data);
        });

        Daemons._Process.on("error", (data) => {
            if (Daemons.DataUpdateCriticalHook) { Daemons.DataUpdateCriticalHook(data); }
        });
    }

    static Terminate(platform = null) {
        let r = true;
        if (Daemons._Process !== null) {
            if (!Daemons._Process.killed) {
                r = Daemons._Process.kill();
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
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_windows_x86.exe`);
                if (!fs.existsSync(daemonsCmd)) {
                    daemonsCmd = path.join(daemonsPath, `elemento_daemons_windows_x64.exe`);
                }
            } else {
                daemonsCmd = path.join(daemonsPath, `elemento_daemons_windows_arm64.exe`);
            }
        }

        return daemonsCmd;
    }
}

