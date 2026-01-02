const path = require('path');
const fs = require('fs');
const os = require('os');
const { ipcMain, dialog } = require('electron');

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

// Ensure backgrounds directory exists
if (!fs.existsSync(BACKGROUNDS_DIR)) {
    fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
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
                existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            } catch (e) {
                console.warn('Could not parse existing config, starting fresh');
            }
        }
        
        const mergedConfig = { ...existingConfig, ...config };
        const json = JSON.stringify(mergedConfig, null, 4);
        console.log('Writing config:', json);
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

// List background images from ~/.elemento/backgrounds/
ipcMain.handle('list-backgrounds', async () => {
    try {
        if (!fs.existsSync(BACKGROUNDS_DIR)) {
            fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(BACKGROUNDS_DIR);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
        });
        
        return imageFiles.map(file => {
            const filePath = path.join(BACKGROUNDS_DIR, file);
            return {
                name: file,
                path: filePath,
                // Use file:// URL for efficient loading of large images
                fileUrl: `file://${filePath}`
            };
        });
    } catch (error) {
        console.error('Error listing backgrounds:', error);
        return [];
    }
});

// Get background image - returns file:// URL for large images, base64 for small
ipcMain.handle('get-background-data', async (event, imagePath, forThumbnail = false) => {
    try {
        // Security: ensure the path is within the backgrounds directory
        const resolvedPath = path.resolve(imagePath);
        if (!resolvedPath.startsWith(BACKGROUNDS_DIR)) {
            throw new Error('Invalid path: must be within backgrounds directory');
        }
        
        if (!fs.existsSync(resolvedPath)) {
            return null;
        }
        
        const stats = fs.statSync(resolvedPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        // For thumbnails, use base64 only for small files (< 1MB)
        // For wallpaper display, always use file:// URL for efficiency
        if (forThumbnail && fileSizeInMB < 1) {
            const data = fs.readFileSync(resolvedPath);
            const ext = path.extname(resolvedPath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp'
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            return `data:${mimeType};base64,${data.toString('base64')}`;
        }
        
        // Return file:// URL for large images
        return `file://${resolvedPath}`;
    } catch (error) {
        console.error('Error reading background image:', error);
        return null;
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
        
        return {
            success: true,
            file: {
                name: fileName,
                path: destPath,
                fileUrl: `file://${destPath}`
            }
        };
    } catch (error) {
        console.error('Error importing background:', error);
        return { success: false, error: error.message };
    }
});

// Delete a background image
ipcMain.handle('delete-background', async (event, imagePath) => {
    try {
        // Security: ensure the path is within the backgrounds directory
        const resolvedPath = path.resolve(imagePath);
        if (!resolvedPath.startsWith(BACKGROUNDS_DIR)) {
            throw new Error('Invalid path: must be within backgrounds directory');
        }
        
        if (!fs.existsSync(resolvedPath)) {
            return { success: false, error: 'File not found' };
        }
        
        fs.unlinkSync(resolvedPath);
        return { success: true };
    } catch (error) {
        console.error('Error deleting background:', error);
        return { success: false, error: error.message };
    }
});

module.exports = {
    channels: ['read-config', 'write-config', 'read-hosts', 'write-hosts', 'list-backgrounds', 'get-background-data', 'import-background', 'delete-background']
};