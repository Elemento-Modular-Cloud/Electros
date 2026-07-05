package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/models"
)

type formWizard int

const (
	formWizardNone formWizard = iota
	formWizardTargetPick
	formWizardPublicTargetCreate
	formWizardAddTarget
	formWizardEphemeralCreate
)

// targetPickMode mirrors GUI host-picker data-* filters.
type targetPickMode string

const (
	// AtomOS + Meson targets; excludes Proxmox and ESXi (default host-picker).
	targetPickDefault targetPickMode = "default"
	// Meson public/private only (data-cloud-only — ephemeral VMs).
	targetPickCloudOnly targetPickMode = "cloud_only"
	// AtomOS hosts + Proxmox hypervisor (data-cloud-init-hosts).
	targetPickCloudInitHosts targetPickMode = "cloud_init_hosts"
	// Meson providers that expose a PaaS/SaaS sub_type (new-host-picker + require-service).
	targetPickService targetPickMode = "service"
)

type targetSelection struct {
	TargetID   string
	TargetType string
	Provider   string
	ServerURL  string
	Region     string
}

type targetPickerState struct {
	entries   []targetPickEntry
	cursor    int
	scroll    int
	regionIdx int
	regions   []SelectOption
}

type targetPickEntry struct {
	id         string
	targetType string
	provider   string
	serverURL  string
	label      string
	detail     string
	needsRegion bool
}

func (v *formView) wizardEnabled() bool { return v.wizard != formWizardNone }

func (v *formView) wizardStepCount() int {
	if v.wizard == formWizardAddTarget {
		return 3
	}
	if v.wizard == formWizardEphemeralCreate {
		return 3
	}
	if v.wizard == formWizardPublicTargetCreate {
		return 2
	}
	if v.wizard == formWizardTargetPick {
		return 2
	}
	return 1
}

func (v *formView) wizardStepTitle() string {
	switch v.wizard {
	case formWizardTargetPick:
		if v.step == 0 {
			return "Step 1/2 — Specification"
		}
		switch v.targetPickMode {
		case targetPickCloudOnly:
			return "Step 2/2 — Select deployment provider"
		case targetPickService:
			return "Step 2/2 — Select provider & region"
		case targetPickCloudInitHosts:
			return "Step 2/2 — Select AtomOS host or Proxmox"
		default:
			return "Step 2/2 — Select host"
		}
	case formWizardEphemeralCreate:
		switch v.step {
		case 0:
			return "Step 1/3 — VM specification"
		case 1:
			return "Step 2/3 — Instance flavour"
		default:
			return "Step 3/3 — Deployment provider"
		}
	case formWizardPublicTargetCreate:
		if v.step == 0 {
			return "Step 1/2 — Connection type"
		}
		return "Step 2/2 — Configuration"
	case formWizardAddTarget:
		switch v.step {
		case 0:
			return "Step 1/3 — Target kind"
		case 1:
			if v.wizardMode == "cloud_provider" {
				return "Step 2/3 — Enable cloud provider"
			}
			return "Step 2/3 — Hypervisor type"
		default:
			return "Step 3/3 — Configuration"
		}
	default:
		return v.title
	}
}

func (v *formView) advanceWizard() error {
	switch v.wizard {
	case formWizardTargetPick:
		if v.step == 0 {
			v.step = 1
			v.initTargetPicker()
			return nil
		}
	case formWizardEphemeralCreate:
		if v.step == 0 {
			v.step = 1
			v.initFlavourPicker()
			return nil
		}
		if v.step == 1 {
			if _, err := v.selectedFlavour(); err != nil {
				return err
			}
			v.step = 2
			v.initTargetPicker()
			return nil
		}
	case formWizardPublicTargetCreate:
		if v.step == 0 {
			mode := v.fieldValueByKey("connect_mode")
			if mode == "" {
				return fmt.Errorf("choose a connection type")
			}
			v.wizardMode = mode
			v.step = 1
			v.loadPublicTargetStep2(mode)
			return nil
		}
	case formWizardAddTarget:
		if v.step == 0 {
			mode := v.fieldValueByKey("target_class")
			if mode == "" {
				return fmt.Errorf("choose hypervisor or cloud provider")
			}
			v.mergeWizardVals()
			v.step1Fields = cloneFieldDefs(v.currentFieldDefs())
			v.wizardMode = mode
			v.step = 1
			v.loadAddTargetStep1(mode)
			return nil
		}
		if v.step == 1 {
			v.mergeOptionPickVals()
			key, val, err := v.selectedOptionPick()
			if err != nil {
				return err
			}
			if v.wizardVals == nil {
				v.wizardVals = make(map[string]string)
			}
			v.wizardVals[key] = val
			if v.wizardMode == "cloud_provider" {
				v.wizardSubMode = val
			} else {
				v.wizardSubMode = val
			}
			v.step = 2
			v.optionPick = nil
			v.loadAddTargetStep2(v.wizardMode, v.wizardSubMode)
			return nil
		}
	}
	return fmt.Errorf("already on final step")
}

func (v *formView) retreatWizard() {
	if v.step > 0 {
		switch v.wizard {
		case formWizardAddTarget:
			if v.step == 2 {
				v.step = 1
				v.wizardSubMode = ""
				v.initAddTargetOptionPicker(v.wizardMode)
				v.restoreOptionPickCursor()
				return
			}
			if v.step == 1 {
				v.step = 0
				v.wizardMode = ""
				v.wizardSubMode = ""
				v.wizardVals = nil
				v.optionPick = nil
				v.restoreFieldsFromDefs(v.step1Fields)
				return
			}
		case formWizardEphemeralCreate:
			if v.step == 2 {
				v.step = 1
				v.targetPick = nil
				return
			}
			if v.step == 1 {
				v.step = 0
				v.flavourPick = nil
				return
			}
		default:
			v.step--
			v.targetPick = nil
			if v.wizard == formWizardPublicTargetCreate && v.step == 0 {
				v.restoreFieldsFromDefs(v.step1Fields)
			}
			return
		}
	}
}

func (v *formView) loadPublicTargetStep2(mode string) {
	fields, ok := v.step2Fields[mode]
	if !ok || len(fields) == 0 {
		fields = v.step2Fields["private"]
	}
	if v.deps != nil && v.deps.FormOpts != nil && v.deps.FormOpts.Providers != nil {
		for i := range fields {
			if fields[i].Key == "provider" && len(fields[i].Options) == 0 {
				fields[i].Options = v.deps.FormOpts.Providers.ProviderOptions()
			}
		}
	}
	v.fields = nil
	for _, def := range fields {
		def = enrichFieldDef(v.deps, def)
		ff := formField{def: def}
		if def.isSelect() {
			ff.selectIdx = selectIndexForDefault(def.Options, def.Default)
			ff.resolvedOptions = append([]SelectOption(nil), def.Options...)
		} else {
			in := textinputNew(def, v.w)
			ff.input = in
		}
		v.fields = append(v.fields, ff)
	}
	for i := range v.fields {
		v.resolveFieldOptions(i)
	}
	if len(v.fields) > 0 {
		v.focusField(0)
	}
}

func (v *formView) restoreFieldsFromDefs(defs []fieldDef) {
	if len(defs) == 0 {
		return
	}
	v.fields = nil
	for _, def := range defs {
		def = enrichFieldDef(v.deps, def)
		ff := formField{def: def}
		if def.isSelect() {
			ff.resolvedOptions = append([]SelectOption(nil), def.Options...)
			ff.selectIdx = selectIndexForDefault(ff.resolvedOptions, def.Default)
		} else {
			in := textinputNew(def, v.w)
			ff.input = in
		}
		v.fields = append(v.fields, ff)
	}
	for i := range v.fields {
		v.resolveFieldOptions(i)
	}
	if len(v.fields) > 0 {
		v.focusField(0)
	}
	v.applyWizardValsToFields()
}

func (v *formView) applyWizardValsToFields() {
	if len(v.wizardVals) == 0 {
		return
	}
	for key, val := range v.wizardVals {
		v.setFieldValue(key, val)
	}
}

func (v *formView) restorePublicTargetStep1() {
	v.restoreFieldsFromDefs(v.step1Fields)
}

func (v *formView) currentFieldDefs() []fieldDef {
	out := make([]fieldDef, len(v.fields))
	for i := range v.fields {
		out[i] = v.fields[i].def
	}
	return out
}

func (v *formView) mergeWizardVals() {
	if v.wizardVals == nil {
		v.wizardVals = make(map[string]string)
	}
	for k, val := range v.collectVals() {
		v.wizardVals[k] = val
	}
}

func (v *formView) loadAddTargetStep1(class string) {
	v.initAddTargetOptionPicker(class)
}

func (v *formView) restoreOptionPickCursor() {
	if v.optionPick == nil || v.wizardVals == nil {
		return
	}
	want := v.wizardVals[v.optionPick.fieldKey]
	for i, opt := range v.optionPick.options {
		if opt.Value == want {
			v.optionPick.cursor = i
			v.syncOptionScroll()
			return
		}
	}
}

func (v *formView) loadAddTargetStep2(class, sub string) {
	v.restoreFieldsFromDefs(addTargetConfigFields(class, sub, v.deps))
}

func availableCloudProviders(deps *Deps) []SelectOption {
	if deps == nil || deps.FormOpts == nil || deps.FormOpts.Providers == nil {
		return nil
	}
	all := deps.FormOpts.Providers.ProviderOptions()
	if deps.Session == nil {
		return all
	}
	enabled := map[string]struct{}{}
	for _, t := range deps.Session.Targets {
		if t.TargetType != "meson_public" {
			continue
		}
		if p := t.Provider(); p != "" {
			enabled[p] = struct{}{}
		}
	}
	var out []SelectOption
	for _, o := range all {
		if _, ok := enabled[o.Value]; ok {
			continue
		}
		out = append(out, o)
	}
	return out
}

func addTargetConfigFields(class, sub string, deps *Deps) []fieldDef {
	switch class {
	case "cloud_provider":
		defName := sub
		for _, o := range providerDisplayOptions(deps) {
			if o.Value == sub {
				defName = o.Label
				break
			}
		}
		slug := strings.ToLower(strings.ReplaceAll(defName, " ", "-"))
		return []fieldDef{
			fld("name", "Target name", slug+"-public", defName),
		}
	case "hypervisor":
		if sub == "atomos" {
			return []fieldDef{
				fld("name", "Target ID", "atomos-lab", ""),
				fld("serverurl", "Server IP / URL", "https://10.0.0.5", ""),
			}
		}
		return []fieldDef{
			fld("name", "Target ID", "proxmox-hv", ""),
			fld("serverurl", "Host URL", "https://192.168.1.20:8006", ""),
			fldSelect("type", "Hypervisor type", "hypervisor_proxmox", optHypervisorType),
			fld("username", "Username", "root@pam", ""),
			fld("password", "Password", "", ""),
		}
	}
	return nil
}

func providerDisplayOptions(deps *Deps) []SelectOption {
	if deps == nil || deps.FormOpts == nil || deps.FormOpts.Providers == nil {
		return optCloudProvider
	}
	return deps.FormOpts.Providers.ProviderOptions()
}

func submitAddTargetWizard(deps *Deps, vals map[string]string) tea.Cmd {
	class := vals["target_class"]
	switch class {
	case "cloud_provider":
		provider := vals["provider"]
		if provider == "" {
			return func() tea.Msg { return formDoneMsg{err: fmt.Errorf("provider is required")} }
		}
		name := vals["name"]
		if name == "" {
			for _, o := range providerDisplayOptions(deps) {
				if o.Value == provider {
					name = o.Label
					break
				}
			}
		}
		return createTargetSubmit("meson_public")(deps, map[string]string{
			"name":     name,
			"provider": provider,
		})
	case "hypervisor":
		kind := vals["hypervisor_kind"]
		if kind == "atomos" {
			return createTargetSubmit("atomos_local_ip")(deps, vals)
		}
		return createTargetSubmit("")(deps, vals)
	default:
		return func() tea.Msg { return formDoneMsg{err: fmt.Errorf("unknown target kind")} }
	}
}

func textinputNew(def fieldDef, w int) textinput.Model {
	in := textinput.New()
	in.Placeholder = def.Placeholder
	if in.Placeholder == "" {
		in.Placeholder = def.Key
	}
	in.CharLimit = 0
	if def.Default != "" {
		in.SetValue(def.Default)
	}
	in.Width = max(w-4, 20)
	return in
}

func (v *formView) initTargetPicker() {
	v.targetPick = &targetPickerState{
		entries: eligibleTargets(v.deps, v.targetPickMode, v.requireService),
	}
	if len(v.targetPick.entries) == 0 {
		return
	}
	v.refreshTargetRegions()
	v.focus = 0
}

func isAtomosTargetType(targetType string) bool {
	switch strings.ToLower(targetType) {
	case "atomos_local_ip", "local_discovery_ip", "remote-gateway", "legacy_atomos", "atomos_local_discovery":
		return true
	default:
		return false
	}
}

func isMesonTargetType(targetType string) bool {
	tt := strings.ToLower(targetType)
	return tt == "meson_public" || tt == "meson_private"
}

func targetEligible(deps *Deps, mode targetPickMode, requireService string, t models.TargetRecord) bool {
	tt := strings.ToLower(t.TargetType)

	switch mode {
	case targetPickCloudOnly:
		return isMesonTargetType(tt)
	case targetPickCloudInitHosts:
		return isAtomosTargetType(tt) || tt == "hypervisor_proxmox"
	case targetPickService:
		if tt == "hypervisor_proxmox" || tt == "hypervisor_esxi" {
			return false
		}
		if requireService == "" {
			return isMesonTargetType(tt)
		}
		return targetSupportsService(deps, t, requireService)
	default: // targetPickDefault
		if tt == "hypervisor_proxmox" || tt == "hypervisor_esxi" {
			return false
		}
		return true
	}
}

func targetNeedsRegion(mode targetPickMode, targetType string) bool {
	return strings.ToLower(targetType) == "meson_public" && mode == targetPickService
}

func eligibleTargets(deps *Deps, mode targetPickMode, requireService string) []targetPickEntry {
	if deps == nil || deps.Session == nil {
		return nil
	}
	if mode == "" {
		mode = targetPickDefault
	}
	_, _, _, _, targets := deps.Session.Snapshot()
	out := make([]targetPickEntry, 0, len(targets))
	for _, t := range targets {
		if !targetEligible(deps, mode, requireService, t) {
			continue
		}
		provider := t.Provider()
		label := t.DisplayName()
		detail := targetTypeLabel(t.TargetType)
		if provider != "" {
			detail += " · " + provider
		}
		if ip := t.ServerURL(); ip != "" && !isMesonTargetType(t.TargetType) {
			detail += " · " + ip
		}
		out = append(out, targetPickEntry{
			id:          t.TargetID,
			targetType:  t.TargetType,
			provider:    provider,
			serverURL:   t.ServerURL(),
			label:       label,
			detail:      detail,
			needsRegion: targetNeedsRegion(mode, t.TargetType),
		})
	}
	return out
}

func targetSupportsService(deps *Deps, t models.TargetRecord, service string) bool {
	if !isMesonTargetType(t.TargetType) {
		return false
	}
	if deps.FormOpts == nil || deps.FormOpts.Providers == nil {
		return true
	}
	provider := t.Provider()
	if provider == "" {
		return false
	}
	if !deps.FormOpts.Providers.HasService(provider, service) {
		return false
	}
	// Provider must expose at least one region for this service (matches GUI host-card region picker).
	regions := deps.FormOpts.Providers.RegionsForService(provider, service)
	return len(regions) > 0
}

func (v *formView) refreshTargetRegions() {
	if v.targetPick == nil || v.targetPick.cursor >= len(v.targetPick.entries) {
		return
	}
	ent := v.targetPick.entries[v.targetPick.cursor]
	v.targetPick.regions = nil
	v.targetPick.regionIdx = 0
	if !ent.needsRegion || v.deps.FormOpts == nil || v.deps.FormOpts.Providers == nil {
		return
	}
	regions := v.deps.FormOpts.Providers.RegionsForService(ent.provider, v.requireService)
	if len(regions) == 0 {
		regions = v.deps.FormOpts.Providers.Regions(ent.provider)
	}
	v.targetPick.regions = regions
}

func (v *formView) selectedTarget() (*targetSelection, error) {
	if v.targetPick == nil || len(v.targetPick.entries) == 0 {
		return nil, fmt.Errorf("no cloud targets available — add one under Cloud Targets")
	}
	ent := v.targetPick.entries[v.targetPick.cursor]
	sel := &targetSelection{
		TargetID:   ent.id,
		TargetType: ent.targetType,
		Provider:   ent.provider,
		ServerURL:  ent.serverURL,
	}
	if ent.needsRegion {
		if len(v.targetPick.regions) == 0 {
			return nil, fmt.Errorf("select a region for %s", ent.label)
		}
		sel.Region = v.targetPick.regions[v.targetPick.regionIdx].Value
	}
	return sel, nil
}

func mergeTargetSelection(vals map[string]string, sel *targetSelection, deps *Deps) map[string]string {
	if sel.ServerURL == "" && sel.Provider != "" && deps != nil && deps.FormOpts != nil && deps.FormOpts.Providers != nil {
		sel.ServerURL = deps.FormOpts.Providers.ServerIP(sel.Provider)
	}
	out := make(map[string]string, len(vals)+8)
	for k, v := range vals {
		out[k] = v
	}
	if sel.ServerURL != "" {
		out["ip"] = sel.ServerURL
		out["serverurl"] = sel.ServerURL
		out["servers"] = sel.ServerURL
	}
	if sel.TargetType != "" {
		out["target_type"] = sel.TargetType
	}
	if sel.Provider != "" {
		out["provider"] = sel.Provider
	}
	if sel.Region != "" {
		out["deployment_region"] = sel.Region
		out["region"] = sel.Region
	}
	if sel.TargetID != "" {
		out["target_id"] = sel.TargetID
		out["target"] = sel.TargetID
	}
	return out
}

func (v *formView) submitWithWizard() tea.Cmd {
	if targetPickerActive(v) {
		sel, err := v.selectedTarget()
		if err != nil {
			v.errMsg = err.Error()
			return nil
		}
		vals := mergeTargetSelection(v.collectVals(), sel, v.deps)
		if v.wizard == formWizardEphemeralCreate {
			flavour, err := v.selectedFlavour()
			if err != nil {
				v.errMsg = err.Error()
				return nil
			}
			vals = mergeFlavourSelection(vals, flavour)
		}
		return v.submit(v.deps, vals)
	}
	if v.wizard == formWizardPublicTargetCreate && v.step == 1 {
		vals := v.collectVals()
		vals["connect_mode"] = v.wizardMode
		tt := "meson_public"
		return createTargetSubmit(tt)(v.deps, vals)
	}
	if v.wizard == formWizardAddTarget && v.step == 2 {
		v.mergeWizardVals()
		return submitAddTargetWizard(v.deps, v.wizardVals)
	}
	if v.wizard == formWizardAddTarget && v.step < 2 {
		if err := v.advanceWizard(); err != nil {
			v.errMsg = err.Error()
			return nil
		}
		v.errMsg = ""
		v.syncViewport()
		return textinput.Blink
	}
	if v.wizard == formWizardEphemeralCreate && v.step < 2 {
		if err := v.advanceWizard(); err != nil {
			v.errMsg = err.Error()
			return nil
		}
		v.errMsg = ""
		v.syncViewport()
		return textinput.Blink
	}
	if v.wizardEnabled() && v.step == 0 {
		if err := v.advanceWizard(); err != nil {
			v.errMsg = err.Error()
			return nil
		}
		v.errMsg = ""
		v.syncViewport()
		return textinput.Blink
	}
	return v.submit(v.deps, v.collectVals())
}

func (v *formView) updateTargetPicker(key string) tea.Cmd {
	if v.targetPick == nil {
		return nil
	}
	n := len(v.targetPick.entries)
	switch key {
	case "j", "down":
		if n > 0 && v.targetPick.cursor < n-1 {
			v.targetPick.cursor++
			v.refreshTargetRegions()
			v.syncTargetScroll()
		}
	case "k", "up":
		if v.targetPick.cursor > 0 {
			v.targetPick.cursor--
			v.refreshTargetRegions()
			v.syncTargetScroll()
		}
	case "left", "h":
		if len(v.targetPick.regions) > 0 {
			v.targetPick.regionIdx = (v.targetPick.regionIdx - 1 + len(v.targetPick.regions)) % len(v.targetPick.regions)
		}
	case "right", "l":
		if len(v.targetPick.regions) > 0 {
			v.targetPick.regionIdx = (v.targetPick.regionIdx + 1) % len(v.targetPick.regions)
		}
	case "esc":
		v.retreatWizard()
	case "ctrl+s":
		return v.submitWithWizard()
	}
	return nil
}

func (v *formView) syncTargetScroll() {
	if v.targetPick == nil {
		return
	}
	visible := max(v.vp.Height-8, 4)
	if v.targetPick.cursor < v.targetPick.scroll {
		v.targetPick.scroll = v.targetPick.cursor
	}
	if v.targetPick.cursor >= v.targetPick.scroll+visible {
		v.targetPick.scroll = v.targetPick.cursor - visible + 1
	}
}

func (v *formView) renderTargetPicker() string {
	if v.targetPick == nil {
		return StyleMuted.Render("Loading targets…")
	}
	if len(v.targetPick.entries) == 0 {
		return StyleError.Render("No eligible targets for this resource.") + "\n" +
			StyleMuted.Render(v.targetPickEmptyHint()) + "\n" +
			StyleMuted.Render("Add targets under Cloud Targets, then press Esc to go back.")
	}
	var b strings.Builder
	b.WriteString(StyleHelp.Render(v.targetPickControlsHint()) + "\n")
	b.WriteString(StyleMuted.Render(v.targetPickEligibilityHint()) + "\n\n")
	visible := max(v.vp.Height-10, 4)
	end := min(v.targetPick.scroll+visible, len(v.targetPick.entries))
	for i := v.targetPick.scroll; i < end; i++ {
		ent := v.targetPick.entries[i]
		b.WriteString(renderTargetPickLine(ent, i == v.targetPick.cursor))
		b.WriteString("\n")
	}
	if ent := v.targetPick.entries[v.targetPick.cursor]; ent.needsRegion {
		b.WriteString("\n" + StyleStatLabel.Render("Region") + "\n")
		if len(v.targetPick.regions) == 0 {
			b.WriteString(StyleMuted.Render("  (no regions for this provider)\n"))
		} else {
			b.WriteString("  " + v.renderRegionSelect() + "\n")
		}
	} else if ent.serverURL != "" {
		b.WriteString("\n" + StyleMuted.Render("Host: "+ent.serverURL) + "\n")
	}
	return b.String()
}

func (v *formView) targetPickEligibilityHint() string {
	switch v.targetPickMode {
	case targetPickCloudOnly:
		return "Showing public & private cloud providers only (Meson)."
	case targetPickCloudInitHosts:
		return "Showing AtomOS hosts and Proxmox hypervisors only."
	case targetPickService:
		if v.requireService != "" {
			return fmt.Sprintf("Showing providers with %s support and at least one region.", v.requireService)
		}
		return "Showing Meson cloud providers."
	default:
		return "Showing AtomOS and cloud targets (Proxmox/ESXi hypervisors excluded)."
	}
}

func (v *formView) targetPickEmptyHint() string {
	switch v.targetPickMode {
	case targetPickCloudOnly:
		return "Connect a Meson public or private target under Cloud Targets."
	case targetPickCloudInitHosts:
		return "Connect an AtomOS host or Proxmox hypervisor under Cloud Targets."
	case targetPickService:
		if v.requireService != "" {
			return fmt.Sprintf("No target offers %s in supported_providers.json with full support.", v.requireService)
		}
		return "Connect a Meson cloud target under Cloud Targets."
	default:
		return "Connect an AtomOS or cloud target (not bare hypervisors)."
	}
}

func (v *formView) targetPickControlsHint() string {
	if v.targetPickMode == targetPickService {
		return "j/k provider · ←/→ region · Ctrl+S create · Esc back"
	}
	return "j/k target · Ctrl+S create · Esc back"
}

func (v *formView) renderRegionSelect() string {
	if v.targetPick == nil || len(v.targetPick.regions) == 0 {
		return StyleMuted.Render("(none)")
	}
	opt := v.targetPick.regions[v.targetPick.regionIdx]
	label := opt.Label
	if label == "" {
		label = opt.Value
	}
	return StyleMuted.Render("◀ ") + StyleTitle.Render(label) + StyleMuted.Render(" ▶") + StyleHelp.Render("  ←/→")
}

func (v *formView) renderSpecReview() string {
	if !v.wizardEnabled() {
		return ""
	}
	showReview := (v.wizard == formWizardTargetPick && v.step == 1) ||
		(v.wizard == formWizardEphemeralCreate && v.step == 2)
	if !showReview {
		return ""
	}
	var b strings.Builder
	b.WriteString(StyleStatLabel.Render("Specification") + "\n")
	shown := 0
	for _, f := range v.fields {
		val := f.fieldValue()
		if val == "" || val == "[]" {
			continue
		}
		label := f.def.Label
		if label == "" {
			label = f.def.Key
		}
		if f.isPicker() {
			val = f.pickerSummary(v.deps)
		}
		if len(val) > 48 {
			val = val[:45] + "…"
		}
		b.WriteString(fmt.Sprintf("  %s: %s\n", label, StyleStat.Render(val)))
		shown++
		if shown >= 6 {
			b.WriteString(StyleMuted.Render("  …\n"))
			break
		}
	}
	if v.wizard == formWizardEphemeralCreate {
		if flavour, err := v.selectedFlavour(); err == nil && flavour != nil {
			line := fmt.Sprintf("%s · %s", catalogShortLabel(flavour.CatalogID), flavour.Name)
			b.WriteString(fmt.Sprintf("  Instance flavour: %s\n", StyleStat.Render(line)))
			spec := fmt.Sprintf("%d vCPU · %d GiB RAM · %d GiB block", flavour.VCPUs, flavour.RAMGiB, flavour.BlockStorageGiB)
			b.WriteString(fmt.Sprintf("  Resources: %s\n", StyleStat.Render(spec)))
		}
	}
	return b.String()
}

func (v *formView) renderWizardHeader() string {
	if !v.wizardEnabled() {
		return ""
	}
	title := v.wizardStepTitle()
	if v.title != "" {
		return StyleBrand.Render(v.title) + "\n" + StyleStatLabel.Render(title) + "\n\n"
	}
	return StyleStatLabel.Render(title) + "\n\n"
}

func cloneFieldDefs(in []fieldDef) []fieldDef {
	out := make([]fieldDef, len(in))
	copy(out, in)
	return out
}
