import {app, BrowserWindow} from "electron";
import path from "path";


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
 * @return {Electron.CrossProcessExports.BrowserWindow}
 * @constructor
 */
export function WindowProvider(windowFilePath, options, dirname = null) {
    const win = new BrowserWindow(options);

    if (!app.isPackaged) {
        win.loadURL(getWindowUrl(windowFilePath, dirname));
    } else {
        win.loadFile(getWindowUrl(windowFilePath, dirname));
    }

    return win;
}
