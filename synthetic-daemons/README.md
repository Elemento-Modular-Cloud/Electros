# Synthetic HTTP Client Daemons

Standalone mock servers that emulate Elemento **client daemons** on the ECD localhost ports. They track the production surface from `elemento-monorepo-client` (`daemons_0.2`) via a generated route catalog. Use them to run Electros without native `elemento_client_daemons` binaries.

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

Cloud targets are **centralised**. The target daemon does not mount local `/list` / `/create` CRUD. The source of truth is the in-memory portal:

- `GET /api/v1.0/client/target/grants/me`
- `GET /api/v1.0/client/target/connections/me`
- `GET /api/v1.0/client/target/connections/me/connections-status`
- Org-admin: `/org-targets`, `/target-grants`, `/scenarios`

Auth is portal-shaped on the same process: `/api/v1/authenticate/*` plus `/api/v1.0` orgs, membership, limits, invites, and subscriptions.

## Keeping pace with production (catalog)

The mounted production surface is checked in as [`catalog/production-routes.json`](catalog/production-routes.json). Regenerating it is the main evolution workflow:

```bash
# Point at your elemento-monorepo-client checkout (default: ../elemento-monorepo-client)
export ELEMENTO_MONOREPO_CLIENT=/path/to/elemento-monorepo-client
npm run sync:catalog
npm test
```

1. `sync:catalog` scrapes **mounted** FastAPI routers (`api_layer/router.py` includes only — middev `/list` stays out), Flask `@route` handlers, and MCP `custom_route`s.
2. `npm test` runs route inventory + **parity**: every catalog route must be reachable (handler or typed envelope). Application `404` for unknown IDs is fine; Express “Cannot METHOD …” is not.
3. New production routes → re-sync → red parity → add a real handler under `src/routes/**` or a typed override in `src/index.ts` / `src/envelopes/`.

Runtime mounting: smart routers first, then [`fillCatalogGaps`](src/mountFromCatalog.ts) registers every remaining catalog path with a MemoryStore handler override or a shallow envelope (replaces the old catch-all).

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

# Cloud targets (grants + active connections — not /list)
curl -s http://127.0.0.1:57777/api/v1.0/client/target/grants/me
curl -s http://127.0.0.1:57777/api/v1.0/client/target/connections/me
curl -s http://127.0.0.1:57777/api/v1.0/client/target/connections/me/connections-status
curl -s http://127.0.0.1:57777/api/v1.0/client/target/org-targets

# VM list
curl -s http://127.0.0.1:17777/api/v1.0/client/vm/status
curl -s http://127.0.0.1:17777/api/v1.0/client/vm/porttunnel/status
curl -s http://127.0.0.1:27777/api/v1.0/client/volume/accessible

# Networks
curl -s http://127.0.0.1:37777/api/v1.0/client/network/list

# Port forwards (VM expanded row)
curl -s http://127.0.0.1:37777/api/v1.0/client/network/portforwards
```

Then open Dashboard, Account, Organisation, Billing, **My Clouds**, VMs, Storage, Networking, and Settings → Licenses in Electros.

Default demo session: `demo@synthetic.local` / `demo`, role `ORGOWNER`, email verified, active **pro** subscriber of org **Elemento Demo**.

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
- Catalogued routes without a deep MemoryStore implementation return typed envelopes and log `[envelope]`.
- Deep backends (libvirt, Ceph, live VNC websockets, Stripe, IdP, real LLMs) are stubs.
- Unimplemented ECD routes fall through to catalog envelopes.

## Development

```bash
npm run sync:catalog # refresh catalog/production-routes.json from monorepo
npm run dev          # build + start
npm run build        # compile only
npm test             # build + route-inventory + catalog parity
npm run test:parity  # catalog coverage only
```

From `electros-electron`:

```bash
npm start -- --synthetic-daemons   # GUI + mocks together
npm run synthetic-daemons          # mocks only
```
