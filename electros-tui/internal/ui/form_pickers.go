package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/models"
)

// PickerKind identifies a resource picker field.
type PickerKind string

const (
	PickerVolumes  PickerKind = "volumes"
	PickerNetworks PickerKind = "networks"
	PickerPCI      PickerKind = "pcidev"
)

type vmVolumeEntry struct {
	VID      string `json:"vid"`
	Priority int    `json:"priority"`
}

type vmNetworkEntry struct {
	NetworkUID string `json:"network_uid"`
}

type vmPciEntry struct {
	Vendor   string `json:"vendor"`
	Model    string `json:"model"`
	Quantity int    `json:"quantity"`
}

type pickerListItem struct {
	id     string
	label  string
	detail string
}

type pickerModal struct {
	kind    PickerKind
	w, h    int
	loading bool
	errMsg  string

	items       []pickerListItem
	cursor      int
	scroll      int
	selected    map[int]struct{}
	selectOrder []int

	pciStep      int // 0 vendor, 1 device, 2 quantity
	pciVendorIdx int
	pciDeviceIdx int // index into filtered device list on step 1
	pciQty       int
	pciAdded     []vmPciEntry
	pciSearch    string
}

type pickerLoadedMsg struct {
	kind  PickerKind
	items []pickerListItem
	err   error
}

func fldPicker(key, label string, kind PickerKind, defaultJSON string) fieldDef {
	if defaultJSON == "" {
		defaultJSON = "[]"
	}
	return fieldDef{Key: key, Label: label, Default: defaultJSON, Picker: kind}
}

func (d fieldDef) isPicker() bool { return d.Picker != "" }

func (f *formField) pickerSummary(deps *Deps) string {
	raw := strings.TrimSpace(f.pickerValue)
	if raw == "" || raw == "[]" {
		return StyleMuted.Render("(none — Enter to pick)")
	}
	switch f.def.Picker {
	case PickerVolumes:
		var entries []vmVolumeEntry
		if err := json.Unmarshal([]byte(raw), &entries); err != nil || len(entries) == 0 {
			return StyleMuted.Render("(invalid — Enter to pick)")
		}
		parts := make([]string, 0, len(entries))
		for _, e := range entries {
			name := e.VID
			if deps != nil && deps.FormOpts != nil {
				name = deps.FormOpts.volumeLabel(e.VID)
			}
			parts = append(parts, fmt.Sprintf("%s (p%d)", name, e.Priority))
		}
		return strings.Join(parts, ", ")
	case PickerNetworks:
		var entries []vmNetworkEntry
		if err := json.Unmarshal([]byte(raw), &entries); err != nil || len(entries) == 0 {
			return StyleMuted.Render("(invalid — Enter to pick)")
		}
		parts := make([]string, 0, len(entries))
		for _, e := range entries {
			name := e.NetworkUID
			if deps != nil && deps.FormOpts != nil {
				name = deps.FormOpts.networkLabel(e.NetworkUID)
			}
			parts = append(parts, name)
		}
		return strings.Join(parts, ", ")
	case PickerPCI:
		var entries []vmPciEntry
		if err := json.Unmarshal([]byte(raw), &entries); err != nil || len(entries) == 0 {
			return StyleMuted.Render("(none — Enter to pick)")
		}
		parts := make([]string, 0, len(entries))
		for _, e := range entries {
			label := e.Vendor + ":" + e.Model
			if deps != nil && deps.FormOpts != nil {
				label = deps.FormOpts.pciLabel(e.Vendor, e.Model)
			}
			qty := e.Quantity
			if qty <= 0 {
				qty = 1
			}
			if qty > 1 {
				parts = append(parts, fmt.Sprintf("%s ×%d", label, qty))
			} else {
				parts = append(parts, label)
			}
		}
		return strings.Join(parts, ", ")
	default:
		return raw
	}
}

func (o *FormOptions) volumeLabel(vid string) string {
	if o.volumeNames != nil {
		if name, ok := o.volumeNames[vid]; ok && name != "" {
			return name
		}
	}
	return vid
}

func (o *FormOptions) networkLabel(uid string) string {
	if o.networkNames != nil {
		if name, ok := o.networkNames[uid]; ok && name != "" {
			return name
		}
	}
	return uid
}

func (o *FormOptions) pciLabel(vendorID, modelID string) string {
	if o.PCICatalog == nil {
		return vendorID + ":" + modelID
	}
	v := o.PCICatalog[vendorID]
	if v == nil {
		return vendorID + ":" + modelID
	}
	for _, d := range v.Devices {
		if d.ID == modelID {
			return v.Name + " — " + d.Name
		}
	}
	return v.Name + " — " + modelID
}

func (o *FormOptions) indexVolumes(vols []models.VolumeRecord) {
	if o.volumeNames == nil {
		o.volumeNames = make(map[string]string, len(vols))
	}
	for _, vol := range vols {
		name := vol.Name
		if name == "" {
			name = vol.VolumeID
		}
		o.volumeNames[vol.VolumeID] = name
	}
}

func (o *FormOptions) indexNetworks(nets []models.NetworkRecord) {
	if o.networkNames == nil {
		o.networkNames = make(map[string]string, len(nets))
	}
	for _, net := range nets {
		o.networkNames[net.NetworkUID] = net.DisplayName()
	}
}

func (v *formView) openPickerModal(kind PickerKind) tea.Cmd {
	v.modal = &pickerModal{kind: kind, w: v.w, h: max(v.vp.Height, 12), selected: map[int]struct{}{}}
	if kind == PickerPCI {
		v.modal.pciStep = 0
		v.modal.pciQty = 1
		var existing []vmPciEntry
		_ = json.Unmarshal([]byte(v.fields[v.focus].pickerValue), &existing)
		v.modal.pciAdded = append([]vmPciEntry(nil), existing...)
		if v.deps.FormOpts == nil || len(v.deps.FormOpts.PCICatalog) == 0 {
			v.modal.errMsg = "PCI catalog unavailable (epm/vendors.json)"
		}
		return nil
	}
	v.modal.loading = true
	// Restore prior multi-select from field value.
	var order []int
	switch kind {
	case PickerVolumes:
		var entries []vmVolumeEntry
		_ = json.Unmarshal([]byte(v.fields[v.focus].pickerValue), &entries)
		sort.Slice(entries, func(i, j int) bool { return entries[i].Priority < entries[j].Priority })
		for _, e := range entries {
			order = append(order, -1) // resolved after load
			_ = e
		}
	case PickerNetworks:
		var entries []vmNetworkEntry
		_ = json.Unmarshal([]byte(v.fields[v.focus].pickerValue), &entries)
		for range entries {
			order = append(order, -1)
		}
	}
	v.modal.selectOrder = order
	return v.loadPickerItems(kind)
}

func (v *formView) loadPickerItems(kind PickerKind) tea.Cmd {
	deps := v.deps
	return func() tea.Msg {
		ctx := context.Background()
		switch kind {
		case PickerVolumes:
			vols, err := deps.Client.ListVolumes(ctx)
			if err != nil {
				return pickerLoadedMsg{kind: kind, err: err}
			}
			if deps.FormOpts != nil {
				deps.FormOpts.indexVolumes(vols)
			}
			items := make([]pickerListItem, 0, len(vols))
			for _, vol := range vols {
				size := formatBytes(vol.Size)
				items = append(items, pickerListItem{
					id:     vol.VolumeID,
					label:  vol.Name,
					detail: fmt.Sprintf("%s · %s · %s", vol.Format, vol.Bus, size),
				})
			}
			sort.Slice(items, func(i, j int) bool { return items[i].label < items[j].label })
			return pickerLoadedMsg{kind: kind, items: items}
		case PickerNetworks:
			nets, err := deps.Client.ListNetworks(ctx)
			if err != nil {
				return pickerLoadedMsg{kind: kind, err: err}
			}
			if deps.FormOpts != nil {
				deps.FormOpts.indexNetworks(nets)
			}
			items := make([]pickerListItem, 0, len(nets))
			for _, net := range nets {
				items = append(items, pickerListItem{
					id:     net.NetworkUID,
					label:  net.DisplayName(),
					detail: fmt.Sprintf("%s · %s", net.Type, net.Mode),
				})
			}
			sort.Slice(items, func(i, j int) bool { return items[i].label < items[j].label })
			return pickerLoadedMsg{kind: kind, items: items}
		default:
			return pickerLoadedMsg{kind: kind, items: nil}
		}
	}
}

func (v *formView) applyPickerLoaded(msg pickerLoadedMsg) {
	if v.modal == nil || v.modal.kind != msg.kind {
		return
	}
	v.modal.loading = false
	if msg.err != nil {
		v.modal.errMsg = msg.err.Error()
		return
	}
	v.modal.items = msg.items
	v.modal.selected = map[int]struct{}{}
	v.modal.selectOrder = v.modal.selectOrder[:0]

	// Re-select items from existing field JSON.
	raw := v.fields[v.focus].pickerValue
	switch msg.kind {
	case PickerVolumes:
		var entries []vmVolumeEntry
		_ = json.Unmarshal([]byte(raw), &entries)
		sort.Slice(entries, func(i, j int) bool { return entries[i].Priority < entries[j].Priority })
		for _, e := range entries {
			for i, item := range v.modal.items {
				if item.id == e.VID {
					v.modal.selected[i] = struct{}{}
					v.modal.selectOrder = append(v.modal.selectOrder, i)
					break
				}
			}
		}
	case PickerNetworks:
		var entries []vmNetworkEntry
		_ = json.Unmarshal([]byte(raw), &entries)
		for _, e := range entries {
			for i, item := range v.modal.items {
				if item.id == e.NetworkUID {
					v.modal.selected[i] = struct{}{}
					v.modal.selectOrder = append(v.modal.selectOrder, i)
					break
				}
			}
		}
	}
}

func (v *formView) updatePickerModal(msg tea.Msg) (tea.Cmd, bool) {
	if v.modal == nil {
		return nil, false
	}
	m := v.modal

	switch msg := msg.(type) {
	case pickerLoadedMsg:
		v.applyPickerLoaded(msg)
		return nil, true
	case tea.KeyMsg:
		if m.kind == PickerPCI {
			return v.updatePCIModal(msg), true
		}
		key := msg.String()
		switch key {
		case "esc":
			v.modal = nil
			return nil, true
		case "ctrl+s", "enter":
			v.confirmListPicker()
			v.modal = nil
			return nil, true
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
				if m.cursor < m.scroll {
					m.scroll = m.cursor
				}
			}
		case "down", "j":
			if m.cursor < len(m.items)-1 {
				m.cursor++
				maxVis := max(m.h-8, 4)
				if m.cursor >= m.scroll+maxVis {
					m.scroll = m.cursor - maxVis + 1
				}
			}
		case " ":
			v.togglePickerItem(m.cursor)
		case "d":
			v.removePickerItem(m.cursor)
		}
		return nil, true
	}
	return nil, true
}

func (v *formView) togglePickerItem(idx int) {
	if v.modal == nil || idx < 0 || idx >= len(v.modal.items) {
		return
	}
	if _, ok := v.modal.selected[idx]; ok {
		delete(v.modal.selected, idx)
		order := v.modal.selectOrder[:0]
		for _, i := range v.modal.selectOrder {
			if i != idx {
				order = append(order, i)
			}
		}
		v.modal.selectOrder = order
	} else {
		v.modal.selected[idx] = struct{}{}
		v.modal.selectOrder = append(v.modal.selectOrder, idx)
	}
}

func (v *formView) removePickerItem(idx int) {
	if v.modal == nil {
		return
	}
	if _, ok := v.modal.selected[idx]; !ok {
		return
	}
	delete(v.modal.selected, idx)
	order := v.modal.selectOrder[:0]
	for _, i := range v.modal.selectOrder {
		if i != idx {
			order = append(order, i)
		}
	}
	v.modal.selectOrder = order
}

func (v *formView) confirmListPicker() {
	if v.modal == nil {
		return
	}
	field := &v.fields[v.focus]
	switch v.modal.kind {
	case PickerVolumes:
		out := make([]vmVolumeEntry, 0, len(v.modal.selectOrder))
		for p, idx := range v.modal.selectOrder {
			if idx < 0 || idx >= len(v.modal.items) {
				continue
			}
			out = append(out, vmVolumeEntry{VID: v.modal.items[idx].id, Priority: p})
		}
		b, _ := json.Marshal(out)
		field.pickerValue = string(b)
	case PickerNetworks:
		out := make([]vmNetworkEntry, 0, len(v.modal.selectOrder))
		for _, idx := range v.modal.selectOrder {
			if idx < 0 || idx >= len(v.modal.items) {
				continue
			}
			out = append(out, vmNetworkEntry{NetworkUID: v.modal.items[idx].id})
		}
		b, _ := json.Marshal(out)
		field.pickerValue = string(b)
	}
}

func (v *formView) updatePCIModal(msg tea.KeyMsg) tea.Cmd {
	m := v.modal
	key := msg.String()
	if v.deps.FormOpts == nil || len(v.deps.FormOpts.PCICatalog) == 0 {
		if key == "esc" {
			v.modal = nil
		}
		return nil
	}
	catalog := v.deps.FormOpts.PCICatalog
	vendors := pciVendorList(catalog)

	switch key {
	case "esc":
		if m.pciStep > 0 {
			if m.pciStep == 1 {
				m.pciSearch = ""
			}
			m.pciStep--
			return nil
		}
		v.modal = nil
		return nil
	case "ctrl+s":
		v.confirmPCIPicker()
		v.modal = nil
		return nil
	}

	switch m.pciStep {
	case 0: // vendor
		switch key {
		case "up", "k":
			if m.pciVendorIdx > 0 {
				m.pciVendorIdx--
			}
		case "down", "j":
			if m.pciVendorIdx < len(vendors)-1 {
				m.pciVendorIdx++
			}
		case "enter", "right", "l":
			if len(vendors) > 0 {
				m.pciStep = 1
				m.pciDeviceIdx = 0
				m.pciSearch = ""
				m.scroll = 0
			}
		}
	case 1: // device
		filtered := pciFilteredDeviceIndices(catalog, vendors, m.pciVendorIdx, m.pciSearch)
		switch key {
		case "down", "j":
			if m.pciDeviceIdx < len(filtered)-1 {
				m.pciDeviceIdx++
				maxVis := max(m.h-16, 4)
				if m.pciDeviceIdx >= m.scroll+maxVis {
					m.scroll = m.pciDeviceIdx - maxVis + 1
				}
			}
		case "up", "k":
			if m.pciDeviceIdx > 0 {
				m.pciDeviceIdx--
				if m.pciDeviceIdx < m.scroll {
					m.scroll = m.pciDeviceIdx
				}
			}
		case "enter", "right", "l":
			if len(filtered) > 0 {
				m.pciStep = 2
				m.pciQty = 1
			}
		case "left", "h":
			m.pciStep = 0
			m.pciSearch = ""
			m.scroll = 0
		case "backspace", "ctrl+h":
			if len(m.pciSearch) > 0 {
				m.pciSearch = m.pciSearch[:len(m.pciSearch)-1]
				m.pciDeviceIdx = 0
				m.scroll = 0
			}
		case "ctrl+u":
			m.pciSearch = ""
			m.pciDeviceIdx = 0
			m.scroll = 0
		default:
			if msg.Type == tea.KeyRunes && len(msg.Runes) > 0 {
				m.pciSearch += string(msg.Runes)
				m.pciDeviceIdx = 0
				m.scroll = 0
			}
		}
		pciClampDeviceCursor(m, filtered)
	case 2: // quantity
		filtered := pciFilteredDeviceIndices(catalog, vendors, m.pciVendorIdx, m.pciSearch)
		switch key {
		case "left", "h":
			if m.pciQty > 1 {
				m.pciQty--
			} else {
				m.pciStep = 1
			}
		case "right", "l":
			if m.pciQty < 16 {
				m.pciQty++
			}
		case "enter":
			vendorID := vendors[m.pciVendorIdx].ID
			devices := catalog[vendorID].Devices
			if len(filtered) == 0 || m.pciDeviceIdx >= len(filtered) {
				return nil
			}
			deviceIdx := filtered[m.pciDeviceIdx]
			if deviceIdx < 0 || deviceIdx >= len(devices) {
				return nil
			}
			m.pciAdded = append(m.pciAdded, vmPciEntry{
				Vendor:   vendorID,
				Model:    devices[deviceIdx].ID,
				Quantity: m.pciQty,
			})
			m.pciStep = 0
			m.pciQty = 1
			m.pciSearch = ""
		}
	}
	return nil
}

func pciFilteredDeviceIndices(catalog map[string]*PCIVendor, vendors []PCIVendor, vendorIdx int, query string) []int {
	if vendorIdx < 0 || vendorIdx >= len(vendors) {
		return nil
	}
	devices := catalog[vendors[vendorIdx].ID].Devices
	if len(devices) == 0 {
		return nil
	}
	q := strings.TrimSpace(strings.ToLower(query))
	if q == "" {
		out := make([]int, len(devices))
		for i := range devices {
			out[i] = i
		}
		return out
	}
	out := make([]int, 0, min(len(devices), 64))
	for i, d := range devices {
		name := strings.ToLower(d.Name)
		id := strings.ToLower(d.ID)
		if strings.Contains(name, q) || strings.Contains(id, q) {
			out = append(out, i)
		}
	}
	return out
}

func pciClampDeviceCursor(m *pickerModal, filtered []int) {
	if len(filtered) == 0 {
		m.pciDeviceIdx = 0
		m.scroll = 0
		return
	}
	if m.pciDeviceIdx >= len(filtered) {
		m.pciDeviceIdx = len(filtered) - 1
	}
	if m.pciDeviceIdx < m.scroll {
		m.scroll = m.pciDeviceIdx
	}
	maxVis := max(m.h-16, 4)
	if m.pciDeviceIdx >= m.scroll+maxVis {
		m.scroll = m.pciDeviceIdx - maxVis + 1
	}
}

func (v *formView) confirmPCIPicker() {
	if v.modal == nil {
		return
	}
	b, _ := json.Marshal(v.modal.pciAdded)
	v.fields[v.focus].pickerValue = string(b)
}

func pciVendorList(catalog map[string]*PCIVendor) []PCIVendor {
	if len(catalog) == 0 {
		return nil
	}
	out := make([]PCIVendor, 0, len(catalog))
	for id, v := range catalog {
		if id == "0000" || v == nil {
			continue
		}
		out = append(out, *v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (v *formView) renderPickerModal() string {
	if v.modal == nil {
		return ""
	}
	m := v.modal
	var b strings.Builder
	title := "Select"
	switch m.kind {
	case PickerVolumes:
		title = "Select Volumes"
	case PickerNetworks:
		title = "Select Networks"
	case PickerPCI:
		title = "Select PCI Devices"
	}
	b.WriteString(StylePanelTitle.Render(title) + "\n\n")
	if m.loading {
		b.WriteString(StyleMuted.Render("Loading…") + "\n")
	} else if m.errMsg != "" {
		b.WriteString(StyleError.Render(m.errMsg) + "\n")
	} else if m.kind == PickerPCI {
		b.WriteString(v.renderPCIModalBody())
	} else {
		b.WriteString(v.renderListPickerBody())
	}
	b.WriteString("\n")
	if m.kind == PickerPCI {
		if m.pciStep == 1 {
			b.WriteString(StyleHelp.Render("Type search · j/k move · Enter select · Ctrl+U clear · Esc back"))
		} else {
			b.WriteString(StyleHelp.Render("Enter add · Ctrl+S done · Esc back/cancel"))
		}
	} else {
		b.WriteString(StyleHelp.Render("Space toggle · d remove · Enter/Ctrl+S confirm · Esc cancel"))
	}
	return lipglossBox(b.String(), m.w-4)
}

func (v *formView) renderListPickerBody() string {
	m := v.modal
	if len(m.items) == 0 {
		return StyleMuted.Render("No items available.")
	}
	maxVis := max(m.h-10, 4)
	end := min(m.scroll+maxVis, len(m.items))
	var b strings.Builder
	for i := m.scroll; i < end; i++ {
		item := m.items[i]
		mark := " "
		if _, ok := m.selected[i]; ok {
			mark = "✓"
		}
		line := fmt.Sprintf("%s %s", mark, item.label)
		if item.detail != "" {
			line += StyleMuted.Render(" — "+item.detail)
		}
		if i == m.cursor {
			line = StyleTitle.Render("▸ "+line)
		} else {
			line = "  " + line
		}
		b.WriteString(line + "\n")
	}
	if len(m.selectOrder) > 0 {
		b.WriteString("\n" + StyleMuted.Render(fmt.Sprintf("%d selected (order = boot priority for volumes)", len(m.selectOrder))))
	}
	return b.String()
}

func (v *formView) renderPCIModalBody() string {
	m := v.modal
	if v.deps.FormOpts == nil || len(v.deps.FormOpts.PCICatalog) == 0 {
		return StyleError.Render("PCI catalog unavailable (epm/vendors.json)")
	}
	catalog := v.deps.FormOpts.PCICatalog
	vendors := pciVendorList(catalog)

	var b strings.Builder
	if len(m.pciAdded) > 0 {
		b.WriteString(StyleStatLabel.Render("Selected:") + "\n")
		for _, e := range m.pciAdded {
			qty := e.Quantity
			if qty <= 0 {
				qty = 1
			}
			b.WriteString("  • " + v.deps.FormOpts.pciLabel(e.Vendor, e.Model))
			if qty > 1 {
				b.WriteString(fmt.Sprintf(" ×%d", qty))
			}
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	switch m.pciStep {
	case 0:
		b.WriteString(StyleStatLabel.Render("Vendor") + "\n")
		maxVis := max(m.h-14, 4)
		end := min(maxVis, len(vendors))
		for i := 0; i < end; i++ {
			line := vendors[i].Name
			if i == m.pciVendorIdx {
				line = StyleTitle.Render("▸ " + line)
			} else {
				line = "  " + line
			}
			b.WriteString(line + "\n")
		}
	case 1:
		vendorID := vendors[m.pciVendorIdx].ID
		devices := catalog[vendorID].Devices
		filtered := pciFilteredDeviceIndices(catalog, vendors, m.pciVendorIdx, m.pciSearch)
		b.WriteString(StyleStatLabel.Render("Device — "+vendors[m.pciVendorIdx].Name) + "\n")
		searchLine := m.pciSearch
		if searchLine == "" {
			searchLine = StyleMuted.Render("(type to search model name or ID)")
		} else {
			searchLine = StyleTitle.Render(searchLine) + StyleMuted.Render("█")
		}
		b.WriteString(StyleMuted.Render("Search: ") + searchLine + "\n")
		if len(filtered) == 0 {
			b.WriteString(StyleMuted.Render("No models match.\n"))
			break
		}
		maxVis := max(m.h-16, 4)
		end := min(m.scroll+maxVis, len(filtered))
		for fi := m.scroll; fi < end; fi++ {
			deviceIdx := filtered[fi]
			if deviceIdx < 0 || deviceIdx >= len(devices) {
				continue
			}
			line := devices[deviceIdx].Name + StyleMuted.Render(" ["+devices[deviceIdx].ID+"]")
			if fi == m.pciDeviceIdx {
				line = StyleTitle.Render("▸ " + line)
			} else {
				line = "  " + line
			}
			b.WriteString(line + "\n")
		}
		if len(filtered) > maxVis {
			b.WriteString(StyleMuted.Render(fmt.Sprintf("  %d/%d models", len(filtered), len(devices))) + "\n")
		}
	case 2:
		b.WriteString(StyleStatLabel.Render("Quantity") + "\n")
		b.WriteString(StyleTitle.Render(fmt.Sprintf("  ◀ %d ▶", m.pciQty)))
	}
	return b.String()
}

func lipglossBox(content string, width int) string {
	if width < 20 {
		width = 20
	}
	style := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(colAccent).
		Padding(0, 1).
		Width(width)
	return style.Render(content)
}
