const { app, BrowserWindow, ipcMain, Menu, Tray, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const nativeImage = require('electron').nativeImage;
const net = require('net');
const { globalShortcut } = require('electron');

// Import handlers from separate files. They are apparently unused since called by name in the preload.js
const configHandlers = require('./js/config-ipc');
const titlebarHandlers = require('./js/titlebar-ipc');

let mainWindow = null;
let terminalWindow = null;
let daemonProcess = null;
let tray = null;

// Add buffering variables for daemon output
let stdoutBuffer = '';
let stderrBuffer = '';
const BUFFER_SIZE = 1024; // 1KB chunks
let flushInterval = null;

let platform = os.platform();

const commonWindowOptions = {
    frame: false,
    transparent: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: -100, y: -100 },
    alwaysOnTop: false
}

const defaultWindowOptions = {
    frame: true,
    transparent: false,
    alwaysOnTop: false
}

// Pre-load CSS files to avoid synchronous file reading during startup
let themesCSS = null;
let formControlsCSS = null;
let titlebarCSS = null;
let titlebarJS = null;

function preloadCSSFiles() {
    try {
        themesCSS = fs.readFileSync(path.join(__dirname, 'electros', 'css', 'themes.css'), 'utf8');
        formControlsCSS = fs.readFileSync(path.join(__dirname, 'electros', 'css', 'form-controls.css'), 'utf8');
        titlebarCSS = fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.css'), 'utf8');
        titlebarJS = fs.readFileSync(path.join(__dirname, 'titlebar', 'titlebar.js'), 'utf8');
    } catch (error) {
        console.error('Error preloading CSS files:', error);
    }
}

// Pre-load files before creating windows
preloadCSSFiles();

const themesLoaderJS = `
    // Create and load CSS inline
    var theme = document.createElement('style');
    theme.textContent = ${JSON.stringify(themesCSS || '')};
    document.head.appendChild(theme);
`

const formStyleLoaderJS = `
    // Create and load CSS inline
    var formstyle = document.createElement('style');
    formstyle.textContent = ${JSON.stringify(formControlsCSS || '')};
    document.head.appendChild(formstyle);
`

const titlebarCustomJS = `
    console.log('Titlebar custom JS');

    ${themesLoaderJS}
    ${formStyleLoaderJS}

    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(titlebarCSS || '')};
    document.head.appendChild(style);

    console.log('Titlebar CSS loaded');

    // Create titlebar div and title element
    var titlebar = document.createElement('div');
    titlebar.className = 'electros-titlebar';

    console.log('Titlebar div created');
    
    var titleElement = document.createElement('div');
    titleElement.className = 'electros-titlebar-title';
    titleElement.textContent = document.title;
    
    console.log('Titlebar title element created');

    document.body.insertBefore(titlebar, document.body.firstChild);

    console.log('Titlebar inserted into body');
    
    // Load and execute titlebar.js content
    ${titlebarJS || ''}

    console.log('Titlebar.js loaded');  
    
    initializeTitlebar(options = { minimizeOnly: false });

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

const activePorts = new Set();
let nextPort = 49152;

function getAvailablePort() {
    while (activePorts.has(nextPort)) {
        nextPort++;
        if (nextPort > 65535) nextPort = 49152;
    }
    activePorts.add(nextPort);
    return nextPort++;
}

function releasePort(port) {
    activePorts.delete(port);
}

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
    const baseDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
    const deamons_path = path.join(baseDir, 'electros-daemons', platform, arch);
    console.log(`The deamons path is: ${deamons_path}`);
    
    let daemons_cmd = '';
    
    if (platform === 'mac') {
        daemons_cmd = path.join(deamons_path, "elemento_client_daemons.app/Contents/MacOS/elemento_client_daemonsFAIL");
    } else if (platform === 'linux') {
        if (arch === 'arm64') {
            daemons_cmd = path.join(deamons_path, `elemento_daemons_linux_arm`);
        } else {
            daemons_cmd = path.join(deamons_path, `elemento_daemons_linux_x86`);
        }
    } else if (platform === 'win') {
        if (arch === 'x64' || arch === 'x86') {
            daemons_cmd = path.join(deamons_path, `elemento_daemons_windows_x86.exe`);
            if (!fs.existsSync(daemons_cmd)) {
                daemons_cmd = path.join(deamons_path, `elemento_daemons_windows_x64.exe`);
            }
        } else {
            daemons_cmd = path.join(deamons_path, `elemento_daemons_windows_arm64.exe`);
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
            zoomFactor: 0.8,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false
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
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 0.8,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false,
            webSecurity: false
        },
        backgroundColor: '#000000',
        title: 'Electros Daemons'
    });

    terminalWindow.loadFile('terminal/terminal.html');

    // Wait for the terminal window to be ready
    terminalWindow.webContents.on('did-finish-load', () => {

        // Start the daemon process with the actual daemon command
        daemonProcess = spawn(daemons_cmd, [], {
            env: {
                ...process.env,
                GUI_APP: '1'
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });

        // Buffered process output to the renderer
        daemonProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            if (stdoutBuffer.length >= BUFFER_SIZE) {
                terminalWindow.webContents.send('terminal-output', stdoutBuffer);
                stdoutBuffer = '';
            }
        });

        daemonProcess.stderr.on('data', (data) => {
            stderrBuffer += data.toString();
            if (stderrBuffer.length >= BUFFER_SIZE) {
                terminalWindow.webContents.send('terminal-output', stderrBuffer);
                stderrBuffer = '';
            }
        });

        daemonProcess.on('error', (error) => {
            terminalWindow.webContents.send('terminal-output', `Error: ${error.message}\n`);
        });

        // Set up periodic buffer flushing
        flushInterval = setInterval(() => {
            if (stdoutBuffer) {
                terminalWindow.webContents.send('terminal-output', stdoutBuffer);
                stdoutBuffer = '';
            }
            if (stderrBuffer) {
                terminalWindow.webContents.send('terminal-output', stderrBuffer);
                stderrBuffer = '';
            }
        }, 100); // Flush every 100ms

        // Inject custom titlebar
        const popupTitlebarJS = titlebarCustomJS.replace(
            'titleElement.textContent = document.title;',
            `titleElement.textContent = ${JSON.stringify(terminalWindow.title)};`
        ).replace(
            'initializeTitlebar(options = { minimizeOnly: false });',
            'initializeTitlebar(options = { minimizeOnly: true });'
        );
        
        terminalWindow.webContents.executeJavaScript(popupTitlebarJS);
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

    // Add IPC handlers for window controls
    ipcMain.on('minimize-window', () => {
        terminalWindow.minimize();
    });

    ipcMain.on('hide-window', () => {
        terminalWindow.hide();
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
        
        // Register a local shortcut for the main window
        setupWindowShortcuts(mainWindow);
    } catch (error) {
        console.error('Error creating windows:', error);
    }
}

// Add this function to set up window-specific shortcuts
function setupWindowShortcuts(window) {
    // Keep track of registered shortcuts for this window
    const shortcuts = [];
    
    // When window is focused, set up its shortcuts
    window.on('focus', () => {
        // Only register if not already registered
        if (shortcuts.length === 0) {
            // For Windows/Linux: Alt+F4 closes current window instead of app
            shortcuts.push(globalShortcut.register('Alt+F4', () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                    focusedWindow.close();
                    return true; // Prevent default behavior
                }
                // For main window, let the default Alt+F4 behavior happen
                return false;
            }));
            
            // For macOS: Cmd+Q closes current window if it's not main
            shortcuts.push(globalShortcut.register('Command+Q', () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                    focusedWindow.close();
                    return true; // Prevent default quit
                }
                // Let the default Cmd+Q behavior happen for main window
                return false;
            }));
        }
    });
    
    // Clean up when window is closed
    window.on('closed', () => {
        shortcuts.forEach(shortcut => globalShortcut.unregister(shortcut));
        shortcuts.length = 0; // Clear the array
    });
}

ipcMain.handle('create-popup', async (event, options = {}) => {
    console.log(options);

    const popup = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 600,
        ...(options.defaultTitlebar ? defaultWindowOptions : commonWindowOptions),
        movable: true,
        // parent: BrowserWindow.getFocusedWindow(),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            zoomFactor: 0.8,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false
        },
        ...options
    });

    // Set up window-specific shortcuts for this popup
    setupWindowShortcuts(popup);

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
        if (!options.defaultTitlebar) {
            popup.webContents.on('did-finish-load', () => {
            const popupTitlebarJS = titlebarCustomJS.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = ${JSON.stringify(options.title)};`
                );
                popup.webContents.executeJavaScript(popupTitlebarJS);
            });
        }

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

// First, let's define our cleanup function separately so we can reuse it
function cleanupRDPProcess(webContents, port) {
    // Release the port
    if (port) {
        releasePort(parseInt(port));
    }
    
    // Kill the mstsc process if it exists
    if (webContents.mstscProcess) {
        try {
            const proc = webContents.mstscProcess;
            
            if (platform === 'mac' || platform === 'linux') {
                // On Unix systems, kill the entire process group
                try {
                    process.kill(-proc.pid, 'SIGTERM');
                    setTimeout(() => {
                        try {
                            process.kill(-proc.pid, 'SIGKILL');
                        } catch (e) {
                            // Process already dead, ignore
                        }
                    }, 1000);
                } catch (err) {
                    if (err.code !== 'ESRCH') {
                        console.error('Error killing mstsc process group:', err);
                    }
                }
            } else if (platform === 'win') {
                // On Windows, use taskkill to force kill the process tree
                try {
                    spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F']);
                } catch (err) {
                    console.error('Error killing mstsc process on Windows:', err);
                }
            }
            
            // Also try to kill the process directly
            try {
                if (!proc.killed) {
                    proc.kill('SIGTERM');
                    setTimeout(() => {
                        try {
                            if (!proc.killed) {
                                proc.kill('SIGKILL');
                            }
                        } catch (e) {
                            // Process already dead, ignore
                        }
                    }, 1000);
                }
            } catch (err) {
                if (err.code !== 'ESRCH') {
                    console.error('Error killing mstsc process directly:', err);
                }
            }
        } finally {
            // Clear the process reference
            webContents.mstscProcess = null;
            if (webContents.mstscPort) {
                releasePort(parseInt(webContents.mstscPort));
                webContents.mstscPort = null;
            }
        }
    }
}

// Then modify the before-quit handler to use the cleanup function directly
app.on('before-quit', () => {
    console.log('Quitting app, killing processes');
    
    // Clean up flush interval
    if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
    }
    
    // Flush any remaining buffers
    if (stdoutBuffer && terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.webContents.send('terminal-output', stdoutBuffer);
        stdoutBuffer = '';
    }
    if (stderrBuffer && terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.webContents.send('terminal-output', stderrBuffer);
        stderrBuffer = '';
    }
    
    // Close all windows except terminal
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        // Clean up any mstsc processes
        if (window.webContents.mstscProcess) {
            cleanupRDPProcess(window.webContents);
        }
        
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

// Add this IPC handler before app.whenReady()
ipcMain.handle('check-port', async (event, { ip, port }) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        
        // Set a timeout of 1 second
        socket.setTimeout(1000);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.connect(port, ip);
    });
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
            zoomFactor: 0.8,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false
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

    // Set up window-specific shortcuts
    setupWindowShortcuts(rdpWindow);

    // Load the RDP client page with connection details
    try {
        await rdpWindow.loadFile('electros/remotes/rdp/index.html', {
            query: connectionDetails
        });
    } catch (error) {
        console.error('Error loading RDP window:', error);
        throw error;
    }

    // Modify the RDP window close handler
    rdpWindow.on('close', async (event) => {
        try {
            // Prevent the window from closing immediately
            event.preventDefault();
            
            // Send the close event to the renderer
            if (!rdpWindow.isDestroyed()) {
                rdpWindow.webContents.send('window-close');
            }
            
            // Clean up the RDP process directly
            if (rdpWindow.webContents.mstscProcess) {
                cleanupRDPProcess(rdpWindow.webContents);
            }
            
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Now destroy the window
            if (!rdpWindow.isDestroyed()) {
                rdpWindow.destroy();
            }
        } catch (error) {
            console.error('Error during window cleanup:', error);
            // Ensure the window is destroyed even if there's an error
            if (!rdpWindow.isDestroyed()) {
                rdpWindow.destroy();
            }
        }
    });

    return rdpWindow.id;
});

// Add these IPC handlers
ipcMain.handle('launch-rdp-process', async (event, { credentials, width, height }) => {
    try {
        const ws_port = getAvailablePort().toString();

        const args = [
            '--target', credentials.ip,
            '--user', credentials.username,
            '--dom', credentials.domain,
            '--pass', credentials.password,
            '--width', width.toString(),
            '--height', height.toString(),
            '--ws_port', ws_port
        ];

        // Use process.resourcesPath in production, fallback to __dirname in development
        const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
        const mstscPath = path.join(
            baseDir,
            app.isPackaged ? 'app.asar.unpacked' : '',
            'electros', 'remotes', 'rdp', 'mstsc-rs'
        );

        // Set detached option for proper process group handling on Unix systems
        const spawnOptions = {
            detached: platform === 'mac' || platform === 'linux',
            env: process.env
        };

        const mstscProcess = spawn(mstscPath, args, spawnOptions);

        // Store process reference and port
        event.sender.mstscProcess = mstscProcess;
        event.sender.mstscPort = ws_port;

        mstscProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        mstscProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        mstscProcess.on('close', (code) => {
            console.log(`mstsc-rs process exited with code ${code}`);
            // Release the port when the process closes
            if (event.sender.mstscPort) {
                releasePort(parseInt(event.sender.mstscPort));
                event.sender.mstscPort = null;
            }
            // Check if the window still exists before sending the message
            if (!event.sender.isDestroyed()) {
                event.sender.send('rdp-process-closed');
            }
        });

        return { success: true, ws_port: ws_port };
    } catch (error) {
        console.error('Error launching RDP process:', error);
        if (ws_port) {
            releasePort(parseInt(ws_port));
        }
        return { success: false, error: error.message };
    }
});

// Keep only one IPC handler for cleanup-rdp-process
ipcMain.handle('cleanup-rdp-process', (event, port) => {
    cleanupRDPProcess(event.sender, port);
});

ipcMain.handle('open-ssh', async (event, connectionDetails) => {
    const sshWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        ...commonWindowOptions,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            zoomFactor: 0.8,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false
        }
    });

    var ssh_port = undefined;

    try {
        // Get an available port for the SSH server
        ssh_port = getAvailablePort().toString();

        console.log("connectionDetails: ", connectionDetails)
        const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
        const sshPath = path.join(
            baseDir,
            app.isPackaged ? 'app.asar.unpacked' : '',
            'electros', 'remotes', 'ssh', 'ssh.js'
        );

        // Start the SSH server process
        const sshServer = require(sshPath);
        await sshServer.runSSHServer(ssh_port, baseDir);

        // Store port reference
        event.sender.ssh_port = ssh_port;

        // Inject custom titlebar after the page loads
        sshWindow.webContents.on('did-finish-load', () => {
            const sshTitlebarJS = titlebarCustomJS.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = "SSH connection to ${connectionDetails.vmName}";`
            );
            sshWindow.webContents.executeJavaScript(sshTitlebarJS);
        });

        // Set up window-specific shortcuts
        setupWindowShortcuts(sshWindow);

        // Add connection cleanup on window close
        sshWindow.on('close', async (event) => {
            try {
                event.preventDefault();
                
                if (!sshWindow.isDestroyed()) {
                    sshWindow.webContents.send('window-close');
                }
                
                // Release the port
                releasePort(parseInt(ssh_port));
                
                // Wait a moment for cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (!sshWindow.isDestroyed()) {
                    sshWindow.destroy();
                }
            } catch (error) {
                console.error('Error during SSH window cleanup:', error);
                if (!sshWindow.isDestroyed()) {
                    sshWindow.destroy();
                }
            }
        });

        // Load the SSH client page with connection details and port
        await sshWindow.loadURL(`http://localhost:${ssh_port}/?host=${encodeURIComponent(connectionDetails.ip)}&username=${encodeURIComponent(connectionDetails.username)}&password=${encodeURIComponent(connectionDetails.password)}`);

        return sshWindow.id;

    } catch (error) {
        console.error('Error setting up SSH window:', error);
        if (ssh_port) {
            releasePort(parseInt(ssh_port));
        }
        throw error;
    }
});
