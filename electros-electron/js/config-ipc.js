const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain } = require('electron');

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

module.exports = {
    channels: ['read-config', 'write-config', 'read-hosts', 'write-hosts']
};