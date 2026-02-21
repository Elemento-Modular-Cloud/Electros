import { Tray, nativeImage, nativeTheme, Menu, app } from 'electron';
import path from 'path';
import {Terminal} from "../windows/Terminal.js";


export class TrayIcon {
    get tray() { return this._tray; }

    _tray = null;

    /**
     *
     * @param {Platform} platform
     * @param {string} __dirname
     * @return {TrayIcon}
     */
    constructor(platform, __dirname) {
        this._tray = new Tray(this._getIcon(platform, __dirname));

        nativeTheme.on('updated', () => {
            this._tray.setImage(this._getIcon(platform, __dirname));
        });

        this._tray.setToolTip('Electros Daemons');
        this._tray.setContextMenu(this._getMenu());
    }

    _getIcon(platform, __dirname) {
        const isLight = nativeTheme.shouldUseDarkColors;
        console.log(`The theme is light: ${isLight}`);

        if (platform.isMac()) {
            const templateIcon = path.join(__dirname, 'electros.iconset', 'tray_icon_black_32x32@2x.png');
            const icon = nativeImage.createFromPath(templateIcon);
            icon.setTemplateImage(true);
            return icon;
        }

        if (platform.isWin()) {
            const iconName = path.join(__dirname, 'electros.iconset', 'tray_icon.ico');
            return nativeImage.createFromPath(iconName);
        }

        if (platform.isLinux()) {
            const iconName = path.join(__dirname, 'electros.iconset', 'tray_icon.png');
            const icon = nativeImage.createFromPath(iconName);
            return icon;
        }
    }

    _getMenu() {
        return Menu.buildFromTemplate([
            {
                label: 'Toggle Terminal',
                click: () => {
                    Terminal.ToggleVisibility();
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);
    }
}


/*

let tray = null;

function createTrayIcon() {

}


 */
