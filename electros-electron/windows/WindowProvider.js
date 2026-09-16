import {app, BrowserWindow} from "electron";
import path from "path";
import net from "node:net";


const VITE_HOST = "127.0.0.1";
const VITE_PORT = 5173;


function waitForVite(timeoutMs = 30000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = net.connect({ host: VITE_HOST, port: VITE_PORT }, () => {
                socket.end();
                resolve();
            });
            socket.on("error", () => {
                socket.destroy();
                if (Date.now() - started > timeoutMs) {
                    reject(new Error(`Vite did not start on http://${VITE_HOST}:${VITE_PORT}`));
                    return;
                }
                setTimeout(attempt, 150);
            });
        };
        attempt();
    });
}


/**
 *
 * @param {string} relativeHtmlPath
 * @param {?string} dirname
 * @return {string}
 */
function getWindowUrl(relativeHtmlPath, dirname = null) {
    if (!app.isPackaged) {
        // IPv4 explicitly: Vite's default `localhost` can bind only ::1, which Electron refuses.
        return `http://${VITE_HOST}:${VITE_PORT}/${relativeHtmlPath}`;
    }
    // During prod, point to the bundled file in dist-renderer
    return path.join(dirname, 'dist-renderer', relativeHtmlPath);
}

/**
 *
 * @param {string} windowFilePath
 * @param {object} options
 * @param {?string} dirname
 * @return {Electron.CrossProcessExports.BrowserWindow}
 * @constructor
 */
export function WindowProvider(windowFilePath, options, dirname = null) {
    const win = new BrowserWindow(options);

    if (!app.isPackaged) {
        const url = getWindowUrl(windowFilePath, dirname);
        waitForVite()
            .then(() => win.loadURL(url))
            .catch((err) => {
                console.error(err);
            });
    } else {
        win.loadFile(getWindowUrl(windowFilePath, dirname));
    }

    return win;
}
