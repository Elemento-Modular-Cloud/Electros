const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, ...args) => {
        const validChannels = ['read-config', 'write-config', 'read-hosts', 'write-hosts'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    },
    createPopup: (options) => ipcRenderer.invoke('create-popup', options)
}); 