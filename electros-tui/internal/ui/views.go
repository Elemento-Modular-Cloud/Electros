package ui

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"

	"electros-tui/internal/api"
	"electros-tui/internal/host"
	"electros-tui/internal/metrics"
	"electros-tui/internal/models"
	"electros-tui/internal/nav"
	"electros-tui/internal/session"
)

// View is a routable screen.
type View interface {
	Init() tea.Cmd
	Update(tea.Msg) (View, tea.Cmd)
	View() string
}

type sizable interface {
	SetSize(w, h int)
}

// titled views provide the content panel's border title.
type titled interface {
	Title() string
}

// hinted views provide contextual key hints for the status bar.
type hinted interface {
	Hints() string
}

// NewViewForRoute returns the view for a navigation path.
func NewViewForRoute(path string, deps *Deps, w, h int) View {
	base := strings.TrimPrefix(path, "/")
	// Container landing pages
	if rt := deps.Router.ByPath[base]; rt != nil && rt.Type == nav.RouteContainer && path == rt.Path {
		return newContainerView(deps, rt, w, h)
	}
	switch {
	case base == "dashboard" || base == "dev/dashboard-modern":
		return newDashboardView(deps, w, h)
	case base == "my-clouds":
		return newListView(deps, w, h, listConfig{
			title:        "My Clouds",
			loader:       listTargets,
			summary:      targetListSummary,
			rowDetail:    targetRowDetail,
			primary:      targetPingAction,
			delete:       targetDeleteAction,
			detailPath:   "my-clouds/detail",
			contextKey:   "target_id",
			newPath:      "my-clouds/add-private",
			help:         "Enter/d detail · p ping · x delete · n add · j/k rows",
		})
	case strings.HasPrefix(base, "my-clouds/detail"):
		return newTargetDetailView(deps, w, h)
	case strings.HasPrefix(base, "my-clouds/"):
		return newFormView(deps, w, h, base, myCloudsForms(base))
	case base == "iaas/storage":
		return newListView(deps, w, h, listConfig{
			title: "Storage", loader: listVolumes, summary: volumeListSummary, rowDetail: volumeRowDetail,
			delete: volumeDeleteAction,
			newPath: "iaas/storage/createVolume",
			help:    "x delete · n create · j/k rows",
		})
	case strings.HasPrefix(base, "iaas/storage/"):
		return newFormView(deps, w, h, base, storageForms(base))
	case base == "iaas/cloud-init":
		if rt := deps.Router.ByPath[base]; rt != nil && len(rt.Children) > 0 {
			return newContainerView(deps, rt, w, h)
		}
		return newStaticView(deps, w, h, "Cloud-init", "Manage cloud-init configs and cloud images.")
	case strings.HasPrefix(base, "iaas/cloud-init/"):
		return newFormView(deps, w, h, base, cloudInitForms(base))
	case base == "iaas/networking":
		return newListView(deps, w, h, listConfig{
			title: "Networking", loader: listNetworks, summary: networkListSummary, rowDetail: networkRowDetail,
			delete: networkDeleteAction,
			newPath: "iaas/networking/createLibvirt",
			help:    "x delete · n create · j/k rows",
		})
	case strings.HasPrefix(base, "iaas/networking/"):
		return newFormView(deps, w, h, base, networkForms(base))
	case base == "iaas/virtual-machines":
		return newListView(deps, w, h, listConfig{
			title: "Virtual Machines", loader: listVMs, summary: vmListSummary, rowDetail: vmRowDetail,
			primary: vmPowerAction, delete: vmDeleteAction,
			detailPath: "iaas/virtual-machines/detail", contextKey: "vm_uuid",
			newPath: "iaas/virtual-machines/createAdvanced",
			help:    "Enter/d detail · s start/stop · x delete · v VNC · n create · j/k rows",
		})
	case strings.HasPrefix(base, "iaas/virtual-machines/detail"):
		return newVMDetailView(deps, w, h)
	case strings.HasPrefix(base, "iaas/virtual-machines/"):
		return newFormView(deps, w, h, base, vmForms(base))
	case base == "iaas/ephemeral-vms":
		return newListView(deps, w, h, listConfig{
			title: "Ephemeral VMs", loader: listVMs, summary: vmListSummary, rowDetail: vmRowDetail,
			primary: vmPowerAction, delete: vmDeleteAction,
			newPath: "iaas/ephemeral-vms/create",
			help:    "s start/stop · x delete · n create · j/k rows",
		})
	case strings.HasPrefix(base, "iaas/ephemeral-vms/"):
		return newFormView(deps, w, h, base, ephemeralForms(base))
	case base == "credentials":
		return newStaticView(deps, w, h, "Credentials", "Experimental credential vault.\nIntegrates with target credential APIs.")
	case strings.HasPrefix(base, "settings/"):
		return newSettingsView(deps, w, h, base)
	case base == "dev/ui-demo":
		return newStaticView(deps, w, h, "UI Demo", "TUI component demo: tables, forms, metrics panels.")
	case base == "dev/debugging":
		return newServiceDebugView(deps, w, h)
	case strings.HasPrefix(base, "paas/") || strings.HasPrefix(base, "saas/"):
		if def := serviceDefForPath(deps, base); def != nil {
			if strings.HasSuffix(base, "/create") {
				return newServiceCreateView(deps, def, w, h)
			}
			return newServiceListView(deps, def, w, h)
		}
		return newStaticView(deps, w, h, path, "Unknown service route: "+path)
	default:
		return newStaticView(deps, w, h, path, "Route: "+path+"\nPress b to go back.")
	}
}

// --- dashboard ---

type dashboardView struct {
	deps   *Deps
	w, h   int
	panel  int
	text   string
	loaded bool
}

func newDashboardView(deps *Deps, w, h int) *dashboardView {
	v := &dashboardView{deps: deps, w: w, h: h, loaded: true}
	v.render()
	return v
}

func (v *dashboardView) Init() tea.Cmd { return nil }
func (v *dashboardView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *dashboardView) Update(msg tea.Msg) (View, tea.Cmd) {
	switch msg.(type) {
	case refreshDoneMsg:
		v.render()
		v.loaded = true
	}
	if km, ok := msg.(tea.KeyMsg); ok {
		switch km.String() {
		case "tab", "right", "]":
			v.panel = (v.panel + 1) % 6
			v.render()
		case "left", "[", "h":
			v.panel = (v.panel + 5) % 6
			v.render()
		}
	}
	return v, nil
}
func (v *dashboardView) Title() string { return "Dashboard" }
func (v *dashboardView) Hints() string { return "[ / ] switch panel · click tabs · r refresh" }
func (v *dashboardView) View() string {
	if !v.loaded {
		return StyleMuted.Render("Loading dashboard...")
	}
	f := v.deps.Session.FleetSummary()
	summary := StyleStatLabel.Render("Fleet  ") + StyleStat.Render(fleetSummaryLong(f, v.deps.Session.LastRefreshAgo()))
	tabs := []string{"Overview", "Compute", "Storage", "Platform", "Targets", "PaaS"}
	tabLine := ""
	for i, t := range tabs {
		if i == v.panel {
			tabLine += StyleSidebarActive.Render(" "+t+" ") + " "
		} else {
			tabLine += StyleMuted.Render(" "+t+" ") + " "
		}
	}
	return summary + "\n\n" + tabLine + "\n\n" + v.text
}

func (v *dashboardView) render() {
	f := v.deps.Session.FleetSummary()
	_, vms, vols, nets, targets := v.deps.Session.Snapshot()
	panels := metrics.BuildDashboardPanels(vms, vols, nets, targets)
	if len(panels) > 0 {
		panels[0].Stats = append(panels[0].Stats,
			metrics.Stat{Label: "Port Forwards", Value: fmt.Sprintf("%d", f.PortForwards)},
			metrics.Stat{Label: "PaaS instances", Value: fmt.Sprintf("%d", f.PaaSInstances)},
			metrics.Stat{Label: "SaaS instances", Value: fmt.Sprintf("%d", f.SaaSInstances)},
		)
	}
	if len(panels) > 5 {
		panels[5] = metrics.BuildServicesPanel(f.PaaSInstances, f.SaaSInstances, serviceCountBars(v.deps, f))
	}
	if v.panel < len(panels) {
		v.text = metrics.RenderPanel(panels[v.panel], v.w)
	}
}

func serviceCountBars(deps *Deps, f session.FleetSummary) []metrics.Bar {
	if deps.Services == nil {
		return nil
	}
	total := f.PaaSInstances + f.SaaSInstances
	if total == 0 {
		total = 1
	}
	bars := make([]metrics.Bar, 0, len(deps.Services.Services))
	for _, def := range deps.Services.Services {
		n := f.ServiceCountByPath(def.Path)
		bars = append(bars, metrics.Bar{Label: def.Label, Count: n, Total: total})
	}
	return bars
}

func (v *dashboardView) tabIndexAt(innerX int) (int, bool) {
	tabs := []string{"Overview", "Compute", "Storage", "Platform", "Targets", "PaaS"}
	x := 0
	for i, label := range tabs {
		// Match View() spacing: " "+label+" " plus one trailing space between tabs.
		seg := " " + label + " "
		segW := lipgloss.Width(seg)
		if innerX >= x && innerX < x+segW {
			return i, true
		}
		x += segW + 1
	}
	return -1, false
}

func (v *dashboardView) HandleMouse(msg tea.MouseMsg, innerX, innerY int) tea.Cmd {
	const tabRow = 2
	switch msg.Button {
	case tea.MouseButtonWheelUp:
		v.panel = (v.panel + 5) % 6
		v.render()
		return nil
	case tea.MouseButtonWheelDown:
		v.panel = (v.panel + 1) % 6
		v.render()
		return nil
	case tea.MouseButtonLeft:
		if msg.Action != tea.MouseActionPress || innerY != tabRow {
			return nil
		}
		if idx, ok := v.tabIndexAt(innerX); ok {
			v.panel = idx
			v.render()
		}
		return nil
	}
	return nil
}

// --- list view ---

type listLoader func(*session.Store) ([]table.Row, []table.Column, error)
type actionHandler func(*Deps, int, []table.Row) tea.Cmd

type listConfig struct {
	title       string
	loader      listLoader
	summary     func(*session.Store) string
	rowDetail   func(*session.Store, int, []table.Row) string
	primary     actionHandler
	delete      actionHandler
	detailPath  string
	contextKey  string
	newPath     string
	deleteIDCol int
	help        string
}

type listView struct {
	deps    *Deps
	cfg     listConfig
	w, h    int
	cols    []table.Column
	rows    []table.Row
	cursor  int
	colOff  int
	focused bool
	errMsg  string
	lastClickRow int
	lastClickAt  time.Time
}

func newListView(deps *Deps, w, h int, cfg listConfig) *listView {
	v := &listView{deps: deps, cfg: cfg, w: w, h: h, focused: true}
	v.reload()
	return v
}

func (v *listView) Init() tea.Cmd { return nil }
func (v *listView) Title() string { return v.cfg.title }
func (v *listView) Hints() string {
	if v.cfg.help != "" {
		return v.cfg.help
	}
	return "j/k rows · h/l cols · click · Enter select"
}
func (v *listView) SetSize(w, h int) {
	v.w, v.h = w, h
	v.reload()
}
func (v *listView) SetFocused(f bool) {
	v.focused = f
}

func (v *listView) Update(msg tea.Msg) (View, tea.Cmd) {
	switch msg := msg.(type) {
	case refreshDoneMsg:
		v.reload()
		return v, nil
	case tea.KeyMsg:
		if !v.focused {
			return v, nil
		}
		switch msg.String() {
		case "j", "down":
			if v.cursor < len(v.rows)-1 {
				v.cursor++
			}
			return v, nil
		case "k", "up":
			if v.cursor > 0 {
				v.cursor--
			}
			return v, nil
		case "g":
			v.cursor = 0
			return v, nil
		case "G":
			if len(v.rows) > 0 {
				v.cursor = len(v.rows) - 1
			}
			return v, nil
		case "h", "left":
			if v.colOff > 0 {
				v.colOff--
			}
			return v, nil
		case "l", "right":
			if v.colOff < maxColOffset(v.cols, v.w) {
				v.colOff++
			}
			return v, nil
		case "enter", "d":
			if v.cfg.detailPath != "" && len(v.rows) > 0 {
				v.setContext(v.cursor)
				return v, navigateTo(v.deps, v.cfg.detailPath)
			}
		case "n":
			if v.cfg.newPath != "" {
				return v, navigateTo(v.deps, v.cfg.newPath)
			}
		case "p":
			if v.cfg.primary != nil && len(v.rows) > 0 {
				return v, v.cfg.primary(v.deps, v.cursor, v.rows)
			}
		case "s":
			if v.cfg.primary != nil && len(v.rows) > 0 {
				return v, v.cfg.primary(v.deps, v.cursor, v.rows)
			}
		case "x":
			if v.cfg.delete != nil && len(v.rows) > 0 {
				return v, v.cfg.delete(v.deps, v.cursor, v.rows)
			}
		case "v":
			if strings.Contains(v.cfg.title, "Virtual") && len(v.rows) > 0 {
				if vm, ok := v.deps.Session.VMByIndex(v.cursor); ok {
					app := &App{deps: v.deps}
					return v, app.OpenVNCForVM(vm.UniqueID)
				}
			}
		}
	}
	return v, nil
}

func (v *listView) setContext(idx int) {
	if v.cfg.contextKey == "" {
		return
	}
	if v.deps.Context == nil {
		v.deps.Context = make(map[string]string)
	}
	switch v.cfg.contextKey {
	case "vm_uuid":
		if vm, ok := v.deps.Session.VMByIndex(idx); ok {
			v.deps.Context["vm_uuid"] = vm.UniqueID
		}
	case "target_id":
		if t, ok := v.deps.Session.TargetByIndex(idx); ok {
			v.deps.Context["target_id"] = t.TargetID
		}
	}
}

func (v *listView) View() string {
	var b strings.Builder
	if v.errMsg != "" {
		b.WriteString(StyleError.Render(v.errMsg) + "\n")
	}
	if v.cfg.summary != nil {
		b.WriteString(StyleStatLabel.Render(v.cfg.summary(v.deps.Session)) + "\n\n")
	}
	dt := dataTable{
		cols:   v.cols,
		rows:   v.rows,
		cursor: v.cursor,
		colOff: v.colOff,
		width:  v.w,
		height: v.tableHeight(),
	}
	b.WriteString(dt.render())
	b.WriteString("\n")
	count := StyleMuted.Render(fmt.Sprintf("%d items", len(v.rows)))
	if v.cfg.rowDetail != nil && v.cursor < len(v.rows) {
		if detail := v.cfg.rowDetail(v.deps.Session, v.cursor, v.rows); detail != "" {
			maxDetail := v.w - lipgloss.Width(count) - 3
			if maxDetail < 20 {
				maxDetail = 20
			}
			if lipgloss.Width(detail) > maxDetail {
				detail = ansi.Truncate(detail, maxDetail, "…")
			}
			b.WriteString(StyleStat.Render(detail))
			b.WriteString("\n")
		}
	}
	b.WriteString(count)
	return b.String()
}

func (v *listView) tableHeight() int {
	used := 1 // footer line
	if v.cfg.summary != nil {
		used += 2
	}
	if v.errMsg != "" {
		used++
	}
	h := v.h - used
	if h < 3 {
		h = 3
	}
	maxRows := len(v.rows) + 1 // header + data
	if maxRows > 0 && h > maxRows {
		h = maxRows
	}
	return h
}

func (v *listView) reload() {
	rows, cols, err := v.cfg.loader(v.deps.Session)
	if err != nil {
		v.errMsg = err.Error()
		return
	}
	v.errMsg = ""
	v.rows = rows
	if len(cols) > 0 {
		v.cols = fitColumns(cols, v.w)
	} else {
		v.cols = cols
	}
	if len(v.rows) == 0 {
		v.cursor = 0
	} else if v.cursor >= len(v.rows) {
		v.cursor = len(v.rows) - 1
	}
	if v.colOff > maxColOffset(v.cols, v.w) {
		v.colOff = maxColOffset(v.cols, v.w)
	}
}

func (v *listView) contentLeadLines() int {
	n := 0
	if v.errMsg != "" {
		n++
	}
	if v.cfg.summary != nil {
		n += 2
	}
	return n
}

func (v *listView) rowIndexAt(innerY int) (int, bool) {
	lead := v.contentLeadLines()
	if innerY <= lead {
		return -1, false
	}
	tableRel := innerY - lead
	if tableRel == 0 {
		return -1, false
	}
	rowInView := tableRel - 1
	maxRows := v.tableHeight() - 1
	if maxRows < 1 {
		maxRows = 1
	}
	visible := len(v.rows)
	if visible > maxRows {
		visible = maxRows
	}
	if rowInView >= visible {
		return -1, false
	}
	top := 0
	if v.cursor >= visible {
		top = v.cursor - visible + 1
	}
	idx := top + rowInView
	if idx < 0 || idx >= len(v.rows) {
		return -1, false
	}
	return idx, true
}

func (v *listView) HandleMouse(msg tea.MouseMsg, _, innerY int) tea.Cmd {
	switch msg.Button {
	case tea.MouseButtonWheelUp:
		if v.cursor > 0 {
			v.cursor--
		}
		return nil
	case tea.MouseButtonWheelDown:
		if v.cursor < len(v.rows)-1 {
			v.cursor++
		}
		return nil
	case tea.MouseButtonLeft:
		if msg.Action != tea.MouseActionPress {
			return nil
		}
		idx, ok := v.rowIndexAt(innerY)
		if !ok {
			return nil
		}
		if isDoubleClick(v.lastClickRow, idx, v.lastClickAt) && v.cfg.detailPath != "" {
			v.setContext(idx)
			return navigateTo(v.deps, v.cfg.detailPath)
		}
		v.cursor = idx
		v.lastClickRow = idx
		v.lastClickAt = time.Now()
		return nil
	}
	return nil
}

func listVMs(s *session.Store) ([]table.Row, []table.Column, error) {
	_, vms, _, _, _ := s.Snapshot()
	rows := make([]table.Row, 0, len(vms))
	for _, vm := range vms {
		req, _ := vm.ParseReqFull()
		providerKey := resolveProviderKey(vm.Provider, req.VMName)
		if providerKey == "" {
			providerKey = resolveProviderKey(req.Provider, req.VMName)
		}
		rows = append(rows, table.Row{
			req.VMName,
			formatState(req.States),
			renderOsCell(req.OSFamily, req.OSFlavour),
			renderTargetTypeBadge(vm.TargetType),
			renderProviderTag(providerKey),
			vm.UniqueID,
			req.CPULabel(),
			formatRAM(req.RAMSize),
			fmt.Sprintf("%d", req.GPUCount()),
			fmt.Sprintf("%d", req.VolumeCount()),
			req.PrimaryIPv4(),
			vm.ServerURL,
		})
	}
	cols := []table.Column{
		{Title: "Name", Width: 16}, {Title: "State", Width: 10}, {Title: "OS", Width: 16},
		{Title: "Host", Width: 12}, {Title: "Provider", Width: 10}, {Title: "UUID", Width: 14},
		{Title: "CPU", Width: 10}, {Title: "RAM", Width: 8}, {Title: "GPU", Width: 4},
		{Title: "Vol", Width: 4}, {Title: "IP", Width: 12}, {Title: "Server", Width: 14},
	}
	return rows, cols, nil
}

func vmListSummary(s *session.Store) string {
	f := s.FleetSummary()
	return fmt.Sprintf("%d VMs · %d running · %d stopped · %d CPU slots allocated",
		f.VMs, f.VMsRunning, f.VMsStopped, vmTotalSlots(s))
}

func vmTotalSlots(s *session.Store) int {
	_, vms, _, _, _ := s.Snapshot()
	n := 0
	for _, vm := range vms {
		req, _ := vm.ParseReqJSON()
		n += req.Slots
	}
	return n
}

func vmRowDetail(s *session.Store, idx int, _ []table.Row) string {
	vm, ok := s.VMByIndex(idx)
	if !ok {
		return ""
	}
	req, _ := vm.ParseReqFull()
	provider := resolveProviderKey(vm.Provider, req.VMName)
	return fmt.Sprintf("%s · %s · %s · %s · %s · uuid %s",
		req.VMName, req.States, formatOsLabel(req.OSFamily, req.OSFlavour),
		targetTypeLabel(vm.TargetType), provider, vm.UniqueID)
}

func listVolumes(s *session.Store) ([]table.Row, []table.Column, error) {
	_, _, vols, _, _ := s.Snapshot()
	rows := make([]table.Row, 0, len(vols))
	for _, vol := range vols {
		providerKey := resolveProviderKey(vol.Provider, vol.Name)
		driver := vol.Bus
		if driver == "" {
			driver = "—"
		}
		creator := vol.CreatorID
		if creator == "" {
			creator = "—"
		}
		host := vol.Server
		if host == "" {
			host = "—"
		}
		rows = append(rows, table.Row{
			vol.Name,
			vol.VolumeID,
			formatBytes(vol.Size),
			formatBytes(vol.SizeOnDisk),
			host,
			renderVolumeFormatTag(vol.Format),
			driver,
			creator,
			formatBool(vol.Own),
			formatBool(vol.Bootable),
			formatBool(vol.Shareable),
			formatBool(vol.Readonly),
			renderProviderTag(providerKey),
		})
	}
	cols := []table.Column{
		{Title: "Name", Width: 14}, {Title: "UUID", Width: 14}, {Title: "Size", Width: 9},
		{Title: "OnDisk", Width: 9}, {Title: "Host", Width: 12}, {Title: "Fmt", Width: 8},
		{Title: "Driver", Width: 8}, {Title: "Creator", Width: 10}, {Title: "Own", Width: 5},
		{Title: "Boot", Width: 5}, {Title: "Share", Width: 6}, {Title: "RO", Width: 4},
		{Title: "Provider", Width: 10},
	}
	return rows, cols, nil
}

func volumeListSummary(s *session.Store) string {
	f := s.FleetSummary()
	bootable := 0
	_, _, vols, _, _ := s.Snapshot()
	for _, v := range vols {
		if v.Bootable {
			bootable++
		}
	}
	return fmt.Sprintf("%d volumes · %s total · %d bootable", f.Volumes, formatBytes(f.VolumeBytes), bootable)
}

func volumeRowDetail(s *session.Store, idx int, _ []table.Row) string {
	vol, ok := s.VolumeByIndex(idx)
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s · %s · %s · id %s", vol.Name, vol.Format, formatBytes(vol.Size), vol.VolumeID)
}

func listNetworks(s *session.Store) ([]table.Row, []table.Column, error) {
	_, _, _, nets, _ := s.Snapshot()
	rows := make([]table.Row, 0, len(nets))
	for _, n := range nets {
		netType := n.Type
		if netType == "" {
			netType = n.Mode
		}
		providerKey := resolveProviderKey(n.Provider, n.DisplayName())
		rows = append(rows, table.Row{
			n.DisplayName(),
			n.Mode,
			renderNetworkTypeTag(netType),
			formatBool(n.Private),
			renderProviderTag(providerKey),
			n.NetworkUID,
		})
	}
	cols := []table.Column{
		{Title: "Name", Width: 14}, {Title: "Mode", Width: 8}, {Title: "Type", Width: 10},
		{Title: "Priv", Width: 5}, {Title: "Provider", Width: 10}, {Title: "UID", Width: 14},
	}
	return rows, cols, nil
}

func networkListSummary(s *session.Store) string {
	f := s.FleetSummary()
	return fmt.Sprintf("%d networks · %d port forwards", f.Networks, f.PortForwards)
}

func networkRowDetail(s *session.Store, idx int, _ []table.Row) string {
	net, ok := s.NetworkByIndex(idx)
	if !ok {
		return ""
	}
	priv := "public"
	if net.Private {
		priv = "private"
	}
	return fmt.Sprintf("%s · %s · %s · uid %s", net.DisplayName(), net.Mode, priv, net.NetworkUID)
}

func listTargets(s *session.Store) ([]table.Row, []table.Column, error) {
	_, _, _, _, targets := s.Snapshot()
	rows := make([]table.Row, 0, len(targets))
	for _, t := range targets {
		providerKey := resolveProviderKey(t.Provider(), t.DisplayName())
		server := t.ServerURL()
		if server == "" {
			server = "—"
		}
		rows = append(rows, table.Row{
			t.DisplayName(),
			renderTargetTypeBadge(t.TargetType),
			renderProviderTag(providerKey),
			server,
			t.TargetID,
		})
	}
	cols := []table.Column{
		{Title: "Name", Width: 14}, {Title: "Type", Width: 12}, {Title: "Provider", Width: 10},
		{Title: "Server", Width: 18}, {Title: "ID", Width: 14},
	}
	return rows, cols, nil
}

func targetListSummary(s *session.Store) string {
	f := s.FleetSummary()
	return fmt.Sprintf("%d cloud targets connected", f.Targets)
}

func targetRowDetail(s *session.Store, idx int, _ []table.Row) string {
	t, ok := s.TargetByIndex(idx)
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s · %s · %s · id %s", t.DisplayName(), t.TargetType, t.Provider(), t.TargetID)
}

func vmPowerAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	vm, ok := deps.Session.VMByIndex(idx)
	if !ok {
		return nil
	}
	uuid := vm.UniqueID
	return func() tea.Msg {
		ctx := context.Background()
		req, _ := vm.ParseReqJSON()
		var err2 error
		if strings.EqualFold(req.States, "running") {
			err2 = deps.Client.StopVM(ctx, uuid)
		} else {
			err2 = deps.Client.StartVM(ctx, uuid)
		}
		if err2 != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err2)}
		}
		return actionDoneMsg{notice: fmt.Sprintf("%s → %s", req.VMName, toggleState(req.States))}
	}
}

func toggleState(state string) string {
	if strings.EqualFold(state, "running") {
		return "stopped"
	}
	return "running"
}

func vmDeleteAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	vm, ok := deps.Session.VMByIndex(idx)
	if !ok {
		return nil
	}
	uuid := vm.UniqueID
	req, _ := vm.ParseReqJSON()
	name := req.VMName
	if name == "" {
		name = uuid
	}
	return func() tea.Msg {
		ctx := context.Background()
		err := deps.Client.UnregisterVM(ctx, uuid)
		if err != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return actionDoneMsg{notice: "Deleted VM " + name}
	}
}

func volumeDeleteAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	vol, ok := deps.Session.VolumeByIndex(idx)
	if !ok {
		return nil
	}
	return func() tea.Msg {
		ctx := context.Background()
		err := deps.Client.DestroyVolume(ctx, map[string]any{"volumeID": vol.VolumeID})
		if err != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return actionDoneMsg{notice: "Volume " + vol.Name + " destroyed"}
	}
}

func networkDeleteAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	net, ok := deps.Session.NetworkByIndex(idx)
	if !ok {
		return nil
	}
	return func() tea.Msg {
		ctx := context.Background()
		err := deps.Client.DeleteNetwork(ctx, map[string]any{"network_uid": net.NetworkUID})
		if err != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return actionDoneMsg{notice: "Network " + net.DisplayName() + " deleted"}
	}
}

func targetPingAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	t, ok := deps.Session.TargetByIndex(idx)
	if !ok {
		return nil
	}
	id := t.TargetID
	return func() tea.Msg {
		ctx := context.Background()
		resp, err := deps.Client.PingTarget(ctx, id)
		if err != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return actionDoneMsg{notice: fmt.Sprintf("Ping OK: %s → %v", t.DisplayName(), resp)}
	}
}

func targetDeleteAction(deps *Deps, idx int, _ []table.Row) tea.Cmd {
	t, ok := deps.Session.TargetByIndex(idx)
	if !ok {
		return nil
	}
	id := t.TargetID
	name := t.DisplayName()
	return func() tea.Msg {
		ctx := context.Background()
		err := deps.Client.DeleteTarget(ctx, map[string]any{"target_id": id})
		if err != nil {
			return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return actionDoneMsg{notice: "Target " + name + " deleted"}
	}
}

// --- detail views ---

type targetDetailView struct {
	deps *Deps
	w, h int
	text string
}

func newTargetDetailView(deps *Deps, w, h int) *targetDetailView {
	v := &targetDetailView{deps: deps, w: w, h: h}
	v.load()
	return v
}
func (v *targetDetailView) Init() tea.Cmd   { return nil }
func (v *targetDetailView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *targetDetailView) SetFocused(bool) {}
func (v *targetDetailView) Update(msg tea.Msg) (View, tea.Cmd) {
	if km, ok := msg.(tea.KeyMsg); ok && km.String() == "p" {
		id := v.deps.Context["target_id"]
		return v, func() tea.Msg {
			ctx := context.Background()
			_, err := v.deps.Client.PingTarget(ctx, id)
			if err != nil {
				return actionDoneMsg{err: err}
			}
			return actionDoneMsg{notice: "Target ping OK"}
		}
	}
	return v, nil
}
func (v *targetDetailView) Title() string { return "Target Detail" }
func (v *targetDetailView) Hints() string { return "p ping · b back" }
func (v *targetDetailView) View() string {
	return v.text
}
func (v *targetDetailView) load() {
	id := v.deps.Context["target_id"]
	_, _, _, _, targets := v.deps.Session.Snapshot()
	for _, t := range targets {
		if t.TargetID == id {
			providerKey := resolveProviderKey(t.Provider(), t.DisplayName())
			v.text = fmt.Sprintf(
				"Target ID     %s\nType          %s\nProvider      %s\nServer        %s\n\nUse p to ping this target.",
				t.TargetID,
				renderTargetTypeBadge(t.TargetType),
				renderProviderTag(providerKey),
				orDash(t.ServerURL()),
			)
			if len(t.PingStatus) > 0 {
				v.text += "\n\nLast ping:\n  " + string(t.PingStatus)
			}
			return
		}
	}
	v.text = "Target not found: " + id
}

type vmDetailView struct {
	deps *Deps
	w, h int
	text string
}

func newVMDetailView(deps *Deps, w, h int) *vmDetailView {
	v := &vmDetailView{deps: deps, w: w, h: h}
	v.load()
	return v
}
func (v *vmDetailView) Init() tea.Cmd   { return nil }
func (v *vmDetailView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *vmDetailView) SetFocused(bool) {}
func (v *vmDetailView) Update(msg tea.Msg) (View, tea.Cmd) {
	if km, ok := msg.(tea.KeyMsg); ok {
		uuid := v.deps.Context["vm_uuid"]
		idx := -1
		_, vms, _, _, _ := v.deps.Session.Snapshot()
		for i, vm := range vms {
			if vm.UniqueID == uuid {
				idx = i
				break
			}
		}
		if idx < 0 {
			return v, nil
		}
		switch km.String() {
		case "s":
			return v, vmPowerAction(v.deps, idx, nil)
		case "v":
			return v, (&App{deps: v.deps}).OpenVNCForVM(uuid)
		case "x":
			return v, vmDeleteAction(v.deps, idx, nil)
		}
	}
	return v, nil
}
func (v *vmDetailView) Title() string { return "VM Detail" }
func (v *vmDetailView) Hints() string { return "s power · v VNC · x delete · b back" }
func (v *vmDetailView) View() string {
	return v.text
}
func (v *vmDetailView) load() {
	id := v.deps.Context["vm_uuid"]
	_, vms, _, _, _ := v.deps.Session.Snapshot()
	for _, vm := range vms {
		if vm.UniqueID == id {
			req, _ := vm.ParseReqFull()
			providerKey := resolveProviderKey(vm.Provider, req.VMName)
			v.text = fmt.Sprintf(
				"Name          %s\nState         %s\nUUID          %s\nOS            %s\nArchitecture  %s\nCPU           %s\nRAM           %s\nGPUs          %d\nVolumes       %d\nIP            %s\nRegion        %s\nHypervisor    %s\nProvider      %s\nHost          %s\nAutostart     %s\nQEMU agent    %s\nCreated       %s",
				req.VMName,
				formatState(req.States),
				vm.UniqueID,
				renderOsCell(req.OSFamily, req.OSFlavour),
				req.Arch,
				req.CPULabel(),
				formatRAM(req.RAMSize),
				req.GPUCount(),
				req.VolumeCount(),
				req.PrimaryIPv4(),
				orDash(req.DeploymentRegion),
				renderTargetTypeBadge(vm.TargetType),
				renderProviderTag(providerKey),
				orDash(vm.ServerURL),
				formatBool(req.Autostart),
				formatBool(req.QemuAgent),
				orDash(req.CreationDate),
			)
			return
		}
	}
	v.text = "VM not found: " + id
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

// --- static view ---

type staticView struct {
	deps  *Deps
	title string
	body  string
	w, h  int
}

func newStaticView(deps *Deps, w, h int, title, body string) *staticView {
	return &staticView{deps: deps, title: title, body: body, w: w, h: h}
}
func (v *staticView) Init() tea.Cmd { return nil }
func (v *staticView) Title() string { return v.title }
func (v *staticView) Hints() string { return "b back" }
func (v *staticView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *staticView) Update(msg tea.Msg) (View, tea.Cmd) { return v, nil }
func (v *staticView) View() string {
	return v.body
}

// --- settings ---

func newSettingsMenu(deps *Deps, w, h int) *staticView {
	body := `Account          settings/account
Organisation     settings/organisation
Billing          settings/billing
Licenses         settings/licenses
Preferences      settings/preferences
Appearance       settings/appearance
Info             settings/info

Use :cmd to navigate, e.g. :settings/billing`
	return newStaticView(deps, w, h, "Settings", body)
}

type settingsView struct {
	deps  *Deps
	path  string
	lines []string
	w, h  int
}

func newSettingsView(deps *Deps, w, h int, path string) *settingsView {
	v := &settingsView{deps: deps, path: path, w: w, h: h}
	v.load()
	return v
}

func (v *settingsView) Init() tea.Cmd { return v.reload() }
func (v *settingsView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *settingsView) Update(msg tea.Msg) (View, tea.Cmd) {
	if km, ok := msg.(tea.KeyMsg); ok {
		switch km.String() {
		case "o":
			if strings.Contains(v.path, "billing") {
				return v, v.openStripe()
			}
		case "a":
			if strings.Contains(v.path, "account") {
				return v, v.oauthLogin()
			}
		}
	}
	return v, nil
}
func (v *settingsView) Title() string {
	return "Settings / " + strings.TrimPrefix(v.path, "settings/")
}
func (v *settingsView) Hints() string {
	return "o payment (billing) · a OAuth (account) · r reload"
}
func (v *settingsView) View() string {
	return strings.Join(v.lines, "\n")
}
func (v *settingsView) reload() tea.Cmd {
	return func() tea.Msg {
		v.load()
		return nil
	}
}
func (v *settingsView) load() {
	ctx := context.Background()
	v.lines = nil
	switch {
	case strings.HasSuffix(v.path, "account"):
		d, err := v.deps.Client.GetAccountDetails(ctx)
		if err == nil {
			v.lines = append(v.lines, fmt.Sprintf("Username: %v", d.Username), fmt.Sprintf("Email: %v", d.Email))
		} else {
			v.lines = append(v.lines, err.Error())
		}
	case strings.HasSuffix(v.path, "billing"):
		b, err := v.deps.Client.GetBillingStatus(ctx)
		if err == nil {
			v.lines = append(v.lines, fmt.Sprintf("Status: %s", b.Status), fmt.Sprintf("Balance: %.2f", b.Balance))
		}
		tx, _ := v.deps.Client.GetBillingTransactions(ctx, "")
		v.lines = append(v.lines, fmt.Sprintf("Transactions: %d", len(tx)))
	case strings.HasSuffix(v.path, "licenses"):
		lic, err := v.deps.Client.ListLicenses(ctx)
		if err == nil {
			v.lines = append(v.lines, fmt.Sprintf("Licenses: %d", len(lic)))
		}
	case strings.HasSuffix(v.path, "organisation"):
		org, err := v.deps.Client.ListOrganizations(ctx)
		if err == nil {
			v.lines = append(v.lines, fmt.Sprintf("%v", org))
		}
	case strings.HasSuffix(v.path, "appearance"):
		v.lines = []string{"TUI themes: default (lipgloss)", "Use terminal color scheme.", "Preference sync via auth daemon when available."}
	case strings.HasSuffix(v.path, "preferences"):
		v.lines = []string{"Preferences mirror GUI settings keys.", "Edit via auth daemon APIs."}
	default:
		v.lines = []string{"Info and license details.", "See GUI settings/info for full content."}
	}
}

func (v *settingsView) openStripe() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		resp, err := v.deps.Client.RefreshPaymentLink(ctx, "default")
		if err != nil {
			return actionDoneMsg{err: err}
		}
		if err := host.OpenURL(resp.PaymentURL); err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{notice: "Opened payment URL in browser"}
	}
}

func (v *settingsView) oauthLogin() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		resp, err := v.deps.Client.StartOAuthLogin(ctx, "google")
		if err != nil {
			return actionDoneMsg{err: err}
		}
		if err := host.OpenURL(resp.AuthURL); err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{notice: "Complete OAuth in browser; polling auth status..."}
	}
}

// --- service debug ---

type serviceDebugView struct {
	deps     *Deps
	w, h     int
	services []string
	idx      int
	lines    []string
}

func newServiceDebugView(deps *Deps, w, h int) *serviceDebugView {
	return &serviceDebugView{deps: deps, w: w, h: h, services: api.KnownPaaSServices}
}

func (v *serviceDebugView) Init() tea.Cmd { return v.loadService() }
func (v *serviceDebugView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *serviceDebugView) Update(msg tea.Msg) (View, tea.Cmd) {
	if km, ok := msg.(tea.KeyMsg); ok {
		switch km.String() {
		case "j", "down":
			if v.idx < len(v.services)-1 {
				v.idx++
				return v, v.loadService()
			}
		case "k", "up":
			if v.idx > 0 {
				v.idx--
				return v, v.loadService()
			}
		case "n":
			svc := v.services[v.idx]
			return v, func() tea.Msg {
				ctx := context.Background()
				_, err := v.deps.Client.CreateService(ctx, svc, map[string]any{"name": "tui-test"})
				if err != nil {
					return actionDoneMsg{err: v.deps.Session.HandleAPIError(err)}
				}
				return actionDoneMsg{notice: "Service instance created"}
			}
		}
	}
	return v, nil
}
func (v *serviceDebugView) Title() string { return "Service Testing" }
func (v *serviceDebugView) Hints() string { return "j/k service type · n create test instance" }
func (v *serviceDebugView) View() string {
	svc := v.services[v.idx]
	return "Service: " + StyleTitle.Render(svc) + "\n\n" + strings.Join(v.lines, "\n")
}
func (v *serviceDebugView) loadService() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		svc := v.services[v.idx]
		items, err := v.deps.Client.ListRunningServicesRaw(ctx, svc)
		v.lines = nil
		if err != nil {
			v.lines = []string{err.Error()}
			return nil
		}
		for _, item := range items {
			name := formatServiceCell(item, "cluster_name")
			if name == "" {
				name = formatServiceCell(item, "name")
			}
			v.lines = append(v.lines, fmt.Sprintf("%s  %s  %s",
				name,
				formatServiceCell(item, "service_uuid"),
				formatServiceCell(item, "status"),
			))
		}
		if len(v.lines) == 0 {
			v.lines = []string{"(no running instances)"}
		}
		return nil
	}
}

var _ models.VolumeRecord

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func sshExecCmd(host, user, _ string) tea.Cmd {
	target := host
	if user != "" {
		target = user + "@" + host
	}
	c := exec.Command("ssh", target)
	return tea.ExecProcess(c, func(err error) tea.Msg {
		if err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{notice: "SSH session closed"}
	})
}
