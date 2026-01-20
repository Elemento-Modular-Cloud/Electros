import {BrowserWindow, ipcMain} from "electron";
import {WindowOptions} from "../common/WindowOptions.js";
import {TrayIcon} from "../common/TrayIcon.js";


export class Terminal {
    static _Window = null;
    static _Tray = null;

    static CreateWindow(PreloadedContent, platform, __dirname) {
        if (this._Window) {
            return;
        }

        Terminal._Window = new BrowserWindow({
            width: 800,
            height: 600,
            ...WindowOptions.Common,
            show: false,
            hiddenInMissionControl: (platform.isMac()) ? true : undefined,
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

        Terminal._Window.webContents.setVisualZoomLevelLimits(1, 1);

        Terminal._Window.loadFile("terminal/terminal.html");

        Terminal._Tray = new TrayIcon(platform, __dirname);

        Terminal._Window.on('close', (e) => {
            e.preventDefault();
            this._Window.hide();
        });

        ipcMain.on("minimize-window", () => {
            Terminal._Window.minimize();
        });

        ipcMain.on("hide-window", () => {
            Terminal._Window.hide();
        });
    }

    static ToggleVisibility(to = undefined) {
        if (Terminal._Window === null) { return; }

        let isVisible = to;
        if (to === undefined) {
            isVisible = Terminal._Window.isVisible();
        }

        if (isVisible) {
            Terminal._Window.hide();
        } else {
            Terminal._Window.show();
        }
    }

    static GetVisibility() {
        if (Terminal._Window === null) { return false; }

        return Terminal._Window.isVisible();
    }

    static DestroyWindow() {
        if (Terminal._Window === null) { return; }

        /** @type {BrowserWindow} */
        const x = Terminal._Window;

        Terminal._Window.close();

        setTimeout(() => {
            if (!Terminal._Window.isDestroyed()) {
                Terminal._Window.destroy();
            }
        }, 500);
    }
}
