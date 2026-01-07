// Add these IPC handlers
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn } from "child_process";
import { WindowOptions } from "../common/WindowOptions.js";
import { PortHandler } from "../common/PortHandler.js";


export class RdpWindow {
    /** @type {?BrowserWindow} */
    _window = null;

    /**
     *
     * @param {Loaders} PreloadedRes
     * @param {Platform} platform
     * @param {string} __dirname
     */
    constructor(PreloadedRes, platform, __dirname) {
        this.PreloadedRes = PreloadedRes;
        this._platform = platform;
        this.__dirname = __dirname;

        this._setupIpcChannels();

    }

    _setupIpcChannels() {
        ipcMain.handle('launch-rdp-process', (event, { credentials, width, height }) => {
           this.handleLaunchRdpProcess({event, credentials, width, height}).then(r => {
               return r;
           }).catch(e => {
               return e;
           })
        });

        ipcMain.handle('cleanup-rdp-process', (event, port) => {
            this.handleCloseRdpProcess({eventSender: event.sender, port}).then(() => { }).catch(e => { });
        });

        ipcMain.handle("open-rdp", async (event, connectionDetails) => {
           return await this.openRdpWindow(connectionDetails);
        });
    }

    async openRdpWindow(connectionDetails) {
        this._constructWindow();
        this._setupWindowEvents(connectionDetails);
        this._loadContent(connectionDetails).then(() => {
            return this._window.id;
        }).catch((err) => {
            console.error(err);
            return -1;
        });
    }

    handleLaunchRdpProcess({event, credentials, width, height}) {
        return new Promise((resolve, reject) => {
            try {
                const websocketPort = PortHandler.GetAvailablePort();

                const args = [
                    '--target', credentials.ip,
                    '--user', credentials.username,
                    '--dom', credentials.domain,
                    '--pass', credentials.password,
                    '--width', width.toString(),
                    '--height', height.toString(),
                    '--ws_port', websocketPort
                ];

                const baseDir = app.isPackaged ? process.resourcesPath : this.__dirname;
                const mstscPath = path.join(
                    baseDir,
                    app.isPackaged ? 'app.asar.unpacked' : '',
                    'electros', 'remotes', 'rdp', 'mstsc-rs'
                );

                const spawnOptions = {
                    detached: this._platform.isMac() || this._platform.isLinux(),
                    env: process.env
                };

                const mstscProcess = spawn(mstscPath, args, spawnOptions);

                event.sender.mstscProcess = mstscProcess;
                event.sender.mstscPort = websocketPort;

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

                resolve({ success: true, ws_port: websocketPort });
            } catch (error) {
                console.error(error);
                PortHandler.ReleasePort(parseInt(event.sender.mstscPort));
                reject({ success: false, error: error.message });
            }
        });
    }

    handleCloseRdpProcess({eventSender = null, port = null}) {
        console.debug(`Clearing MSTSC process ${eventSender} ${port}`);
        if (port) { PortHandler.ReleasePort(parseInt(port)); }

        const proc = eventSender.mstscProcess;

        return new Promise((resolve, reject) => {
            try {
                if (this._platform.isWin()) {
                    this._killProcessOnWindows(proc);
                } else {
                    this._killProcessOnUnix(proc);
                }

                try {
                    this._killProcessDirectly(proc);
                } catch (e) {
                    console.warn(e);
                }

                eventSender.mstscProcess = null;
            } catch (e) {
                console.error("Error killing MSTSC Process: ", e);

                if (eventSender.mstscPort) {
                    PortHandler.ReleasePort(parseInt(eventSender.mstscPort));
                    eventSender.mstscPort = null;
                }

                eventSender.mstscPort = null;
                reject({ success: false, error: e });
            }

            resolve();
        });
    }

    _killProcessOnUnix(proc) {
        try {
            process.kill(-proc.pid, 'SIGTERM');
            setTimeout(() => {
                try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { }
            }, 1000);
        } catch (err) {
            if (err.code !== 'ESRCH') {
                console.warn('Process for MSTSC Could not be found, likely to be dead:', err);
            } else {
                throw err;
            }
        }
    }

    _killProcessOnWindows(proc) {
        spawn("taskkill", ["/pid", proc.pid.toString(), "/T", "/F"]);
    }

    _killProcessDirectly(proc) {
        try {
            if (!proc.killed) {
                proc.kill('SIGTERM');
                setTimeout(() => {
                    try { if (!proc.killed) { proc.kill('SIGKILL'); } } catch (e) {  }
                }, 1000);
            }
        } catch (err) {
            if (err.code !== 'ESRCH') {
                console.error('Error killing mstsc process directly:', err);
            } else {
                throw err;
            }
        }
    }

    _constructWindow() {
        if (this._window) {
            console.warn("RDP Window Singleton already instantiated");
            return;
        }

        this._window = new BrowserWindow({
            width: 1024,
            height: 768,
            ...WindowOptions.Common,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: path.join(this.__dirname, 'preload.js'),
                webSecurity: false,
                zoomFactor: 1,
                backgroundThrottling: false,
                enableRemoteModule: false,
                experimentalFeatures: false
            }
        });
    }

    _setupWindowEvents(connectionDetails) {
        if (this._window === null) {
            throw new Error("RDP Window not instantiated");
        }

        this._window.webContents.session.setCertificateVerifyProc((request, callback) => {
            callback(0);  // 0 means success
        });

        this._window.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
            event.preventDefault();
            callback(true);
        });

        this._window.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(true);
        });

        this._window.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            callback({ requestHeaders: { ...details.requestHeaders } });
        });

        this._window.webContents.on('did-finish-load', () => {
            const rdpTitlebarJS = this.PreloadedRes.Js.Titlebar.replace(
                'titleElement.textContent = document.title;',
                `titleElement.textContent = "RDP connection to ${connectionDetails.vmName}";`
            );
            this._window.webContents.executeJavaScript(rdpTitlebarJS);
        });

        this._window.on('close', async (event) => {
            try {
                event.preventDefault();
                if (!this._window.isDestroyed()) { this._window.webContents.send('window-close'); }

                if (this._window.webContents.mstscProcess) {
                    this.handleCloseRdpProcess(this._window.webContents).then(() => { }).catch(() => { });
                }

                await new Promise(resolve => setTimeout(resolve, 100));
                if (!this._window.isDestroyed()) { this._window.destroy(); }
                this._window = null;
            } catch (error) {
                console.error('Error during window cleanup:', error);
                if (!this._window.isDestroyed()) { this._window.destroy(); }
                this._window = null;
            }
        });
    }

    async _loadContent(connectionDetails) {
        if (this._window === null) {
            throw new Error("RDP Window not instantiated");
        }
        try {
            await this._window.loadFile('electros/remotes/rdp/index.html', {
                query: connectionDetails
            });
        } catch (error) {
            console.error('Error loading RDP window:', error);
            throw error;
        }
    }
}
