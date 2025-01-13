const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function createWindow() {
    const win = new BrowserWindow({
        width: 1800,
        height: 1200,
        frame: false,
        transparent: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: -100, y: -100 },
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            zoomFactor: 0.8
        }
    });

    win.setWindowButtonVisibility(false);

    win.loadFile('electros/electros.html');
}

// File paths
const CONFIG_DIR = path.join(os.homedir(), '.elemento');
const CONFIG_PATH = path.join(CONFIG_DIR, 'settings');
const HOSTS_PATH = path.join(CONFIG_DIR, 'hosts');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// IPC Handlers
ipcMain.handle('read-config', async () => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error reading config:', error);
        return {};
    }
});

ipcMain.handle('read-hosts', async () => {
    try {
        if (fs.existsSync(HOSTS_PATH)) {
            const data = fs.readFileSync(HOSTS_PATH, 'utf8');
            return data.split('\n').filter(line => line.trim());
        }
        return [];
    } catch (error) {
        console.error('Error reading hosts:', error);
        return [];
    }
});

ipcMain.handle('write-config', async (event, config) => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
        return true;
    } catch (error) {
        console.error('Error writing config:', error);
        return false;
    }
});

ipcMain.handle('write-hosts', async (event, hosts) => {
    try {
        fs.writeFileSync(HOSTS_PATH, hosts.join('\n'));
        return true;
    } catch (error) {
        console.error('Error writing hosts:', error);
        return false;
    }
});

ipcMain.handle('create-popup', async (event, options = {}) => {
    console.log(options);

    const popup = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 600,
        frame: true,
        titleBarStyle: 'default', // Changed to default to show standard title bar
        movable: true,
        parent: BrowserWindow.getFocusedWindow(),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Set webSecurity false at BrowserWindow level
        },
        ...options
    });

    // Set title after window creation since it may be overridden by ...options
    if (options.title) {
        popup.setTitle(options.title);
        // Add event listener to maintain title after navigation
        popup.webContents.on('page-title-updated', (event) => {
            event.preventDefault();
            popup.setTitle(options.title);
        });
    }

    if (!options.url) {
        throw new Error('URL is required for popup window');
    }
    
    try {
        // Set certificate error handler before loading URL
        popup.webContents.session.setCertificateVerifyProc((request, callback) => {
            // Accept all certificates
            callback(0); 
        });

        await popup.loadURL(options.url);
        return popup.id;
    } catch (error) {
        console.error('Error loading popup URL:', error);
        popup.destroy();
        throw error;
    }
});

// Add these IPC handlers
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(() => {
    const menuTemplate = [
        {
            label: 'Electros',
            submenu:[
                {role: 'quit'}
            ]
        },
        {
            label: 'Developer',
            submenu:[
                {label: 'Reload', role: 'reload'},
                {label: 'Toggle DevTools', role: 'toggleDevTools'},
                {label: 'Toggle Fullscreen', role: 'toggleFullScreen'},
                {label: 'Toggle Zoom', role: 'toggleZoom'},
                {label: 'Toggle Developer Tools', role: 'toggleDevTools'},
                {label: 'Toggle Fullscreen', role: 'toggleFullScreen'},
                {label: 'Toggle Zoom', role: 'toggleZoom'},
            ]
        }
    ]
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    createWindow();
  });