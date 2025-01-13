const fs = require('fs');
const path = require('path');

// Get the user's home directory for storing configs
const homeDir = process.env.HOME || process.env.USERPROFILE;
const configDir = path.join(homeDir, '.elemento');
const configPath = path.join(configDir, 'settings');
const hostsPath = path.join(configDir, 'hosts');

function createPopup(options = {}) {
    console.log(options);

    nw.Window.open(url = options.url, options = {
        width: options.width || 800,
        height: options.height || 600,
        frame: true,
        title: options.title || 'Popup',
        resizable: true
    });
}

class ConfigManager {
    loadConfigurations() {
        console.log('Loading configurations from path: ', configDir);
        try {
            // Ensure config directory exists
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Read config file - parse as {config: {...}}
            const config = fs.existsSync(configPath) 
                ? JSON.parse(fs.readFileSync(configPath, 'utf8')) 
                : {};

            // Read hosts file - parse as newline-separated string
            const hosts = fs.existsSync(hostsPath)
                ? fs.readFileSync(hostsPath, 'utf8').split('\n').filter(line => line.trim())
                : [];

            return {
                config,
                hosts
            };
        } catch (error) {
            console.error('Error loading configurations:', error);
            return {
                config: {},
                hosts: []
            };
        }
    }

    writeConfig(config) {
        console.log('Writing config');
        try {
            // Wrap config in {config: {...}} structure
            fs.writeFileSync(configPath, JSON.stringify({ config }, null, 4));
            return true;
        } catch (error) {
            console.error('Error writing config:', error);
            return false;
        }
    }

    writeHosts(hosts) {
        try {
            // Write hosts as newline-separated string
            fs.writeFileSync(hostsPath, hosts.join('\n'));
            return true;
        } catch (error) {
            console.error('Error writing hosts:', error);
            return false;
        }
    }
}

// Export both the ConfigManager instance and createPopup function
module.exports = {
    configManager: new ConfigManager(),
    createPopup
};
