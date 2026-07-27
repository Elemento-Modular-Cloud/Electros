import { Daemons } from "./Daemons.js";
import { Terminal } from "../windows/Terminal.js";
import {app, Notification} from "electron";


function notify(title, body, urgency = 'low') {
    if (!Notification.isSupported()) {
        return;
    }
    new Notification({title, body, silent: true, urgency}).show();
}


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

    if (!app.isPackaged || process.argv.includes("--enable-devtools")) {
        baseMenu.push({
            label: 'Developer',
            submenu:[
                {
                    label: 'Use Native Daemons',
                    accelerator: 'CmdOrCtrl+Shift+Alt+N',
                    click: async () => {
                        console.log("switch to native daemons triggered");
                        try {
                            await Daemons.LaunchNative();
                            notify("Native Daemons Started", "Switched to native client daemons.");
                        } catch (e) {
                            console.error("Failed to launch native daemons:", e);
                            notify("Failed to Launch Native Daemons", e?.message || "Could not start native daemons.", 'normal');
                        }
                    }
                },
                {
                    label: 'Use Synthetic Daemons',
                    accelerator: 'CmdOrCtrl+Shift+Alt+S',
                    click: async () => {
                        console.log("switch to synthetic daemons triggered");
                        try {
                            await Daemons.LaunchSynthetic();
                            notify("Synthetic Daemons Started", "Switched to synthetic-daemons (npm start).");
                        } catch (e) {
                            console.error("Failed to launch synthetic daemons:", e);
                            notify("Failed to Launch Synthetic Daemons", e?.message || "Could not start synthetic-daemons.", 'normal');
                        }
                    }
                },
                {
                    label: 'Terminate Daemons',
                    click: async () => {
                        console.log("manual daemon termination triggered");
                        if (Daemons.Terminate()) {
                            notify("Daemons Terminated", "Electros Client Daemons successfully terminated.");
                        } else {
                            notify("Failed to Terminate Daemons", "Electros Client Daemons were not terminated.", 'low');
                        }
                    }
                },
                {type: 'separator'},
                {label: 'Toggle DevTools', role: 'toggleDevTools'},
                {label: 'Toggle Fullscreen', role: 'toggleFullScreen'},
            ]
        })
    }

    return baseMenu;
}

