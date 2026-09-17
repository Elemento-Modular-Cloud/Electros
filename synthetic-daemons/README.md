# Synthetic HTTP Client Daemons

Standalone mock servers that emulate Elemento **client daemons** on the ECD localhost ports. They simulate the in-memory **portal** that `access_client` and `target_client` now proxy to on `elemento-monorepo-client` `develop`. Use them to run Electros without native `elemento_client_daemons` binaries and without `portal.elemento.cloud`.

## Quick start

One-command demo (Electros spawns this package via `npm start`):

```bash
cd synthetic-daemons && npm install   # once
cd ../electros-electron
npm start -- --synthetic-daemons
```

Or from the Electros **Developer** menu: **Use Synthetic Daemons** (`CmdOrCtrl+Shift+Alt+S`) / **Use Native Daemons** (`CmdOrCtrl+Shift+Alt+N`) to switch at runtime.

### Manual (two terminals)

```bash
cd synthetic-daemons
npm install
npm start
```

In another terminal, launch Electros with daemons disabled:

```bash
cd electros-electron
npm start -- --no-daemons
```

Ensure [`elemento-gui-new/electros/configs/flags.json`](../elemento-gui-new/electros/configs/flags.json) has `"useLocalhost": true` (default).

## Ports (from ECD `networking.json`)

| Service   | Port  | Real daemon     |
|-----------|-------|-----------------|
| Auth      | 47777 | access_client   |
| Compute   | 17777 | matcher_client  |
| Storage   | 27777 | storage_client  |
| Network   | 37777 | network_client  |
| Targets   | 57777 | target_client   |
| Services  | 6777  | service_client  |
| MCP       | 7782  | mcp_client      |

API paths come from [`elemento-gui-new/electros/ecd/restkeys.json`](../elemento-gui-new/electros/ecd/restkeys.json).

Cloud targets are **centralised**. The target daemon no longer mounts local `/list` / `/create` CRUD. The source of truth is the in-memory portal:

- `GET /api/v1.0/client/target/grants/me`
- `GET /api/v1.0/client/target/connections/me` (active set, equivalent to `~/.elemento/cloud-targets`)
- Org-admin: `/org-targets`, `/target-grants`, `/scenarios`

Auth is portal-shaped on the same process: `/api/v1/authenticate/*` plus `/api/v1.0` orgs, membership, limits, invites, and subscriptions.

## CLI options

| Flag | Description |
|------|-------------|
| `--scenario=default` | Fixture set under `fixtures/<scenario>/` |
| `--persist-state` | Save mutable state to `/tmp/synthetic-daemons-state.json` |

## Verification checklist

```bash
# Health
curl -s http://127.0.0.1:47777
curl -s http://127.0.0.1:47777/version

# Portal session (splash / login / org switch)
curl -s http://127.0.0.1:47777/api/v1/authenticate/status
curl -s http://127.0.0.1:47777/api/v1/authenticate/scopes
curl -s http://127.0.0.1:47777/api/v1.0/orgs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/membership/tree
curl -s http://127.0.0.1:47777/api/v1.0/subscription/tiers

# Cloud targets (grants + active connections — not /list)
curl -s http://127.0.0.1:57777/api/v1.0/client/target/grants/me
curl -s http://127.0.0.1:57777/api/v1.0/client/target/connections/me
curl -s http://127.0.0.1:57777/api/v1.0/client/target/org-targets

# Workloads
curl -s http://127.0.0.1:17777/api/v1.0/client/vm/status
curl -s http://127.0.0.1:27777/api/v1.0/client/volume/accessible
curl -s http://127.0.0.1:37777/api/v1.0/client/network/list
curl -s http://127.0.0.1:7782/ping
```

Then open Dashboard, Account, Organisation, Billing, VMs, Storage, Networking, and Settings → Licenses in Electros.

**My Clouds** in the current Electros tree still calls `GET /list` / `POST /create` / `DELETE /delete/{id}`. Those routes are **not mounted** on the real target daemon (or here). That page will 404 until the GUI is moved onto grants/connections.

Default demo session: `demo@synthetic.local`, role `ORGOWNER`, email verified, active **pro** subscriber of org **Elemento Demo**.

## Default scenario

The `fixtures/default/` set includes:

- Portal identity: auth status, scopes, org tree, invites, account details, subscription tiers
- AtomOS, private Meson, Proxmox, ESXi, plus a **`meson_public` org-target per production provider**, all granted to the demo user and **activated** in `connections`
- **18 VMs** — mixed states, OS families/flavours, AtomOS (two hosts), Proxmox, and ESXi; each VM has a `serverurl` that matches an active cloud target
- **18 volumes / networks / port forwards / templates**
- Host status aggregates derived from the generated fleet
- **15 licenses** — armed, inactive, expired, and expiring-soon rows
- **168 PaaS/SaaS instances** (kaas, objectstorage, dbaas, n8n, openclaw, marketplace SaaS, plus WordPress / PrestaShop / Magento hosting)

Regenerate:

```bash
npm run generate:fixtures        # portal + targets + IaaS + PaaS + licenses
npm run generate:portal-fixtures
npm run generate:targets-fixtures
npm run generate:iaas-fixtures
```

**Atomosphere / PaaS:** `GET /api/v1.0/client/target/configs/supported_providers` serves the real [`ecd/supported_providers.json`](../elemento-gui-new/electros/ecd/supported_providers.json) catalog. `POST /service/{type}/cancreate` uses **active** meson targets from `connections/me`.

With [`flags.json`](../elemento-gui-new/electros/configs/flags.json) `"enableAllMesonProviders": true` (default for local dev), Electros registers every production tethered provider on startup so PaaS pages appear without manual setup.

`kops` has no `table_layout` in ECD (no list UI). `blockstorage` is provider-only and not defined in `supported_intents` (not a PaaS nav page).

Nav registration still follows production providers with `support_level: full` (kaas, objectstorage, dbaas). Marketplace SaaS apps (n8n, openclaw, Open WebUI, Hermes, LiteLLM, LM Studio, MinIO, SearXNG, NPM, Caddy CA, n8n Runner) plus hosting (WordPress, PrestaShop, Magento) are offered on Google / Azure / UpCloud.

## MCP

`GET /ping` returns `{ ok: true, service: "electros-mcp", status: "up" }`. LLM routes (`/proxy/llm/*`, `/electros/confirm-mode`, `/electros/mitl-test`) return canned envelopes. No real model is called.

## Limitations

- Unimplemented ECD routes still return safe empty defaults and log a warning (see server console).
- Deep backends (libvirt, Ceph, VNC websockets, Stripe, IdP, real LLMs) are envelope stubs.
- Register / account / org / billing **do not** call `portal.elemento.cloud`.
- Current Electros My Clouds remains on the unmounted `/list` CRUD API.

## Development

```bash
npm run dev          # build + start
npm run build        # compile only
npm test             # build + route-inventory smoke checks
```

From `electros-electron`:

```bash
npm start -- --synthetic-daemons   # GUI + mocks together
npm run synthetic-daemons          # mocks only
```
