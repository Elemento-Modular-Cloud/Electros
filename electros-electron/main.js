const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const nativeImage = require('electron').nativeImage;

let platform = null;
let mainWindow = null;

function getDaemonCommand() {
    platform = os.platform();
    console.log(`The platform is: ${platform}`);
    var arch = os.arch();
    console.log(`The CPU architecture is: ${arch}`);

    if (platform === 'darwin') {
        platform = 'mac';
    } else if (platform === 'linux') {
        platform = 'linux';
    } else if (platform.includes('win')) {
        platform = 'win';
    }

    if (arch.toLowerCase() === 'x86' || arch.toLowerCase() === 'x64') {
        arch = 'x64';
    }

    // Use process.resourcesPath in production, fallback to __dirname in development
    const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
    const deamons_path = path.join(baseDir, 'electros-daemons', platform, arch);
    console.log(`The deamons path is: ${deamons_path}`);
    
    let daemons_cmd = "";
    
    if (platform === 'mac') {
        daemons_cmd = path.join(deamons_path, "elemento_client_daemons.app/Contents/MacOS/elemento_client_daemons");
    } else if (platform === 'linux') {
        daemons_cmd = path.join(deamons_path, `Elemento_Daemons_linux_${arch}`);
    } else if (platform === 'win') {
        if (arch === 'x64' || arch === 'x86') {
            daemons_cmd = path.join(deamons_path, `Elemento_Daemons_win_x86.exe`);
            if (!fs.existsSync(daemons_cmd)) {
                daemons_cmd = path.join(deamons_path, `Elemento_Daemons_win_x64.exe`);
            }
        } else {
            daemons_cmd = path.join(deamons_path, `Elemento_Daemons_win_arm64.exe`);
        }
    }

    console.log(`The daemons command is: ${daemons_cmd}`);
    return daemons_cmd;
}

const daemons_cmd = getDaemonCommand();

let tray = null;
let terminalWindow = null;
let daemonProcess = null;

// Add this function to create different tray icons
function createTrayIcon() {
    const isLight = nativeTheme.shouldUseDarkColors;
    console.log(`The theme is light: ${isLight}`);

    if (platform === 'mac') {
        const templateIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_black_32x32@2x.png');
        const icon = nativeImage.createFromPath(templateIcon);
        icon.setTemplateImage(true);
        return icon;
    }

    if (platform === 'win') {
        const lightIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_white.ico');
        const darkIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_black.ico');
        const iconName = !isLight ? darkIcon : lightIcon;
        const icon = nativeImage.createFromPath(iconName);
        return icon;
    }

    if (platform === 'linux') {
        const lightIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_white_32x32@2x.png');
        const darkIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_black_32x32@2x.png');
        const iconName = !isLight ? darkIcon : lightIcon;
        const icon = nativeImage.createFromPath(iconName);
        return icon;
    }
}

// Replace the daemon spawn code with this
function createTerminalWindow() {
    terminalWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#000000', // Add dark background
        title: 'Electros Daemons'
    });

    terminalWindow.loadFile('terminal.html');

    // Wait for the terminal window to be ready
    terminalWindow.webContents.on('did-finish-load', () => {
        // Start the daemon process with the actual daemon command
        daemonProcess = spawn(daemons_cmd, [], {
            env: {
                ...process.env,
                GUI_APP: '1'
            }
        });

        // Send process output to the renderer
        daemonProcess.stdout.on('data', (data) => {
            terminalWindow.webContents.send('terminal-output', data.toString());
        });

        daemonProcess.stderr.on('data', (data) => {
            terminalWindow.webContents.send('terminal-output', data.toString());
        });

        daemonProcess.on('error', (error) => {
            terminalWindow.webContents.send('terminal-output', `Error: ${error.message}\n`);
        });
    });

    // Create tray icon if it doesn't exist
    if (!tray) {
        tray = new Tray(createTrayIcon());
        
        // Update icon when system theme changes
        nativeTheme.on('updated', () => {
            tray.setImage(createTrayIcon());
        });

        const contextMenu = Menu.buildFromTemplate([
            { 
                label: 'Show Terminal', 
                click: () => {
                    terminalWindow.show();
                }
            },
            { 
                label: 'Hide Terminal', 
                click: () => {
                    terminalWindow.hide();
                }
            },
            { type: 'separator' },
            { 
                label: 'Quit', 
                click: () => {
                    app.quit();
                }
            }
        ]);
        
        tray.setToolTip('Electros Daemons');
        tray.setContextMenu(contextMenu);
    }

    // Handle window close button
    terminalWindow.on('close', (event) => {
        event.preventDefault(); // Prevent window from closing
        terminalWindow.hide(); // Hide instead of close
    });
}

// Add cleanup handler when app is quitting
app.on('before-quit', () => {
    console.log('Quitting app, killing daemon process');
    
    // Close all windows except terminal
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        if (window !== terminalWindow && !window.isDestroyed()) {
            window.destroy();
        }
    });

    // Kill daemon process
    if (daemonProcess) {
        if (platform === 'mac') {
            try {
                spawn('pkill', ['-f', 'elemento_client_daemons'], { stdio: 'ignore' });
                spawn('osascript', ['-e', 'tell application "Terminal" to quit'], { stdio: 'ignore' });
            } catch (err) {
                console.error('Error killing daemon process on macOS:', err);
            }
        } else if (platform === 'linux' && daemonProcess.pid) {
            try {
                process.kill(daemonProcess.pid, 0);
                process.kill(-daemonProcess.pid);
            } catch (err) {
                if (err.code === 'ESRCH') {
                    console.log('Daemon process group already terminated');
                } else {
                    console.error('Error killing daemon process group:', err);
                }
            }
        }
        
        try {
            if (!daemonProcess.killed) {
                daemonProcess.kill();
            }
        } catch (err) {
            if (err.code === 'ESRCH') {
                console.log('Daemon process already terminated');
            } else {
                console.error('Error killing daemon process:', err);
            }
        }
    }

    // Finally destroy the terminal window
    if (terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.destroy();
    }
});

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

    if (platform === 'mac') {
        win.setWindowButtonVisibility(false);
    }
    win.loadFile('electros/electros.html');
    
    return win;
}


function createWindows() {
    createTerminalWindow();
    mainWindow = createWindow();

    mainWindow.on('closed', () => {
        if (terminalWindow) {
            terminalWindow.hide();
        }
    });
}


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
            ]
        }
    ]
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    createWindows();
});

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
    if (config.config) {
        config = config.config;
    }
    try {
        const json = JSON.stringify(config, null, 4);
        console.error('Writing config:', json);
        fs.writeFileSync(CONFIG_PATH, json);
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
    if (process.platform !== 'mac') {
        app.quit();
    }
});

app.on('activate', () => {
    const mainWindows = BrowserWindow.getAllWindows().filter(win => 
        win !== terminalWindow && !win.isDestroyed()
    );

    if (mainWindows.length === 0) {
        createWindow();
    } else {
        // Show the first hidden main window if it exists
        for (const win of mainWindows) {
            if (!win.isVisible()) {
                win.show();
                break;
            }
        }
    }
});
