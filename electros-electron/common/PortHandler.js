
export class PortHandler {
    static _ActivePorts = new Set();
    static _NextPort = 49152;

    static GetAvailablePort () {
        while (this._ActivePorts.has(this._NextPort)) {
            this._NextPort++;
            if (this._NextPort > 65535) this._NextPort = 49152;
        }
        this._ActivePorts.add(this._NextPort);
        return this._NextPort++;
    }

    static ReleasePort (port) {
        this._ActivePorts.delete(port);
    }
}
