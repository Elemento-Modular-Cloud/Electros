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

// Download and save an image from URL to backgrounds folder
ipcMain.handle('save-background-from-url', async (event, imageUrl, filename) => {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    try {
        const originalUrl = imageUrl;
        
        // For Wikimedia URLs, try to get the full resolution image instead of thumbnail
        if (imageUrl.includes('upload.wikimedia.org') && imageUrl.includes('/thumb/')) {
            // Convert thumbnail URL to full resolution
            // Example: .../thumb/a/a0/File.jpg/1920px-File.jpg -> .../a/a0/File.jpg
            // Pattern: /commons/thumb/[hash]/[hash]/[filename]/[size]px-[filename]
            try {
                const urlObj = new URL(imageUrl);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                
                // Find 'thumb' in the path
                const thumbIndex = pathParts.indexOf('thumb');
                if (thumbIndex !== -1 && pathParts.length > thumbIndex + 3) {
                    // Remove 'thumb' and the last segment (size-prefixed filename)
                    pathParts.splice(thumbIndex, 1); // Remove 'thumb'
                    pathParts.pop(); // Remove the last segment (e.g., "1920px-File.jpg")
                    
                    // Reconstruct URL
                    urlObj.pathname = '/' + pathParts.join('/');
                    imageUrl = urlObj.toString();
                }
            } catch (e) {
                console.warn('Failed to convert Wikimedia URL, using original:', e);
                // Keep original URL if conversion fails
            }
        }
        
        // Generate filename if not provided
        if (!filename) {
            const urlParts = imageUrl.split('/');
            filename = urlParts[urlParts.length - 1].split('?')[0];
            // Remove size prefix like "1920px-"
            filename = filename.replace(/^\d+px-/, '');
        }
        
        // Ensure unique filename
        let destPath = path.join(BACKGROUNDS_DIR, filename);
        let counter = 1;
        const ext = path.extname(filename);
        const baseName = path.basename(filename, ext);
        
        while (fs.existsSync(destPath)) {
            destPath = path.join(BACKGROUNDS_DIR, `${baseName}_${counter}${ext}`);
            counter++;
        }
        
        // Download the image with proper headers
        const urlObj = new URL(imageUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        // Wikimedia-compliant User-Agent per https://w.wiki/4wJS
        const userAgent = 'Electros/1.0 (https://elemento.cloud/electros.html; hello@elemento.cloud)';
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'From': 'hello@elemento.cloud'
            }
        };
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            
            const makeRequest = (url, isRedirect = false) => {
                const urlToUse = isRedirect ? new URL(url) : urlObj;
                const opts = {
                    hostname: urlToUse.hostname,
                    path: urlToUse.pathname + urlToUse.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': userAgent,
                        'From': 'hello@elemento.cloud'
                    }
                };
                
                const req = protocol.request(opts, (response) => {
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                        file.close();
                        fs.unlinkSync(destPath);
                        const redirectUrl = response.headers.location;
                        if (redirectUrl) {
                            // Handle relative redirects
                            const absoluteUrl = redirectUrl.startsWith('http') 
                                ? redirectUrl 
                                : `${urlToUse.protocol}//${urlToUse.hostname}${redirectUrl}`;
                            makeRequest(absoluteUrl, true);
                        } else {
                            reject({ success: false, error: 'Redirect without location header' });
                        }
                        return;
                    }
                    
                    // Check if response is actually an image
                    const contentType = response.headers['content-type'];
                    if (contentType && !contentType.startsWith('image/')) {
                        file.close();
                        fs.unlinkSync(destPath);
                        
                        // If we tried to convert to full res and got HTML, fall back to original thumbnail URL
                        if (originalUrl !== imageUrl && contentType.includes('text/html')) {
                            console.log('Full resolution URL returned HTML, falling back to thumbnail URL');
                            // Retry with original thumbnail URL
                            const originalUrlObj = new URL(originalUrl);
                            const originalOpts = {
                                hostname: originalUrlObj.hostname,
                                path: originalUrlObj.pathname + originalUrlObj.search,
                                method: 'GET',
                                headers: {
                                    'User-Agent': userAgent,
                                    'From': 'contacto@elemento.cloud'
                                }
                            };
                            
                            const originalReq = protocol.request(originalOpts, (originalResponse) => {
                                if (originalResponse.statusCode >= 200 && originalResponse.statusCode < 300) {
                                    originalResponse.pipe(file);
                                    file.on('finish', () => {
                                        file.close();
                                        resolve({
                                            success: true,
                                            file: {
                                                name: path.basename(destPath),
                                                path: destPath,
                                                fileUrl: `file://${destPath}`
                                            }
                                        });
                                    });
                                } else {
                                    reject({ success: false, error: `Failed to download: ${originalResponse.statusCode}` });
                                }
                            });
                            
                            originalReq.on('error', (err) => {
                                if (fs.existsSync(destPath)) {
                                    file.close();
                                    fs.unlinkSync(destPath);
                                }
                                reject({ success: false, error: err.message });
                            });
                            
                            originalReq.end();
                            return;
                        }
                        
                        // Log the URL for debugging
                        console.error('Failed to download image. URL:', urlToUse.href);
                        console.error('Content-Type:', contentType);
                        console.error('Status Code:', response.statusCode);
                        reject({ success: false, error: `Expected image, got ${contentType}. URL may be incorrect.` });
                        return;
                    }
                    
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve({
                            success: true,
                            file: {
                                name: path.basename(destPath),
                                path: destPath,
                                fileUrl: `file://${destPath}`
                            }
                        });
                    });
                });
                
                req.on('error', (err) => {
                    if (fs.existsSync(destPath)) {
                        file.close();
                        fs.unlinkSync(destPath);
                    }
                    reject({ success: false, error: err.message });
                });
                
                req.end();
            };
            
            makeRequest(imageUrl);
        });
    } catch (error) {
        console.error('Error saving background from URL:', error);
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
    channels: ['read-config', 'write-config', 'read-hosts', 'write-hosts', 'list-backgrounds', 'get-background-data', 'import-background', 'save-background-from-url', 'delete-background']
};