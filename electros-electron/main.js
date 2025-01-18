const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const nativeImage = require('electron').nativeImage;

const configHandlers = require('./js/config-ipc');
const titlebarHandlers = require('./js/titlebar-ipc');

let mainWindow = null;
let terminalWindow = null;
let daemonProcess = null;
let tray = null;

let platform = os.platform();

const commonWindowOptions = {
    frame: false,
    transparent: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: -100, y: -100 }
}

const titlebarCustomJS = `
    // Create and load CSS inline
    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.css'), 'utf8'))};
    document.head.appendChild(style);

    // Create titlebar div and title element
    var titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    
    var titleElement = document.createElement('div');
    titleElement.className = 'titlebar-title';
    titleElement.textContent = document.title;
    
    document.body.insertBefore(titlebar, document.body.firstChild);
    
    // Load and execute titlebar.js content
    ${fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.js'), 'utf8')}
    
    initializeTitlebar();
    titlebar.appendChild(titleElement);
`;

const menuTemplate = [
    {
        label: 'Electros',
        submenu:[
            {role: 'quit'}
        ]
    },
    {
        label: 'Edit',
        submenu: [
            {role: 'undo'},
            {role: 'redo'},
            {type: 'separator'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {role: 'delete'},
            {type: 'separator'},
            {role: 'selectAll'}
        ]
    },
    {
        label: 'View',
        submenu: [
            {
                label: 'Toggle Terminal',
                accelerator: 'CmdOrCtrl+T',
                click: () => {
                    if (terminalWindow) {
                        terminalWindow.isVisible() ? terminalWindow.hide() : terminalWindow.show();
                    }
                }
            },
            {type: 'separator'},
            {role: 'resetZoom', zoomFactor: 0.8},
            {role: 'zoomIn'},
            {role: 'zoomOut'},
            {type: 'separator'},
            {role: 'togglefullscreen'}
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

function getDaemonCommand() {
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

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1800,
        height: 1200,
        ...commonWindowOptions,
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

    // Inject custom titlebar after the page loads
    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(titlebarCustomJS);
    });
    
    return win;
}

// Replace the daemon spawn code with this
function createTerminalWindow() {
    terminalWindow = new BrowserWindow({
        width: 800,
        height: 600,
        ...commonWindowOptions,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 0.8
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

function createWindows() {
    createTerminalWindow();
    mainWindow = createMainWindow();

    mainWindow.on('closed', () => {
        if (terminalWindow) {
            terminalWindow.hide();
        }
    });
}

ipcMain.handle('create-popup', async (event, options = {}) => {
    console.log(options);

    const popup = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 600,
        ...commonWindowOptions,
        movable: true,
        parent: BrowserWindow.getFocusedWindow(),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            zoomFactor: 0.8
        },
        ...options
    });

    if (options.title) {
        popup.setTitle(options.title);
        popup.webContents.on('page-title-updated', (event) => {
            event.preventDefault();
            popup.setTitle(options.title);
        });
    }

    if (!options.url) {
        throw new Error('URL is required for popup window');
    }
    
    try {
        // Inject custom titlebar CSS and HTML before loading the URL
        popup.webContents.on('did-finish-load', () => {
            const popupTitlebarJS = titlebarCustomJS.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = ${JSON.stringify(options.title)};`
            );
            popup.webContents.executeJavaScript(popupTitlebarJS);
        });

        // Set certificate error handler before loading URL
        popup.webContents.session.setCertificateVerifyProc((request, callback) => {
            callback(0);
        });

        popup.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
            event.preventDefault();
            callback(true);
        });

        await popup.loadURL(options.url, {
            validateCertificate: (certificate) => true
        });
        return popup.id;
    } catch (error) {
        console.error('Error loading popup URL:', error);
        popup.destroy();
        throw error;
    }
});

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
                if (daemonProcess.pid) {
                    process.kill(daemonProcess.pid, 'SIGTERM');
                    process.kill(-daemonProcess.pid); // Kill process group
                }
            } catch (err) {
                if (err.code === 'ESRCH') {
                    console.log('Daemon process or group already terminated');
                } else {
                    console.error('Error killing daemon process on macOS:', err);
                }
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

app.whenReady().then(() => {
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    createWindows();
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
        createMainWindow();
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
