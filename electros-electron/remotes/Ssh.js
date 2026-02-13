import {app, BrowserWindow, ipcMain} from "electron";
import path from "path";
import {WindowOptions} from "../common/WindowOptions.js";
import {PortHandler} from "../common/PortHandler.js";


class SshWindow {
    /** @type {Array<BrowserWindow>} */
    _windows = [];

    constructor(PreloadedRes, platform, __dirname) {
        this._preloaded = PreloadedRes;
        this._platform = platform;
        this.__dirname = __dirname;
    }

    _constructWindow() {
        const sshWindow = new BrowserWindow({
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

        sshWindow.webContents.setVisualZoomLevelLimits(1, 1);
    }

    _setupSsh() {
        const port = PortHandler.GetAvailablePort();

        try {
            const baseDir = app.isPackaged ? process.resourcesPath : this.__dirname;
            const sshPath = path.join(
                baseDir, app.isPackaged ? 'app.asar.unpacked' : '',
                'elemento-gui-new', 'electros', 'remotes', 'ssh', 'ssh.cjs'
            );


        }
    }
}




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

    sshWindow.webContents.setVisualZoomLevelLimits(1, 1);

    let ssh_port = undefined;

    try {


        // Start the SSH server process
        const sshServer = require(sshPath);
        await sshServer.runSSHServer(ssh_port, baseDir);

        event.sender.ssh_port = ssh_port;

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

