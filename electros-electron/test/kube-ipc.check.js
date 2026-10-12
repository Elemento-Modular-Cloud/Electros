// Self-check for js/kube-ipc.js against a fake API server. Run: node test/kube-ipc.check.js
const assert = require('assert');
const http = require('http');
const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kube-ipc-'));

const handlers = {};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') {
        return {ipcMain: {handle: (c, f) => { handlers[c] = f; }}, dialog: {}};
    }
    return origLoad.call(this, request, ...rest);
};
require('../js/kube-ipc.js');

const seen = [];
const server = http.createServer((req, res) => {
    seen.push({url: req.url, auth: req.headers.authorization, accept: req.headers.accept, method: req.method});
    if (req.url === '/version') { return res.end(JSON.stringify({gitVersion: 'v1.35.0'})); }
    if (req.url === '/api/v1/namespaces/default/pods/x') {
        return res.end(JSON.stringify({kind: 'Pod', metadata: {name: 'x', managedFields: [1]}}));
    }
    res.statusCode = 403;
    res.end(JSON.stringify({kind: 'Status', message: 'pods is forbidden'}));
});

server.listen(0, async () => {
    const port = server.address().port;
    const kubeconfig = (user) => `apiVersion: v1
kind: Config
current-context: my ctx
contexts: [{name: my ctx, context: {cluster: c, user: u, namespace: team}}]
clusters: [{name: c, cluster: {server: "http://127.0.0.1:${port}/"}}]
users: [{name: u, user: ${user}}]
`;
    try {
        const name = await handlers['kube-import'](null, {content: kubeconfig('{token: abc}')});
        assert.strictEqual(name, 'my-ctx');
        assert.strictEqual(await handlers['kube-import'](null, {content: kubeconfig('{token: abc}')}), 'my-ctx-2');
        assert.strictEqual(await handlers['kube-import'](null, {name: 'my-ctx', content: kubeconfig('{token: abc}')}), 'my-ctx');

        const list = await handlers['kube-list']();
        assert.deepStrictEqual(list.map(k => k.name).sort(), ['my-ctx', 'my-ctx-2']);
        assert.strictEqual(list[0].namespace, 'team');

        const version = JSON.parse(await handlers['kube-request'](null, {name, path: '/version', accept: 'x/y'}));
        assert.strictEqual(version.gitVersion, 'v1.35.0');
        assert.strictEqual(seen.at(-1).auth, 'Bearer abc');
        assert.strictEqual(seen.at(-1).accept, 'x/y');

        const yaml = await handlers['kube-request'](null, {name, path: '/api/v1/namespaces/default/pods/x', asYaml: true});
        assert.match(yaml, /kind: Pod/);
        assert.doesNotMatch(yaml, /managedFields/);

        await assert.rejects(handlers['kube-request'](null, {name, path: '/nope'}), /403: pods is forbidden/);

        // exec credential plugin
        await handlers['kube-import'](null, {name: 'exec', content: kubeconfig(
            `{exec: {command: sh, args: ["-c", "echo '{\\"status\\":{\\"token\\":\\"from-exec\\"}}'"]}}`)});
        await handlers['kube-request'](null, {name: 'exec', path: '/version'});
        assert.strictEqual(seen.at(-1).auth, 'Bearer from-exec');

        await assert.rejects(handlers['kube-import'](null, {content: 'kind: Config'}), /no cluster server/);
        assert.throws(() => handlers['kube-delete'](null, {name: '../settings'}), /Invalid kubeconfig name/);
        handlers['kube-delete'](null, {name: 'my-ctx-2'});
        assert.strictEqual((await handlers['kube-list']()).length, 2);
        console.log('kube-ipc: all checks passed');
    } finally {
        server.close();
        fs.rmSync(process.env.HOME, {recursive: true, force: true});
    }
});
