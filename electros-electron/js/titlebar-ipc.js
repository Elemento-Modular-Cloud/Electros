const { ipcMain, BrowserWindow } = require('electron');

ipcMain.handle('minimize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
});

ipcMain.handle('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.handle('toggle-full-screen', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.setFullScreen(!win.isFullScreen());
    }
});

ipcMain.handle('close-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
});

module.exports = {
    channels: ['minimize-window', 'maximize-window', 'toggle-full-screen', 'close-window']
};