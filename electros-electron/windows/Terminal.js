import {BrowserWindow, ipcMain} from "electron";
import {WindowOptions} from "../common/WindowOptions.js";

export class Terminal {
    static _Window = null;

    static CreateWindow(PreloadedContent, platform) {
        Terminal._Window = new BrowserWindow({
            width: 800,
            height: 600,
            ...WindowOptions.Common,
            show: true,
            hiddenInMissionControl: (platform.os === "mac") ? true : undefined,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                zoomFactor: 0.8,
                backgroundThrottling: false,
                enableRemoteModule: false,
                experimentalFeatures: false,
                webSecurity: false
            },
            backgroundColor: "#000000",
            title: "Electros Daemons"
        });

        Terminal._Window.loadFile("terminal/terminal.html");

        Terminal._Window.webContents.on("did-finish-load", () => {
            const popupTitlebarJS = PreloadedContent.Js.Titlebar.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = ${JSON.stringify(Terminal._Window.title)};`
            ) //.replace(
//            'initializeTitlebar(options = { minimizeOnly: false });',
//            'initializeTitlebar(options = { minimizeOnly: true });'
//        );

            Terminal._Window.webContents.executeJavaScript(popupTitlebarJS);
        });

        Terminal._Window.on('close', (e) => {

        });

        ipcMain.on("minimize-window", () => {
            Terminal._Window.minimize();
        });

        ipcMain.on("hide-window", () => {
            Terminal._Window.hide();
        });
    }
}
