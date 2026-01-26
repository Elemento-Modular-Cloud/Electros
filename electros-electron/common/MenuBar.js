import { Daemons } from "./Daemons.js";
import { Terminal } from "../windows/Terminal.js";
import {app, Notification} from "electron";


export function BuildMenuTemplate() {
    const baseMenu = [
        {
            label: 'Electros',
            submenu:[
                {label: 'Reload', role: 'reload'},
                {
                    label: 'Open Terminal',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => { Terminal.ToggleVisibility(); }
                },
                {type: "separator"},
                {role: "close"},
                {role: 'quit'},
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
                    label: 'Actual Size',
                    accelerator: 'CmdOrCtrl+0',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            browserWindow.webContents.setZoomFactor(1);
                        }
                    }
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            const currentZoom = browserWindow.webContents.getZoomFactor();
                            browserWindow.webContents.setZoomFactor(currentZoom + 0.1);
                        }
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            const currentZoom = browserWindow.webContents.getZoomFactor();
                            browserWindow.webContents.setZoomFactor(Math.max(0.1, currentZoom - 0.1));
                        }
                    }
                },
                {type: 'separator'},
                {role: 'togglefullscreen'}
            ]
        }
    ];

    if (!app.isPackaged) {
        baseMenu.push({
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
                {label: 'Toggle DevTools', role: 'toggleDevTools'},
                {label: 'Toggle Fullscreen', role: 'toggleFullScreen'},
            ]
        })
    }

    return baseMenu;
}

