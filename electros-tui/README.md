# Electros TUI

Terminal UI with **full parity** to the Electros GUI, for SSH-only machines. Talks to the same localhost client daemons via the ECD REST contract ([`networking.json`](../elemento-gui-new/electros/ecd/networking.json), [`restkeys.json`](../elemento-gui-new/electros/ecd/restkeys.json)).

Built with **Go**, [Bubble Tea](https://github.com/charmbracelet/bubbletea), and lipgloss.

## Requirements

- Go 1.22+
- Client daemons **or** [synthetic-daemons](../synthetic-daemons/) for development
- Optional (strict 1:1 remote flows): `ssh`, `vncviewer` / TigerVNC, `xfreerdp`, `xdg-open` / `open`

## Quick start (with mock daemons)

One command — starts synthetic-daemons, waits for ports, launches the TUI:

```bash
cd electros-tui
chmod +x scripts/dev-with-mocks.sh scripts/verify-api.sh
./scripts/dev-with-mocks.sh
```

Manual two-terminal workflow:

```bash
# Terminal 1
cd synthetic-daemons && npm install && npm start

# Terminal 2
cd electros-tui
go run ./cmd/electros-tui --ecd-dir ../elemento-gui-new/electros/ecd
```

Default login against synthetic fixtures: any username/password (e.g. `demo` / `demo`).

## Build

```bash
go build -o bin/electros-tui ./cmd/electros-tui
./bin/electros-tui --help
```

## CLI flags

| Flag | Description |
|------|-------------|
| `--ecd-dir` | Path to ECD JSON (default: sibling `elemento-gui-new/electros/ecd`) |
| `--host` | Daemon host (default `127.0.0.1`) |
| `--path-prefix` | AtomOS reverse-proxy mode |
| `--atomos` | AtomOS local login (`/local_login`) |
| `--deeplink` | Open route on start (`electros://iaas/virtual-machines`) |
| `--no-color` | Plain terminal |
| `--skip-health` | Skip startup daemon health warning |

## Layout

The shell is divided into fixed regions:

- **Header bar** — brand, breadcrumb of the current route, `user@org` and a connection dot (green = daemons reachable).
- **Navigation panel** (left) — top-level sections; PaaS/SaaS injected from `supported_intents.json`.
- **Content panel** (center) — the current page: tables, forms, dashboards, details. The panel border carries the page title.
- **Electra AI panel** (right, toggle with `c` or `F2`) — MCP chat with scrollable history and pinned input. Auto-hides below 110 columns.
- **Status bar** — focus/mode chip (`NAV`/`LIST`/`FORM`/`CHAT`), notices/errors in the middle, contextual key hints on the right.

The focused panel is highlighted with an accent border. `Tab` cycles focus: sidebar → content → chat. Mouse clicks are supported when your terminal reports cell motion events.

| Mouse | Action |
|-------|--------|
| Click sidebar item | Navigate to section |
| Click table row | Select row |
| Double-click row | Open detail (where available) |
| Double-click section list | Open subpage |
| Click dashboard tabs | Switch metric panel |
| Scroll wheel on lists | Move selection |
| Click chat panel | Focus chat input |

## Navigation

Matches [`pages.json`](../elemento-gui-new/electros/configs/pages.json) plus dynamic PaaS/SaaS routes:

| Key | Action |
|-----|--------|
| `Tab` | Cycle focus: **sidebar** → **content** → **chat** |
| `j` / `k` | In sidebar: move menu; in content: move table/list rows |
| `Enter` | In sidebar: open section; in content: open detail / subpage; in chat: send |
| `b` / `Esc` | Back (in chat: leave chat) |
| `/` | Search pages (modal) |
| `:` | Go to route / deeplink (modal) |
| `r` | Refresh fleet data |
| `p` | Primary action (e.g. ping target, toggle VM power) |
| `s` | Same as `p` on VM lists (start/stop) |
| `x` | Delete selected row |
| `n` | New / create subpage |
| `d` | Open detail view |
| `v` | VNC (VM lists) |
| `c` / `F2` | Toggle Electra AI chat panel |
| `PgUp` / `PgDn` | Scroll chat history (when chat focused) |
| `l` | Logout |
| `?` | Help |
| `q` | Quit (from sidebar) |

Single-letter shortcuts are suppressed while a form field is capturing text.

### Pages covered

- **Dashboard** — six metric panels (overview, compute, storage, platform, targets, PaaS)
- **Cloud Targets** — list, detail, guided add (hypervisor or tethered cloud provider)
- **IaaS** — storage, cloud-init, networking, virtual machines, ephemeral VMs (lists + create forms)
- **Credentials** — experimental vault placeholder
- **Settings** — account, organisation, billing, licenses, preferences, appearance, info
- **Dev** — dashboard-modern, ui-demo, service testing (PaaS)

List views support context actions (`s` power toggle VMs, `x` delete, `v` VNC on VMs).

## Strict 1:1 remote access

| GUI feature | TUI behavior |
|-------------|--------------|
| VNC | Compute port-tunnel API → `vncviewer localhost:<port>` |
| RDP | Port tunnel → `xfreerdp` |
| SSH | Suspends TUI, runs system `ssh` |
| OAuth | Opens provider URL in browser (`settings/account`, key `a`) |
| Stripe | Opens payment URL (`settings/billing`, key `o`) |
| Agent chat | In-TUI MCP panel (`c`) |

When `$DISPLAY` is unset, VNC/RDP print SSH port-forward instructions instead of failing silently.

## API verification

```bash
./scripts/verify-api.sh
```

## SSH-only deployment

1. Copy `bin/electros-tui` to the remote host.
2. Ensure client daemons listen on ECD ports (or run synthetic-daemons for demos).
3. For graphical OAuth/VNC from SSH: use `-X` / `-Y` forwarding, or forward ports to your laptop.

Legacy hosts file: `~/.elemento/hosts` (Electron `read-hosts` equivalent).

## Synthetic limitations

- VNC tunnel from synthetic-daemons is a **placeholder** — live console needs real compute daemons.
- Electra AI chat requires a running MCP server on the ECD MCP port (`7782` by default).

## Project layout

```
electros-tui/
├── cmd/electros-tui/     # entrypoint
├── internal/
│   ├── api/              # REST clients (mirrors daemonsBridge)
│   ├── config/           # ECD loader
│   ├── host/             # browser/VNC/RDP/SSH subprocesses
│   ├── metrics/          # dashboard metrics port
│   ├── models/           # JSON models
│   ├── nav/              # pages.json router
│   ├── session/          # auth + fleet cache
│   └── ui/               # Bubble Tea app + views
└── scripts/
```
