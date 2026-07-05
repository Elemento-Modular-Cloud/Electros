package ui

import (
	"fmt"
	"strings"
)

type optionPickerState struct {
	fieldKey string
	options  []SelectOption
	cursor   int
	scroll   int
}

func (v *formView) initAddTargetOptionPicker(class string) {
	v.fields = nil
	switch class {
	case "cloud_provider":
		opts := availableCloudProviders(v.deps)
		if len(opts) == 0 {
			opts = []SelectOption{{Value: "", Label: "(no providers available)"}}
		}
		v.optionPick = &optionPickerState{fieldKey: "provider", options: opts}
	case "hypervisor":
		v.optionPick = &optionPickerState{
			fieldKey: "hypervisor_kind",
			options: []SelectOption{
				{Value: "atomos", Label: "AtomOS host"},
				{Value: "third_party", Label: "Third-party hypervisor (Proxmox / ESXi)"},
			},
		}
	default:
		v.optionPick = nil
	}
	v.syncOptionScroll()
}

func (v *formView) selectedOptionPick() (fieldKey, value string, err error) {
	if v.optionPick == nil || len(v.optionPick.options) == 0 {
		return "", "", fmt.Errorf("choose an option")
	}
	if v.optionPick.cursor < 0 || v.optionPick.cursor >= len(v.optionPick.options) {
		return "", "", fmt.Errorf("choose an option")
	}
	opt := v.optionPick.options[v.optionPick.cursor]
	if opt.Value == "" {
		return "", "", fmt.Errorf("choose an option")
	}
	return v.optionPick.fieldKey, opt.Value, nil
}

func (v *formView) mergeOptionPickVals() {
	if v.optionPick == nil {
		return
	}
	if v.wizardVals == nil {
		v.wizardVals = make(map[string]string)
	}
	if key, val, err := v.selectedOptionPick(); err == nil {
		v.wizardVals[key] = val
	}
}

func (v *formView) updateOptionPicker(key string) {
	if v.optionPick == nil {
		return
	}
	n := len(v.optionPick.options)
	switch key {
	case "j", "down":
		if n > 0 && v.optionPick.cursor < n-1 {
			v.optionPick.cursor++
			v.syncOptionScroll()
		}
	case "k", "up":
		if v.optionPick.cursor > 0 {
			v.optionPick.cursor--
			v.syncOptionScroll()
		}
	case "esc":
		v.retreatWizard()
	}
}

func (v *formView) syncOptionScroll() {
	if v.optionPick == nil {
		return
	}
	visible := max(v.vp.Height-10, 4)
	if v.optionPick.cursor < v.optionPick.scroll {
		v.optionPick.scroll = v.optionPick.cursor
	}
	if v.optionPick.cursor >= v.optionPick.scroll+visible {
		v.optionPick.scroll = v.optionPick.cursor - visible + 1
	}
}

func (v *formView) renderOptionPicker() string {
	if v.optionPick == nil {
		return StyleMuted.Render("Loading options…")
	}
	if len(v.optionPick.options) == 0 {
		return StyleMuted.Render("(no options)")
	}
	title := "Select option"
	switch v.optionPick.fieldKey {
	case "provider":
		title = "Enable cloud provider"
	case "hypervisor_kind":
		title = "Hypervisor host type"
	}
	var b strings.Builder
	b.WriteString(StyleStatLabel.Render(title) + "\n\n")
	visible := max(v.vp.Height-10, 4)
	end := min(v.optionPick.scroll+visible, len(v.optionPick.options))
	for i := v.optionPick.scroll; i < end; i++ {
		opt := v.optionPick.options[i]
		b.WriteString(renderOptionPickLine(v.optionPick.fieldKey, opt, i == v.optionPick.cursor))
		b.WriteByte('\n')
	}
	b.WriteString("\n" + StyleHelp.Render("j/k choose · Ctrl+S continue · Esc back"))
	return b.String()
}

func renderOptionPickLine(fieldKey string, opt SelectOption, selected bool) string {
	badge := optionPickBadge(fieldKey, opt.Value)
	label := opt.Label
	if label == "" {
		label = opt.Value
	}
	marker := "  "
	style := StyleSidebarItem
	if selected {
		marker = "▸ "
		style = StyleSidebarActive
	}
	body := badge + "  " + label
	if selected {
		return style.Render(marker+body)
	}
	return style.Render(marker) + body
}

func optionPickBadge(fieldKey, value string) string {
	switch fieldKey {
	case "provider":
		if value == "" {
			return StyleMuted.Render("—")
		}
		return renderProviderTag(value)
	case "hypervisor_kind":
		switch value {
		case "atomos":
			return renderAtomosBadge()
		case "third_party":
			return renderProviderTag("proxmox") + " " + renderProviderTag("esxi")
		}
	}
	return ""
}

func renderAtomosBadge() string {
	bg := providerColors["atomos"]
	if bg == "" {
		bg = "#118acb"
	}
	return renderTag("AtomOS", bg, contrastingFG(bg))
}

func targetPickEntryBadge(ent targetPickEntry) string {
	tt := normalizeKey(ent.targetType)
	switch {
	case tt == "hypervisor_proxmox":
		return renderProviderTag("proxmox")
	case tt == "hypervisor_esxi":
		return renderProviderTag("esxi")
	case isMesonTargetType(tt):
		if p := normalizeKey(ent.provider); p != "" {
			return renderProviderTag(p)
		}
		return renderTargetTypeBadge(ent.targetType)
	case isAtomosTargetType(tt):
		return renderAtomosBadge()
	default:
		if p := normalizeKey(ent.provider); p != "" {
			return renderProviderTag(p)
		}
		return renderTargetTypeBadge(ent.targetType)
	}
}

func renderTargetPickLine(ent targetPickEntry, selected bool) string {
	badge := targetPickEntryBadge(ent)
	detail := StyleMuted.Render(ent.detail)
	marker := "  "
	if selected {
		marker = "▸ "
		return StyleSidebarActive.Render(marker+badge+"  "+ent.label) + "  " + detail
	}
	return StyleSidebarItem.Render(marker) + badge + "  " + ent.label + "  " + detail
}

func optionPickerActive(v *formView) bool {
	return v.wizard == formWizardAddTarget && v.step == 1 && v.optionPick != nil
}
