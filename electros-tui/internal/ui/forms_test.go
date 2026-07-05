package ui

import (
	"path/filepath"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestFormSelectCycleAndSubmit(t *testing.T) {
	spec := formSpec{
		title: "Test",
		fields: []fieldDef{
			fldSelect("format", "Format", "qcow2", optVolumeFormat),
			fld("name", "Name", "", "vol-1"),
		},
		submit: func(_ *Deps, vals map[string]string) tea.Cmd {
			return func() tea.Msg {
				if vals["format"] != "raw" {
					t.Fatalf("format = %q", vals["format"])
				}
				if vals["name"] != "vol-1" {
					t.Fatalf("name = %q", vals["name"])
				}
				return formDoneMsg{notice: "ok"}
			}
		},
	}
	fv := newFormView(&Deps{FormOpts: DefaultFormOptions()}, 80, 24, "test", spec)
	fv.SetFocused(true)

	var view View
	var cmd tea.Cmd
	view, _ = fv.Update(tea.KeyMsg{Type: tea.KeyRight})
	fv = view.(*formView)
	if fv.fields[0].fieldValue() != "raw" {
		t.Fatalf("expected raw, got %q", fv.fields[0].fieldValue())
	}

	view, _ = fv.Update(tea.KeyMsg{Type: tea.KeyEnter})
	fv = view.(*formView)
	if fv.focus != 1 {
		t.Fatalf("focus = %d, want 1", fv.focus)
	}

	view, cmd = fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	if cmd == nil {
		t.Fatal("expected submit cmd on ctrl+s")
	}
	msg := cmd()
	done, ok := msg.(formDoneMsg)
	if !ok || done.notice != "ok" {
		t.Fatalf("submit msg = %#v", msg)
	}
}

func TestOSFlavourDependsOnFamily(t *testing.T) {
	opts := DefaultFormOptions()
	fv := newFormView(&Deps{FormOpts: opts}, 80, 24, "test", formSpec{
		title: "VM",
		fields: []fieldDef{
			fldSelect("os_family", "OS family", "linux", nil),
			fldSelect("os_flavour", "OS flavour", "ubuntu", nil),
		},
	})
	fv.SetFocused(true)
	fv.focusField(0)

	view, _ := fv.Update(tea.KeyMsg{Type: tea.KeyRight}) // windows
	fv = view.(*formView)
	if fv.fieldValueByKey("os_family") != "windows" {
		t.Fatalf("family = %q", fv.fieldValueByKey("os_family"))
	}

	flavour := fv.fieldValueByKey("os_flavour")
	valid := false
	for _, o := range opts.OSFlavours["windows"] {
		if o.Value == flavour {
			valid = true
			break
		}
	}
	if !valid {
		t.Fatalf("flavour %q not valid for windows", flavour)
	}
}

func TestPCIFilterDevices(t *testing.T) {
	catalog := map[string]*PCIVendor{
		"10de": {
			ID:   "10de",
			Name: "NVIDIA Corporation",
			Devices: []PCIDevice{
				{Name: "GeForce RTX 4090", ID: "2684"},
				{Name: "GeForce GTX 1080", ID: "1b80"},
				{Name: "Tesla T4", ID: "1eb8"},
			},
		},
	}
	vendors := pciVendorList(catalog)
	got := pciFilteredDeviceIndices(catalog, vendors, 0, "4090")
	if len(got) != 1 || catalog["10de"].Devices[got[0]].ID != "2684" {
		t.Fatalf("filter 4090 = %v", got)
	}
	got = pciFilteredDeviceIndices(catalog, vendors, 0, "geforce")
	if len(got) != 2 {
		t.Fatalf("filter geforce = %v, want 2", got)
	}
	got = pciFilteredDeviceIndices(catalog, vendors, 0, "rtx 4090")
	if len(got) != 1 || catalog["10de"].Devices[got[0]].ID != "2684" {
		t.Fatalf("filter rtx 4090 = %v", got)
	}
}

func TestPCIPickerOpensWithoutLoading(t *testing.T) {
	catalog, err := loadPCICatalog(filepath.Join("..", "..", "..", "elemento-gui-new", "electros"))
	if err != nil {
		t.Skipf("PCI catalog unavailable: %v", err)
	}
	fv := newFormView(&Deps{FormOpts: &FormOptions{PCICatalog: catalog}}, 80, 24, "test", formSpec{
		title:  "VM",
		fields: []fieldDef{fldPicker("pcidev_json", "PCI devices", PickerPCI, "[]")},
	})
	fv.SetFocused(true)
	view, cmd := fv.Update(tea.KeyMsg{Type: tea.KeyEnter})
	fv = view.(*formView)
	if cmd != nil {
		t.Fatal("PCI picker should not async-load")
	}
	if fv.modal == nil {
		t.Fatal("expected modal open")
	}
	if fv.modal.loading {
		t.Fatal("PCI modal should not stay in loading state")
	}
}
