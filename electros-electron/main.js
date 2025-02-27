const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const nativeImage = require('electron').nativeImage;

// Import handlers from separate files. They are apparently unused since called by name in the preload.js
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

const themesLoaderJS = `
    // Create and load CSS inline
    var theme = document.createElement('style');
    theme.textContent = ${JSON.stringify(fs.readFileSync(path.join(__dirname, 'electros', 'css', 'themes.css'), 'utf8'))};
    document.head.appendChild(theme);
`

const formStyleLoaderJS = `
    // Create and load CSS inline
    var formstyle = document.createElement('style');
    formstyle.textContent = ${JSON.stringify(fs.readFileSync(path.join(__dirname, 'electros', 'css', 'form-controls.css'), 'utf8'))};
    document.head.appendChild(formstyle);
`

const titlebarCustomJS = `
    console.log('Titlebar custom JS');

    ${themesLoaderJS}
    ${formStyleLoaderJS}

    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.css'), 'utf8'))};
    document.head.appendChild(style);

    console.log('Titlebar CSS loaded');

    // Create titlebar div and title element
    var titlebar = document.createElement('div');
    titlebar.className = 'titlebar';

    console.log('Titlebar div created');
    
    var titleElement = document.createElement('div');
    titleElement.className = 'titlebar-title';
    titleElement.textContent = document.title;
    
    console.log('Titlebar title element created');

    document.body.insertBefore(titlebar, document.body.firstChild);

    console.log('Titlebar inserted into body');
    
    // Load and execute titlebar.js content
    ${fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.js'), 'utf8')}

    console.log('Titlebar.js loaded');  
    
    initializeTitlebar();

    console.log('Titlebar initialized');

    titlebar.appendChild(titleElement);

    console.log('Titlebar appended to body');
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
        if (arch === 'arm64') {
            daemons_cmd = path.join(deamons_path, `Elemento_Daemons_linux_arm`);
        } else {
            daemons_cmd = path.join(deamons_path, `Elemento_Daemons_linux_x86`);
        }
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
        const iconName = path.join(__dirname, 'electros.iconset', 'tray_icon.ico');
        const icon = nativeImage.createFromPath(iconName);
        return icon;
    }

    if (platform === 'linux') {
        const iconName = path.join(__dirname, 'electros.iconset', 'tray_icon.png');
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
        try {
            // Ensure titlebarCustomJS is a string and properly escaped
            const safeJS = typeof titlebarCustomJS === 'string' 
                ? titlebarCustomJS 
                : JSON.stringify(titlebarCustomJS);
            
            win.webContents.executeJavaScript(safeJS).catch(err => {});
        } catch (error) {
            console.error('Error injecting titlebar:', error);
        }
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
    try {
        createTerminalWindow();
        mainWindow = createMainWindow();

        mainWindow.on('closed', () => {
            if (terminalWindow) {
                terminalWindow.hide();
            }
        });
    } catch (error) {
        console.error('Error creating windows:', error);
    }
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
        popup.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
            event.preventDefault();
            callback(true);
        });

        // Check if we should load from file or URL
        if (options.isFile) {
            await popup.loadFile(options.url);
        } else {
            await popup.loadURL(options.url, {
                validateCertificate: (certificate) => true
            });
        }
        
        return popup.id;
    } catch (error) {
        console.error('Error loading popup:', error);
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

ipcMain.handle('open-rdp', async (event, connectionDetails) => {
    const rdpWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        ...commonWindowOptions,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            zoomFactor: 0.8
        }
    });

    // Set up ALL certificate handlers before loading the page
    rdpWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
        callback(0);  // 0 means success
    });

    rdpWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
        event.preventDefault();
        callback(true);
    });

    // Additional certificate bypass for self-signed certificates
    rdpWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });

    // Set additional security options
    rdpWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
    });

    // Inject custom titlebar after the page loads
    rdpWindow.webContents.on('did-finish-load', () => {
        const rdpTitlebarJS = titlebarCustomJS.replace(
            'titleElement.textContent = document.title;',
            `titleElement.textContent = "RDP connection to ${connectionDetails.vmName}";`
        );
        rdpWindow.webContents.executeJavaScript(rdpTitlebarJS);
    });

    // Load the RDP client page with connection details
    try {
        await rdpWindow.loadFile('electros/pages/js/virtual-machines/remotes/rdp/index.html', {
            query: connectionDetails
        });
    } catch (error) {
        console.error('Error loading RDP window:', error);
        throw error;
    }

    return rdpWindow.id;
});

// Add these IPC handlers
ipcMain.handle('launch-rdp-process', async (event, { credentials, width, height }) => {
    try {
        const args = [
            '--target', credentials.ip,
            '--user', credentials.username,
            '--pass', credentials.password,
            '--width', width.toString(),
            '--height', height.toString()
        ];

        const mstscProcess = spawn('electros/pages/js/virtual-machines/remotes/rdp/mstsc-rs', args);

        // Store process reference
        event.sender.mstscProcess = mstscProcess;

        mstscProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        mstscProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        mstscProcess.on('close', (code) => {
            console.log(`mstsc-rs process exited with code ${code}`);
            event.sender.send('rdp-process-closed');
        });

        return { success: true };
    } catch (error) {
        console.error('Error launching RDP process:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('cleanup-rdp-process', (event) => {
    if (event.sender.mstscProcess) {
        event.sender.mstscProcess.kill();
        event.sender.mstscProcess = null;
    }
});
