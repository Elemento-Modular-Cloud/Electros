const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, ...args) => {
        const validChannels = [
            'read-config', 
            'write-config', 
            'read-hosts', 
            'write-hosts', 
            'minimize-window', 
            'open-ssh',
            'maximize-window', 
            'close-window', 
            'toggle-full-screen',
            'open-rdp',
            'launch-rdp-process',
            'cleanup-rdp-process',
            'check-port',
            'os-prefers-dark-theme',
            'os-prefers-reduced-transparency',
            'open-browser'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    },
    createPopup: (options) => ipcRenderer.invoke('create-popup', options),
    ipcRenderer: {
        send: (channel, ...args) => {
            const validChannels = ['open-rdp'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, ...args);
            }
        },
        on: (channel, callback) => {
            const validChannels = ['window-close', 'rdp-process-closed'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, callback);
            }
        }
    }

}); 