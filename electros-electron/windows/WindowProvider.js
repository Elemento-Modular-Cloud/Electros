import {app, BrowserWindow} from "electron";
import path from "path";

/** Chromium net error for "nothing is listening on that port". */
const ERR_CONNECTION_REFUSED = -102;
const DEV_SERVER_RETRY_MS = 300;


/**
 *
 * @param {string} relativeHtmlPath
 * @param {?string} dirname
 * @return {string}
 */
function getWindowUrl(relativeHtmlPath, dirname = null) {
    if (!app.isPackaged) {
        // During dev, point to the Vite server
        return `http://localhost:5173/${relativeHtmlPath}`;
    }
    // During prod, point to the bundled file in dist-renderer
    return path.join(dirname, 'dist-renderer', relativeHtmlPath);
}

/**
 *
 * @param {string} windowFilePath
 * @param {object} options
 * @param {?string} dirname
 * @param {?Record<string, string>} queryParams
 * @return {Electron.CrossProcessExports.BrowserWindow}
 * @constructor
 */
export function WindowProvider(windowFilePath, options, dirname = null, queryParams) {
    const win = new BrowserWindow(options);

    if (!app.isPackaged) {
        const url = getWindowUrl(windowFilePath, dirname);
        win.loadURL(url);

        // `npm start` launches Vite and Electron together, and Electron usually wins the race. Nothing is
        // listening on 5173 yet, the load fails, and the window stays blank forever. So: keep knocking.
        win.webContents.on('did-fail-load', (_event, errorCode, _description, _validatedURL, isMainFrame) => {
            if (!isMainFrame || errorCode !== ERR_CONNECTION_REFUSED) { return; }
            setTimeout(() => {
                if (!win.isDestroyed()) { win.loadURL(url); }
            }, DEV_SERVER_RETRY_MS);
        });
    } else {
        win.loadFile(getWindowUrl(windowFilePath, dirname), {
            query: queryParams ?? undefined,
        });
    }

    return win;
}
