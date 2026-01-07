import { Daemons } from "./Daemons.js";
import { Terminal } from "../windows/Terminal.js";
import {app, Notification} from "electron";


export function BuildMenuTemplate() {
    const baseMenu = [
        {
            label: 'Electros',
            submenu:[
                {role: 'quit'},
                {label: 'Reload', role: 'reload'},
                {
                    label: 'Toggle Terminal',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => { Terminal.ToggleVisibility(); }
                }
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
                {role: 'resetZoom', zoomFactor: 1},
                {role: 'zoomIn'},
                {role: 'zoomOut'},
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
                {label: 'Toggle Zoom', role: 'toggleZoom'},
            ]
        })
    }

    return baseMenu;
}

