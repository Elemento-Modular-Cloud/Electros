import * as os from "node:os";

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
}
