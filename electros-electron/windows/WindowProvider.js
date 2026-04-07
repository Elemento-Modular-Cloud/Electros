import {app, BrowserWindow} from "electron";
import path from "path";

function getWindowUrl(__dirname, relativeHtmlPath) {
    if (!app.isPackaged) {
        // During dev, point to the Vite server
        return `http://localhost:5173/${relativeHtmlPath}`;
    }
    // During prod, point to the bundled file in dist-renderer
    return path.join(__dirname, 'dist-renderer', relativeHtmlPath);
}

export function WindowProvider(__dirname, windowFilePath, options) {
    const win = new BrowserWindow(options);

    if (!app.isPackaged) {
        win.loadURL(getWindowUrl(__dirname, windowFilePath));
    } else {
        win.loadFile(getWindowUrl(__dirname, windowFilePath));
    }

    return win;
}
