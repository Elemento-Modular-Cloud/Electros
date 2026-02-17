const {app, BrowserWindow, ipcMain, Menu, nativeTheme, shell, safeStorage} = require('electron');

app.commandLine.appendSwitch('force-device-scale-factor', '1');
const path = require('path');
const {spawn} = require('child_process');
const net = require('net');
const {globalShortcut} = require('electron');

// Import handlers from separate files. They are apparently unused since called by name in the preload.js
const configHandlers = require('./js/config-ipc');
const titlebarHandlers = require('./js/titlebar-ipc');
const {Loaders} = require("./common/Loaders");
const {WindowOptions} = require("./common/WindowOptions");
const {BuildMenuTemplate} = require("./common/MenuBar");
const {PortHandler} = require("./common/PortHandler");
const {Platform} = require("./common/Platform");
const {Daemons} = require("./common/Daemons");
const {Terminal} = require("./windows/Terminal");
const {RdpWindow} = require("./windows/Rdp.js");
const {DaemonsNotEnabledError} = require("./common/Daemons.js");
const fs = require("fs");
const {homedir} = require("node:os");


let mainWindow = null;

const PreloadedContent = new Loaders(__dirname);
const platform = new Platform();
const Rdp = new RdpWindow(PreloadedContent, platform, __dirname);

if (process.env.XDG_SESSION_TYPE === 'wayland') {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
}


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
            devTools: !app.isPackaged || process.argv.includes("--enable-devtools"),
        }
    });

    if (platform.os === 'mac') {
        win.setWindowButtonVisibility(false);
    }

    win.loadFile('electros/electros.html');

    // Inject custom titlebar after the page loads
    win.webContents.on('did-finish-load', () => {
        try {
            const safeJS = typeof PreloadedContent.Js.Titlebar === 'string'
                ? PreloadedContent.Js.Titlebar
                : JSON.stringify(PreloadedContent.Js.Titlebar);

            win.webContents.executeJavaScript(safeJS).catch(err => {
                throw err;
            });
        } catch (error) {
            console.error('Error injecting titlebar:', error);
        }
    });

    win.webContents.setVisualZoomLevelLimits(1, 1);

    return win;
}

function createWindows() {
    try {
        Terminal.CreateWindow(PreloadedContent, platform, __dirname);
        mainWindow = createMainWindow();

        mainWindow.on('closed', () => {
            app.quit();
        });

        setupWindowShortcuts(mainWindow);
    } catch (error) {
        console.error('Error creating windows:', error);
    }
}

// Add this function to set up window-specific shortcuts
function setupWindowShortcuts(window) {
    let quitShortcut = false;

    window.on('focus', () => {
        if (platform.isMac()) {
        } else {
            if (!quitShortcut) {
                globalShortcut.register('Alt+F4', () => {
                    Daemons.Terminate();
                    app.quit();
                });
                quitShortcut = true;
            }
        }
    });

    window.on('blur', () => {
        globalShortcut.unregister('Alt+F4');
    });

    window.on('closed', () => {
        globalShortcut.unregister('Alt+F4');
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

    popup.webContents.setVisualZoomLevelLimits(1, 1);

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


app.on('before-quit', () => {
    console.log('Quitting app, killing processes');

    // Clean up flush interval
    // if (flushInterval) {
    //     clearInterval(flushInterval);
    //     flushInterval = null;
    // }
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
    try {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            // Clean up any mstsc processes
            if (window.webContents.mstscProcess) {
                Rdp.handleCloseRdpProcess(window.webContents);
            }

            if (!window.isDestroyed()) {
                window.destroy();
            }
        });

        Terminal.DestroyWindow();
    } catch (error) {
        console.error(error);
    }

    Daemons.Terminate();
});

// Add this IPC handler before app.whenReady()
ipcMain.handle('check-port', async (event, {ip, port}) => {
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
        BuildMenuTemplate(),
    );
    Menu.setApplicationMenu(menu);

    try {
        Daemons.Launch(platform, __dirname);
    } catch (e) {
        if (!(e instanceof DaemonsNotEnabledError)) {
            console.error(e);
        }
    }

    createWindows();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    const mainWindows = BrowserWindow.getAllWindows().filter(win =>
        !win.isDestroyed()
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
});

ipcMain.handle('os-prefers-reduced-transparency', (event) => {
    return nativeTheme?.prefersReducedTransparency ?? false;
});

ipcMain.handle('open-browser', async (event, {url}) => {
    await shell.openExternal(url);
});

ipcMain.handle('open-dot-config', async (event, {file = null}) => {
    const CONFIG_DIR = path.join(homedir(), '.elemento');
    let actualPath = CONFIG_DIR;

    if (file) {
        actualPath = path.join(CONFIG_DIR, ...(file.split("/")));
    }

    await shell.openPath(actualPath);

});


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
        if (ssh_port !== null || ssh_port !== undefined || ssh_port !== "") {
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


ipcMain.handle("safestorage-encrypt", async (event, { value, refuseUnsafe = true }) => {
    const isAvailable = safeStorage.isEncryptionAvailable();
    if (!isAvailable && refuseUnsafe) {
        return false;
    } else if (!isAvailable && !refuseUnsafe) {
        console.warn("Value was not encrypted because the OS has no support for keychains.")
        return value;
    }

    return safeStorage.encryptString(value)
});

ipcMain.handle("safestorage-decrypt", async (event, { value }) => {
    const isAvailable = safeStorage.isEncryptionAvailable();
    if (!isAvailable) { return false; }

    return safeStorage.decryptString(value)
});

ipcMain.handle("app-version", () => {
    return {
        version: app.getVersion(),
        node: process.versions
    };
});
