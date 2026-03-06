import {app, BrowserWindow} from "electron";
import path from "path";

function getWindowUrl(relativeHtmlPath) {
    if (!app.isPackaged) {
        // During dev, point to the Vite server
        return `http://localhost:5173/${relativeHtmlPath}`;
    }
    // During prod, point to the bundled file in dist-renderer
    return path.join(__dirname, 'dist-renderer', relativeHtmlPath);
}

export function WindowProvider(windowFilePath, options) {
    const win = new BrowserWindow(options);

    if (!app.isPackaged) {
        win.loadURL(getWindowUrl(windowFilePath));
    } else {
        win.loadFile(getWindowUrl(windowFilePath));
    }

    return win;
}
