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

        Terminal._Window.webContents.on("did-finish-load", () => {
            const popupTitlebarJS = PreloadedContent.Js.Titlebar.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = ${JSON.stringify(Terminal._Window.title)};`
            ) //.replace(
//            'initializeTitlebar(options = { minimizeOnly: false });',
//            'initializeTitlebar(options = { minimizeOnly: true });'
//        );

            // Terminal._Window.webContents.executeJavaScript(popupTitlebarJS);
        });

        Terminal._Tray = new TrayIcon(Terminal._Window, platform, __dirname);

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
            Terminal._Window.show();
        } else {
            Terminal._Window.hide();
        }
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
