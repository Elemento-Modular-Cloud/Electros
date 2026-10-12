const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const {execFile} = require('child_process');
const {ipcMain, dialog} = require('electron');
const yaml = require('js-yaml');

// Kubeconfigs added from the app are kept here, one file per cluster, so they survive restarts.
const KUBE_DIR = path.join(os.homedir(), '.elemento', 'kubeconfigs');

function kubeconfigPath(name) {
    if (!/^[\w.-]+$/.test(name)) {
        throw new Error(`Invalid kubeconfig name: ${name}`);
    }
    return path.join(KUBE_DIR, `${name}.yaml`);
}

function sanitizeName(name) {
    return String(name).replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '') || 'cluster';
}

// Resolves cluster/user of the current context, as kubectl does.
function resolveContext(config) {
    const contextName = config?.['current-context'] || config?.contexts?.[0]?.name;
    const context = config?.contexts?.find(c => c.name === contextName)?.context ?? {};
    const cluster = config?.clusters?.find(c => c.name === context.cluster)?.cluster;
    const user = config?.users?.find(u => u.name === context.user)?.user ?? {};

    if (!cluster?.server) {
        throw new Error('The kubeconfig has no cluster server for its current context');
    }
    return {context: contextName, namespace: context.namespace ?? 'default', cluster, user};
}

function loadKubeconfig(name) {
    return resolveContext(yaml.load(fs.readFileSync(kubeconfigPath(name), 'utf8')));
}

// `<key>-data` is base64 inline content, `<key>` is a path on disk.
function dataOrFile(entry, key) {
    if (entry[`${key}-data`]) {
        return Buffer.from(entry[`${key}-data`], 'base64');
    }
    return entry[key] ? fs.readFileSync(entry[key]) : undefined;
}

// ponytail: exec credentials cached in memory until they expire; plugins not on the GUI app's PATH won't be found.
const execCache = new Map();

function execCredential(name, exec) {
    const cached = execCache.get(name);
    if (cached && (!cached.expirationTimestamp || Date.parse(cached.expirationTimestamp) > Date.now() + 30000)) {
        return Promise.resolve(cached);
    }

    const env = {...process.env};
    (exec.env ?? []).forEach(e => { env[e.name] = e.value; });

    return new Promise((resolve, reject) => {
        execFile(exec.command, exec.args ?? [], {env, timeout: 30000}, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Credential plugin '${exec.command}' failed: ${stderr || error.message}`));
            }
            const status = JSON.parse(stdout).status ?? {};
            execCache.set(name, status);
            resolve(status);
        });
    });
}

async function kubeRequest(name, {
    method = 'GET', path: apiPath, body, contentType = 'application/json', accept = 'application/json', asYaml = false
}) {
    const {cluster, user} = loadKubeconfig(name);

    let cert = dataOrFile(user, 'client-certificate');
    let key = dataOrFile(user, 'client-key');
    let token = user.token ?? (user.tokenFile ? fs.readFileSync(user.tokenFile, 'utf8').trim() : undefined);

    if (user.exec) {
        const status = await execCredential(name, user.exec);
        token = status.token ?? token;
        cert = status.clientCertificateData ?? cert;
        key = status.clientKeyData ?? key;
    }

    const headers = {Accept: accept};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    } else if (user.username) {
        headers.Authorization = `Basic ${Buffer.from(`${user.username}:${user.password ?? ''}`).toString('base64')}`;
    }
    if (body !== undefined) {
        headers['Content-Type'] = contentType;
    }

    const url = new URL(cluster.server.replace(/\/$/, '') + apiPath);
    const transport = url.protocol === 'http:' ? http : https;

    const response = await new Promise((resolve, reject) => {
        const req = transport.request(url, {
            method,
            headers,
            ca: dataOrFile(cluster, 'certificate-authority'),
            cert,
            key,
            servername: cluster['tls-server-name'],
            rejectUnauthorized: !cluster['insecure-skip-tls-verify'],
            timeout: 20000,
        }, res => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({status: res.statusCode, body: data}));
        });
        req.on('timeout', () => req.destroy(new Error('Request to the cluster timed out')));
        req.on('error', reject);
        if (body !== undefined) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });

    if (response.status >= 400) {
        let message = response.body;
        try { message = JSON.parse(response.body).message ?? message; } catch { /* plain text error */ }
        throw new Error(`${response.status}: ${message}`);
    }

    if (asYaml) {
        const object = JSON.parse(response.body);
        delete object.metadata?.managedFields;
        return yaml.dump(object, {lineWidth: -1});
    }
    return response.body;
}

ipcMain.handle('kube-list', () => {
    if (!fs.existsSync(KUBE_DIR)) {
        return [];
    }

    return fs.readdirSync(KUBE_DIR)
        .filter(file => file.endsWith('.yaml'))
        .map(file => {
            const name = file.slice(0, -'.yaml'.length);
            try {
                const {context, namespace, cluster} = loadKubeconfig(name);
                return {name, context, namespace, server: cluster.server};
            } catch (error) {
                return {name, error: error.message};
            }
        });
});

// Saves `content` under `name` (overwriting), or asks the user for a kubeconfig file when no content is given.
ipcMain.handle('kube-import', async (event, {name, content} = {}) => {
    const overwrite = name !== undefined;

    if (content === undefined) {
        const result = await dialog.showOpenDialog({
            title: 'Select a kubeconfig',
            defaultPath: path.join(os.homedir(), '.kube'),
            properties: ['openFile', 'showHiddenFiles'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        content = fs.readFileSync(result.filePaths[0], 'utf8');
    }

    const {context} = resolveContext(yaml.load(content));
    let finalName = sanitizeName(name ?? context);
    for (let i = 2; !overwrite && fs.existsSync(kubeconfigPath(finalName)); i++) {
        finalName = `${sanitizeName(name ?? context)}-${i}`;
    }

    fs.mkdirSync(KUBE_DIR, {recursive: true, mode: 0o700});
    fs.writeFileSync(kubeconfigPath(finalName), content, {encoding: 'utf8', mode: 0o600});
    execCache.delete(finalName);
    return finalName;
});

ipcMain.handle('kube-delete', (event, {name}) => {
    fs.rmSync(kubeconfigPath(name), {force: true});
    execCache.delete(name);
    return true;
});

ipcMain.handle('kube-request', (event, {name, ...request}) => kubeRequest(name, request));

module.exports = {
    channels: ['kube-list', 'kube-import', 'kube-delete', 'kube-request'],
};
