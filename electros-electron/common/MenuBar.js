import { Daemons } from "./Daemons";

export function BuildMenuTemplate(
    terminalWindow
) {
    return [
        {
            label: 'Electros',
            submenu:[
                {role: 'quit'}
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                {role: 'delete'},
                {type: 'separator'},
                {role: 'selectAll'}
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Terminal',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => {
                        if (terminalWindow) {
                            terminalWindow.isVisible() ? terminalWindow.hide() : terminalWindow.show();
                        }
                    }
                },
                {type: 'separator'},
                {role: 'resetZoom', zoomFactor: 0.8},
                {role: 'zoomIn'},
                {role: 'zoomOut'},
                {type: 'separator'},
                {role: 'togglefullscreen'}
            ]
        },
        {
            label: 'Developer',
            submenu:[
                {
                    label: 'Terminate Daemons',
                    click: async () => {
                        console.log("manual daemon termination triggered");
                        if(Daemons.Terminate()) {
                            if(Notification.isSupported()) {
                                new Notification({
                                    title: "Daemons Terminated",
                                    body: "Electros Client Daemons successfully terminated.",
                                    silent: true,
                                    icon: './electros.iconset/icon_256x256.png',
                                    urgency: 'low'
                                }).show();
                            }
                        } else {
                            if(Notification.isSupported()) {
                                new Notification({
                                    title: "Failed to Terminate Daemons",
                                    body: "Electros Client Daemons were not terminated.",
                                    silent: true,
                                    urgency: 'low'
                                }).show();
                            }
                        }
                    }
                },
                {label: 'Reload', role: 'reload'},
                {label: 'Toggle DevTools', role: 'toggleDevTools'},
                {label: 'Toggle Fullscreen', role: 'toggleFullScreen'},
                {label: 'Toggle Zoom', role: 'toggleZoom'},
            ]
        }
    ]
}

