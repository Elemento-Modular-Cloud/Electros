const { app, BrowserWindow, ipcMain, Menu, nativeTheme , shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { globalShortcut } = require('electron');

// Import handlers from separate files. They are apparently unused since called by name in the preload.js
const configHandlers = require('./js/config-ipc');
const titlebarHandlers = require('./js/titlebar-ipc');
const { Loaders } = require("./common/Loaders");
const { WindowOptions } = require("./common/WindowOptions");
const { BuildMenuTemplate } = require("./common/MenuBar");
const { PortHandler } = require("./common/PortHandler");
const { Platform } = require("./common/Platform");
const {TrayIcon} = require("./common/TrayIcon");
const {Daemons} = require("./common/Daemons");


let mainWindow = null;
let terminalWindow = null;

const PreloadedContent = new Loaders(__dirname);
const platform = new Platform();
let Tray = null;


function createMainWindow() {
    const win = new BrowserWindow({
        width: 1800,
        height: 1200,
        ...WindowOptions.Common,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            zoomFactor: 1.0,
            backgroundThrottling: false,
            enableRemoteModule: false,
            experimentalFeatures: false,
            devTools: !app.isPackaged,
        }
    });

    if (platform.os === 'mac') {
        win.setWindowButtonVisibility(false);
    }

    win.loadFile('electros/electros.html');

    // Inject custom titlebar after the page loads
    win.webContents.on('did-finish-load', () => {
        try {
            // Ensure titlebarCustomJS is a string and properly escaped
            const safeJS = typeof PreloadedContent.Js.Titlebar === 'string'
                ?  PreloadedContent.Js.Titlebar
                : JSON.stringify(PreloadedContent.Js.Titlebar);

            win.webContents.executeJavaScript(safeJS).catch(err => { throw err; });
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
        ...WindowOptions.Common,
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
        Daemons.Launch(platform, __dirname);

        // // Set up periodic buffer flushing
        // flushInterval = setInterval(() => {
        //     if (stdoutBuffer) {
        //         terminalWindow.webContents.send('terminal-output', stdoutBuffer);
        //         stdoutBuffer = '';
        //     }
        //     if (stderrBuffer) {
        //         terminalWindow.webContents.send('terminal-output', stderrBuffer);
        //         stderrBuffer = '';
        //     }
        // }, 100); // Flush every 100ms

        // Inject custom titlebar
        const popupTitlebarJS = PreloadedContent.Js.Titlebar.replace(
            'titleElement.textContent = document.title;',
            `titleElement.textContent = ${JSON.stringify(terminalWindow.title)};`
        ) //.replace(
//            'initializeTitlebar(options = { minimizeOnly: false });',
//            'initializeTitlebar(options = { minimizeOnly: true });'
//        );

        terminalWindow.webContents.executeJavaScript(popupTitlebarJS);
    });

    if (Tray === null) {
        Tray = new TrayIcon(terminalWindow, platform, __dirname);
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
//            const altF4Registered = globalShortcut.register('Alt+F4', () => {
//                const focusedWindow = BrowserWindow.getFocusedWindow();
//                if (focusedWindow) {
//                    focusedWindow.close();
//                    return true; // Prevent default behavior
//                }
//                // For main window, let the default Alt+F4 behavior happen
//                return false;
//            });
//            if (altF4Registered) {
//                shortcuts.push('Alt+F4');
//            }

            // For macOS: Cmd+Q closes current window if it's not main
            // const cmdQRegistered = globalShortcut.register('Command+Q', () => {
            //     const focusedWindow = BrowserWindow.getFocusedWindow();
            //     if (focusedWindow) {
            //         focusedWindow.close();
            //         return true; // Prevent default quit
            //     }
            //     // Let the default Cmd+Q behavior happen for main window
            //     return false;
            // });
            // if (cmdQRegistered) {
            //     shortcuts.push('Command+Q');
            // }
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
                const popupTitlebarJS = PreloadedContent.Js.Titlebar.replace(
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
        PortHandler.ReleasePort(parseInt(port));
    }

    // Kill the mstsc process if it exists
    if (webContents.mstscProcess) {
        try {
            const proc = webContents.mstscProcess;

            if (platform.os === 'mac' || platform.os === 'linux') {
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
            } else if (platform.os === 'win') {
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
                PortHandler.ReleasePort(parseInt(webContents.mstscPort));
                webContents.mstscPort = null;
            }
        }
    }
}

// Then modify the before-quit handler to use the cleanup function directly
app.on('before-quit', () => {
    console.log('Quitting app, killing processes');

    // Clean up flush interval
    // // if (flushInterval) {
    // //     clearInterval(flushInterval);
    // //     flushInterval = null;
    // // }
    //
    // // Flush any remaining buffers
    // if (stdoutBuffer && terminalWindow && !terminalWindow.isDestroyed()) {
    //     terminalWindow.webContents.send('terminal-output', stdoutBuffer);
    //     stdoutBuffer = '';
    // }
    // if (stderrBuffer && terminalWindow && !terminalWindow.isDestroyed()) {
    //     terminalWindow.webContents.send('terminal-output', stderrBuffer);
    //     stderrBuffer = '';
    // }

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
    Daemons.Terminate();

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
    const menu = Menu.buildFromTemplate(
        BuildMenuTemplate(terminalWindow),
    );
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
        ...WindowOptions.Common,
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
        const rdpTitlebarJS = PreloadedContent.Js.Titlebar.replace(
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

ipcMain.handle('os-prefers-dark-theme', (event) => {
    return nativeTheme?.shouldUseDarkColors ?? false;
})

ipcMain.handle('os-prefers-reduced-transparency', (event) => {
    return nativeTheme?.prefersReducedTransparency  ?? false;
})

// Add these IPC handlers
ipcMain.handle('launch-rdp-process', async (event, { credentials, width, height }) => {
    try {
        const ws_port = PortHandler.GetAvailablePort().toString();

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
            detached: platform.os === 'mac' || platform.os === 'linux',
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
                PortHandler.ReleasePort(parseInt(event.sender.mstscPort));
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
            PortHandler.ReleasePort(parseInt(ws_port));
        }
        return { success: false, error: error.message };
    }
});

// Keep only one IPC handler for cleanup-rdp-process
ipcMain.handle('cleanup-rdp-process', (event, port) => {
    cleanupRDPProcess(event.sender, port);
});

ipcMain.handle('open-browser', async (event, {
    url
}) => {
    await shell.openExternal(url);
})

ipcMain.handle('open-ssh', async (event, connectionDetails) => {
    const sshWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        ...WindowOptions.Common,
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

    let ssh_port = undefined;

    try {
        ssh_port = PortHandler.GetAvailablePort().toString();

        const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
        const sshPath = path.join(
            baseDir,
            app.isPackaged ? 'app.asar.unpacked' : '',
            'electros', 'remotes', 'ssh', 'ssh.cjs'
        );

        // Start the SSH server process
        const sshServer = require(sshPath);
        await sshServer.runSSHServer(ssh_port, baseDir);

        event.sender.ssh_port = ssh_port;

        sshWindow.webContents.on('did-finish-load', () => {
            const sshTitlebarJS = PreloadedContent.Js.Titlebar.replace(
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
                PortHandler.ReleasePort(parseInt(ssh_port));

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
            PortHandler.ReleasePort(parseInt(ssh_port));
        }
        throw error;
    }
});

app.on('renderer-process-crashed', (event, webContents, killed) => {
    console.error('Renderer crashed:', killed);
});

app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
});

