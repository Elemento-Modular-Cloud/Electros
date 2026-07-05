package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestEphemeralWizardFlavourStep(t *testing.T) {
	spec := ephemeralForms("iaas/ephemeral-vms/create")
	if spec.wizard != formWizardEphemeralCreate {
		t.Fatalf("wizard = %v, want ephemeral create", spec.wizard)
	}
	fv := newFormView(&Deps{FormOpts: DefaultFormOptions()}, 100, 30, "iaas/ephemeral-vms/create", spec)
	fv.SetFocused(true)

	view, _ := fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	fv = view.(*formView)
	if fv.step != 1 {
		t.Fatalf("step = %d, want 1 (flavour picker)", fv.step)
	}
	if fv.flavourPick == nil || len(fv.flavourPick.entries) == 0 {
		t.Fatal("expected flavour picker entries")
	}

	view, _ = fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	fv = view.(*formView)
	if fv.step != 2 {
		t.Fatalf("step = %d, want 2 (target picker)", fv.step)
	}
	if fv.targetPick == nil {
		t.Fatal("expected target picker")
	}
}

func TestMergeFlavourSelection(t *testing.T) {
	f := findCloudFlavour("scaleway-GP1-S")
	if f == nil {
		t.Fatal("missing test flavour")
	}
	vals := mergeFlavourSelection(map[string]string{"vm_name": "ephemeral-test"}, f)
	if vals["instance_flavour_catalog"] != "scaleway" {
		t.Fatalf("catalog = %q", vals["instance_flavour_catalog"])
	}
	if vals["instance_flavour"] != "GP1-S" {
		t.Fatalf("flavour = %q", vals["instance_flavour"])
	}
	if vals["slots"] != "2" || vals["ramsize_gb"] != "8" || vals["block_storage_gb"] != "40" {
		t.Fatalf("resources = slots=%q ram=%q block=%q", vals["slots"], vals["ramsize_gb"], vals["block_storage_gb"])
	}
}

func TestFilterFlavours(t *testing.T) {
	all := filterFlavours("aws", "")
	if len(all) < 4 {
		t.Fatalf("expected several AWS flavours, got %d", len(all))
	}
	filtered := filterFlavours("aws", "t3.medium")
	if len(filtered) != 1 || filtered[0].Name != "t3.medium" {
		t.Fatalf("filter result = %+v", filtered)
	}
}
