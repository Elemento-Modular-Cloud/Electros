const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain, dialog } = require('electron');
const sharp = require('sharp');

// File paths
const CONFIG_DIR = path.join(os.homedir(), '.elemento');
const CONFIG_PATH = path.join(CONFIG_DIR, 'settings');
const HOSTS_PATH = path.join(CONFIG_DIR, 'hosts');
const BACKGROUNDS_DIR = path.join(CONFIG_DIR, 'backgrounds');

// Supported image extensions
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

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
        // Read existing config first and merge to preserve fields not in the update
        let existingConfig = {};
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
                const parsed = JSON.parse(fileContent);
                // Handle both flat config and nested {config: {...}} structure
                existingConfig = parsed.config || parsed;
            } catch (e) {
                console.warn('Could not parse existing config, starting fresh');
            }
        }
        
        // Merge configs - new config values override existing ones
        const mergedConfig = { ...existingConfig, ...config };
        
        // CRITICAL: Always use templates from the new config if it's provided
        // This ensures templates are saved even if they're an empty array
        if ('templates' in config) {
            mergedConfig.templates = Array.isArray(config.templates) ? config.templates : [];
            console.log('Templates in incoming config:', config.templates);
            console.log('Templates being saved:', mergedConfig.templates);
        } else {
            // If templates not in new config, preserve existing templates
            console.log('No templates in incoming config, preserving existing:', existingConfig.templates);
        }
        
        const json = JSON.stringify(mergedConfig, null, 4);
        console.log('Writing config to', CONFIG_PATH);
        console.log('Full config being written (first 1000 chars):', json.substring(0, 1000) + (json.length > 1000 ? '...' : ''));
        console.log('Templates in final mergedConfig:', JSON.stringify(mergedConfig.templates, null, 2));
        fs.writeFileSync(CONFIG_PATH, json, 'utf8');
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

// Import a background image via file dialog
ipcMain.handle('import-background', async (event) => {
    try {
        const result = await dialog.showOpenDialog({
            title: 'Select Wallpaper Image',
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
            ],
            properties: ['openFile']
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        
        const sourcePath = result.filePaths[0];
        const fileName = path.basename(sourcePath);
        const destPath = path.join(BACKGROUNDS_DIR, fileName);
        
        // Copy the file to backgrounds directory
        fs.copyFileSync(sourcePath, destPath);
        
        // Convert to WebP (async, non-blocking)
        const webpPath = await convertToWebP(destPath);
        
        // Use WebP path if conversion succeeded, otherwise use original
        const finalPath = webpPath || destPath;
        const finalFileName = path.basename(finalPath);
        
        return {
            success: true,
            file: {
                name: finalFileName,
                path: finalPath,
                fileUrl: `file://${finalPath}`
            }
        };
    } catch (error) {
        console.error('Error importing background:', error);
        return { success: false, error: error.message };
    }
});

module.exports = {
    channels: ['read-config', 'write-config', 'read-hosts', 'write-hosts']
};