import * as os from "node:os";
// import { execSync } from "node:child_process";


/**
 * @summary Utility class that has the current OS platform.
 *
 * @author srobaldo <srobaldo@elemento.cloud>
 */
export class Platform {
    os = os.platform();
    arch = os.arch();

    constructor() {
        if (this.os === 'darwin') {
            this.os = 'mac';
        } else if (this.os === 'linux') {
            this.os = 'linux';
        } else if (this.os.includes('win')) {
            this.os = 'win';
        }

        if (this.arch.toLowerCase() === 'x86' || this.arch.toLowerCase() === 'x64') {
            this.arch = 'x64';
        }
    }

    /**
     * Checks if the Current OS is `win`
     *
     * @return {boolean}
     */
    isWin() {
        return this.os === 'win';
    }

    /**
     * Checks if the Current OS is `mac` (darwin)
     * @return {boolean}
     */
    isMac() {
        return this.os === 'mac';
    }

    /**
     * Checks if the Current OS is `linux`
     * @return {boolean}
     */
    isLinux() {
        return this.os === 'linux';
    }

    /**
     * Checks if the Current OS is either `linux`, `mac` or `darwin`
     * @return {boolean}
     */
    isUnix() {
        return this.isLinux() || this.isMac();
    }

    /**
     * Checks if the Current OS is neither UNIX nor Windows.
     * @return {boolean}
     */
    isUndefined() {
        return (!this.isWin()) && (!this.isUnix());
    }

    /**
     * Checks through DBus if the OS supports Tray Icons
     * @return {boolean}
     */
    dbusHasTraySupport() {
        if (!this.isLinux()) {
            return true;
        }

        return false;

        // method doesn't always work, cannot be trusted; assuming that all Linux distros don't have Tray Icons to
        // avoid making a permanent backg. process.
        // @author srobaldo <srobaldo@elemento.cloud>

        // try {
        //     execSync(
        //         "dbus-send --session --dest=org.freedesktop.DBus" +
        //         "--type=method_call /org/freedesktop/DBus" +
        //         "org.freedesktop.DBus.NameHasOwner" +
        //         "string:org.kde.StatusNotifierWatcher",
        //         { stdio: "ignore" }
        //     );
        //
        //     return true;
        // } catch (e) {
        //     return false;
        // }
    }
}
