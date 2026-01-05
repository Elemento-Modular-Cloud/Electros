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
const { TrayIcon } = require("./common/TrayIcon");
const { Daemons } = require("./common/Daemons");
const { RdpWindow } = require("./remotes/rdp.js");


let mainWindow = null;
let terminalWindow = null;

const PreloadedContent = new Loaders(__dirname);
const platform = new Platform();
let Tray = null;
const Rdp = new RdpWindow(PreloadedContent, platform, __dirname);


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
            zoomFactor: 1,
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

        terminalWindow.webContents.executeJavaScript(PreloadedContent.Js.Titlebar);
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
            zoomFactor: 1,
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
            Rdp.handleCloseRdpProcess(window.webContents);
        }

        if (window !== terminalWindow && !window.isDestroyed()) {
            window.destroy();
        }
    });

    Daemons.Terminate();

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

ipcMain.handle('os-prefers-dark-theme', (event) => {
    return nativeTheme?.shouldUseDarkColors ?? false;
})

ipcMain.handle('os-prefers-reduced-transparency', (event) => {
    return nativeTheme?.prefersReducedTransparency  ?? false;
})


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
            zoomFactor: 1,
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

