// Add these IPC handlers
import {BrowserWindow, ipcMain} from "electron";
import path from "path";
import {spawn} from "child_process";

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
