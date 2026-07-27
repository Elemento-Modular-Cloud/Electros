# Synthetic HTTP Client Daemons

Standalone mock servers that emulate Elemento **client daemons** on the ECD localhost ports. Use them to run the Electros UI without native `elemento_client_daemons` binaries.

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

| Service   | Port  |
|-----------|-------|
| Auth      | 47777 |
| Compute   | 17777 |
| Storage   | 27777 |
| Network   | 37777 |
| Targets   | 57777 |
| Services  | 6777  |
| MCP       | 7782  |

API paths come from [`elemento-gui-new/electros/ecd/restkeys.json`](../elemento-gui-new/electros/ecd/restkeys.json).

## CLI options

| Flag | Description |
|------|-------------|
| `--scenario=default` | Fixture set under `fixtures/<scenario>/` |
| `--persist-state` | Save mutable state to `/tmp/synthetic-daemons-state.json` |

## Verification checklist

```bash
# Health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:47777

# Auth status (splash / login)
curl -s http://127.0.0.1:47777/api/v1/authenticate/status

# Licenses (Settings → Licenses)
curl -s http://127.0.0.1:47777/api/v1/authenticate/license/list

# VM list
curl -s http://127.0.0.1:17777/api/v1.0/client/vm/status

# Targets
curl -s http://127.0.0.1:57777/api/v1.0/client/target/list

# Volumes
curl -s http://127.0.0.1:27777/api/v1.0/client/volume/accessible

# Networks
curl -s http://127.0.0.1:37777/api/v1.0/client/network/list

# Port forwards (VM expanded row)
curl -s http://127.0.0.1:37777/api/v1.0/client/network/portforwards
```

Then open Dashboard, My Clouds, VMs, Storage, Networking, and Settings → Licenses in Electros.

## Default scenario

The `fixtures/default/` set includes:

- AtomOS, Meson (OVH / Scaleway demo names), Proxmox targets
- **18 VMs** — mixed states, OS families/flavours, AtomOS (two hosts), Proxmox, and ESXi; each VM has a `serverurl` that matches a My Clouds target so the **Hypervisor** column renders correct tagchips
- **18 volumes** — formats, buses, sizes, privacy/bootable flags; ~half of VMs mount 1–2 disks
- **18 networks** — libvirt bridge/NAT, tailscale, shared (DHCP hosts on NAT rows)
- **18 port forwards** — TCP/UDP, tailscale/force flags, wired to synthetic VM UUIDs
- **18 VM templates** — CPU/RAM/GPU combinations
- Host status aggregates derived from the generated fleet
- **15 licenses** — armed, inactive, expired, and expiring-soon rows for Settings → Licenses (`GET/POST /api/v1/authenticate/license/*`)

Regenerate IaaS + PaaS + licenses fixtures:

```bash
npm run generate:fixtures        # both
npm run generate:iaas-fixtures   # VMs, storage, networking only
```

Network API coverage: list, info, create (libvirt/tailscale JSON from `NetworkModel.toJson()`), delete, port-forward CRUD, export stubs. Mutations update in-memory state for the process lifetime.

**Atomosphere / PaaS:** `GET /api/v1.0/client/target/configs/supported_providers` serves the real [`ecd/supported_providers.json`](../elemento-gui-new/electros/ecd/supported_providers.json) catalog. Default targets include a **`meson_public` target per production provider** (google, azure, ovh, upcloud, wasabi, scaleway, impossiblecloud, oracle).

With [`flags.json`](../elemento-gui-new/electros/configs/flags.json) `"enableAllMesonProviders": true` (default for local dev), Electros registers every production tethered provider on startup so PaaS pages appear without manual setup.

**PaaS service instances** (NDJSON on `GET /api/v1.0/client/service/{sub_type}/running`), aligned with [`supported_intents.json`](../elemento-gui-new/electros/ecd/supported_intents.json):

| `sub_type` (API path) | UI page | Fixture rows |
|----------------------|---------|--------------|
| `kaas` | Managed Kubernetes | **18** (providers × regions × versions × statuses) |
| `objectstorage` | Object Storage | **18** (7 provider endpoint styles × regions × sizes) |
| `dbaas` | Database | **18** (4 engines × regions × node counts × disk sizes) |
| `n8n` | n8n workflow Automation | **18** |
| `openclaw` | OpenCLAW | **18** |

Regenerate with `npm run generate:paas-fixtures` (see `scripts/generate-paas-fixtures.mjs`). After changing fixtures, restart synthetic-daemons and remove `/tmp/synthetic-daemons-state.json` if you used `--persist-state`.

`kops` has no `table_layout` in ECD (no list UI). `blockstorage` is provider-only and not defined in `supported_intents` (not a PaaS nav page).

Nav registration still follows production providers with `support_level: full` (kaas, objectstorage, dbaas). **n8n** and **openclaw** need experimental features enabled in Electros, or they only appear as mock data when those routes are registered.

Also mocked: `cancreate`, `create`, `delete`, `credentials`, and `GET /api/v1/authenticate/billing/my/transactions`.

## Limitations

- **`TargetDaemons.getLegacyHosts`** uses Electron IPC (`read-hosts`), not HTTP — returns empty outside Electron host file setup.
- **`registerUser`** still calls `portal.elemento.cloud` on the real internet.
- Unimplemented ECD routes return safe empty defaults and log a warning (see server console).

## Development

```bash
npm run dev          # build + start
npm run build        # compile only
```

From `electros-electron`:

```bash
npm start -- --synthetic-daemons   # GUI + mocks together
npm run synthetic-daemons          # mocks only
```
