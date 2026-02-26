import {BrowserWindow, ipcMain} from "electron";
import {WindowOptions} from "../common/WindowOptions.js";
import {TrayIcon} from "../common/TrayIcon.js";


export class Terminal {
    static _isQuitting = false;
    static _Window = null;
    static _Tray = null;
    static _Buffer = [];

    static CreateWindow(PreloadedContent, platform, __dirname) {
        if (this._Window) {
            return;
        }

        Terminal._Window = new BrowserWindow({
            width: 800,
            height: 600,
            ...WindowOptions.Common,
            show: false,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                zoomFactor: 1,
                backgroundThrottling: false,
                enableRemoteModule: false,
                experimentalFeatures: false,
                webSecurity: false
            },
            backgroundColor: "#000000",
            title: "Electros Daemons"
        });

        Terminal._Window.webContents.on('did-finish-load', () => {
            if (Terminal._Buffer.length > 0) {
                Terminal._Buffer.forEach(data => {
                    Terminal._Window.webContents.send("terminal-output", data);
                });
                Terminal._Buffer = [];
            }
        });

        Terminal._Window.webContents.setVisualZoomLevelLimits(1, 1);

        Terminal._Window.loadFile("terminal/terminal.html");

        Terminal._Tray = new TrayIcon(platform, __dirname);

        Terminal._Window.on('close', (e) => {
            if (!Terminal._isQuitting) {
                e.preventDefault();
                Terminal._Window.hide();
            }
        });

        ipcMain.on("minimize-window", () => {
            Terminal._Window.minimize();
        });

        ipcMain.on("hide-window", () => {
            Terminal._Window.hide();
        });
    }

    static Write(data) {
        if (Terminal._Window && !Terminal._Window.isDestroyed()) {
            Terminal._Window.webContents.send("terminal-output", data)
        } else {
            Terminal._Buffer.push(data);
        }
    }

    static ToggleVisibility(to = undefined) {
        if (Terminal._Window === null) { return; }

        if (to !== undefined) {
            if (to) {
                Terminal._Window.show();
            } else {
                Terminal._Window.hide();
            }
        } else {
            if (Terminal._Window.isVisible()) {
                Terminal._Window.hide();
            } else {
                Terminal._Window.show();
            }
        }
    }

    static GetVisibility() {
        if (Terminal._Window === null) { return false; }

        return Terminal._Window.isVisible();
    }

    static DestroyWindow() {
        if (Terminal._Window === null) { return; }

        Terminal._isQuitting = true;
        Terminal._Window.close();

        setTimeout(() => {
            if (Terminal._Window && !Terminal._Window.isDestroyed()) {
                Terminal._Window.destroy();
            }
        }, 500);
    }
}
