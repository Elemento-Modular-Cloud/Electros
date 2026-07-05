package ui

import (
	"fmt"
	"strconv"
	"strings"
)

type flavourPickerState struct {
	catalogIdx int
	cursor     int
	scroll     int
	search     string
	entries    []CloudInstanceFlavour
}

func (v *formView) initFlavourPicker() {
	v.flavourPick = &flavourPickerState{}
	v.refreshFlavourEntries()
}

func (v *formView) refreshFlavourEntries() {
	if v.flavourPick == nil {
		return
	}
	if v.flavourPick.catalogIdx >= len(cloudFlavourCatalogs) {
		v.flavourPick.catalogIdx = 0
	}
	catalog := cloudFlavourCatalogs[v.flavourPick.catalogIdx].ID
	v.flavourPick.entries = filterFlavours(catalog, v.flavourPick.search)
	if v.flavourPick.cursor >= len(v.flavourPick.entries) {
		if len(v.flavourPick.entries) == 0 {
			v.flavourPick.cursor = 0
		} else {
			v.flavourPick.cursor = len(v.flavourPick.entries) - 1
		}
	}
	v.syncFlavourScroll()
}

func (v *formView) selectedFlavour() (*CloudInstanceFlavour, error) {
	if v.flavourPick == nil || len(v.flavourPick.entries) == 0 {
		return nil, fmt.Errorf("select an instance flavour")
	}
	if v.flavourPick.cursor < 0 || v.flavourPick.cursor >= len(v.flavourPick.entries) {
		return nil, fmt.Errorf("select an instance flavour")
	}
	f := v.flavourPick.entries[v.flavourPick.cursor]
	return &f, nil
}

func mergeFlavourSelection(vals map[string]string, f *CloudInstanceFlavour) map[string]string {
	if f == nil {
		return vals
	}
	out := make(map[string]string, len(vals)+8)
	for k, v := range vals {
		out[k] = v
	}
	out["instance_flavour_catalog"] = f.CatalogID
	out["instance_flavour"] = f.Name
	out["slots"] = strconv.Itoa(f.VCPUs)
	out["ramsize_gb"] = strconv.Itoa(f.RAMGiB)
	out["block_storage_gb"] = strconv.Itoa(f.BlockStorageGiB)
	return out
}

func (v *formView) updateFlavourPicker(key string) {
	if v.flavourPick == nil {
		return
	}
	n := len(v.flavourPick.entries)
	switch key {
	case "j", "down":
		if n > 0 && v.flavourPick.cursor < n-1 {
			v.flavourPick.cursor++
			v.syncFlavourScroll()
		}
	case "k", "up":
		if v.flavourPick.cursor > 0 {
			v.flavourPick.cursor--
			v.syncFlavourScroll()
		}
	case "left", "h":
		if len(cloudFlavourCatalogs) > 0 {
			v.flavourPick.catalogIdx = (v.flavourPick.catalogIdx - 1 + len(cloudFlavourCatalogs)) % len(cloudFlavourCatalogs)
			v.flavourPick.cursor = 0
			v.refreshFlavourEntries()
		}
	case "right", "l":
		if len(cloudFlavourCatalogs) > 0 {
			v.flavourPick.catalogIdx = (v.flavourPick.catalogIdx + 1) % len(cloudFlavourCatalogs)
			v.flavourPick.cursor = 0
			v.refreshFlavourEntries()
		}
	case "esc":
		v.retreatWizard()
	}
}

func (v *formView) syncFlavourScroll() {
	if v.flavourPick == nil {
		return
	}
	visible := max(v.vp.Height-10, 4)
	if v.flavourPick.cursor < v.flavourPick.scroll {
		v.flavourPick.scroll = v.flavourPick.cursor
	}
	if v.flavourPick.cursor >= v.flavourPick.scroll+visible {
		v.flavourPick.scroll = v.flavourPick.cursor - visible + 1
	}
}

func (v *formView) renderFlavourPicker() string {
	if v.flavourPick == nil {
		return StyleMuted.Render("Loading flavours…")
	}
	catalog := cloudFlavourCatalogs[v.flavourPick.catalogIdx]
	var b strings.Builder
	b.WriteString(StyleStatLabel.Render("Instance flavour") + "\n")
	b.WriteString(StyleMuted.Render("Browse cloud catalogue types — deploy on any connected provider below.") + "\n\n")
	catalogLine := StyleMuted.Render("Catalogue: ")
	catalogLine += StyleTitle.Render(catalog.ShortLabel) + StyleHelp.Render("  ←/→")
	b.WriteString(catalogLine + "\n\n")

	if len(v.flavourPick.entries) == 0 {
		b.WriteString(StyleMuted.Render("No flavours match the current catalogue.\n"))
		return b.String()
	}

	visible := max(v.vp.Height-10, 4)
	start := v.flavourPick.scroll
	end := min(start+visible, len(v.flavourPick.entries))
	for i := start; i < end; i++ {
		f := v.flavourPick.entries[i]
		marker := "  "
		lineStyle := StyleSidebarItem
		if i == v.flavourPick.cursor {
			marker = "▸ "
			lineStyle = StyleSidebarActive
		}
		spec := fmt.Sprintf("%d vCPU · %d GiB RAM · %d GiB block", f.VCPUs, f.RAMGiB, f.BlockStorageGiB)
		title := f.Name + "  " + StyleStat.Render(spec)
		b.WriteString(lineStyle.Render(marker+title) + "\n")
		b.WriteString(StyleMuted.Render("    "+f.Description) + "\n")
	}
	if end < len(v.flavourPick.entries) {
		b.WriteString(StyleMuted.Render(fmt.Sprintf("  … %d more", len(v.flavourPick.entries)-end)) + "\n")
	}
	b.WriteString("\n" + StyleHelp.Render("j/k flavour · ←/→ catalogue · Ctrl+S continue · Esc back"))
	return b.String()
}

func flavourPickerActive(v *formView) bool {
	return v.wizard == formWizardEphemeralCreate && v.step == 1
}

func targetPickerActive(v *formView) bool {
	if v.wizard == formWizardTargetPick && v.step == 1 {
		return true
	}
	return v.wizard == formWizardEphemeralCreate && v.step == 2
}

func hideFormFields(v *formView) bool {
	return flavourPickerActive(v) || optionPickerActive(v) || targetPickerActive(v)
}
