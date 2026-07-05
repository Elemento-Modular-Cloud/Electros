package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestAddTargetWizardSteps(t *testing.T) {
	spec := addTargetFormSpec()
	fv := newFormView(&Deps{FormOpts: DefaultFormOptions()}, 80, 24, "my-clouds/add", spec)
	fv.SetFocused(true)

	view, cmd := fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	fv = view.(*formView)
	if cmd == nil {
		t.Fatal("expected advance cmd on step 0")
	}
	cmd()
	if fv.step != 1 {
		t.Fatalf("step = %d, want 1", fv.step)
	}
	if fv.wizardMode != "hypervisor" {
		t.Fatalf("wizardMode = %q, want hypervisor", fv.wizardMode)
	}
	if fv.optionPick == nil || fv.optionPick.fieldKey != "hypervisor_kind" {
		t.Fatalf("step 1 option picker = %+v", fv.optionPick)
	}

	view, cmd = fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	fv = view.(*formView)
	if cmd == nil {
		t.Fatal("expected advance cmd on step 1")
	}
	cmd()
	if fv.step != 2 {
		t.Fatalf("step = %d, want 2", fv.step)
	}
	if len(fv.fields) < 2 {
		t.Fatalf("step 2 fields = %+v", fieldKeys(fv))
	}

	fv.setFieldValue("name", "lab-atomos")
	fv.setFieldValue("serverurl", "https://10.0.0.8")

	view, cmd = fv.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	fv = view.(*formView)
	if cmd == nil {
		t.Fatal("expected submit cmd on step 2")
	}
	if fv.wizardVals["target_class"] != "hypervisor" {
		t.Fatalf("wizardVals target_class = %q", fv.wizardVals["target_class"])
	}
	if fv.wizardVals["hypervisor_kind"] != "atomos" {
		t.Fatalf("wizardVals hypervisor_kind = %q", fv.wizardVals["hypervisor_kind"])
	}
	if fv.wizardVals["name"] != "lab-atomos" {
		t.Fatalf("wizardVals name = %q", fv.wizardVals["name"])
	}
}

func fieldKeys(fv *formView) []string {
	keys := make([]string, len(fv.fields))
	for i := range fv.fields {
		keys[i] = fv.fields[i].def.Key
	}
	return keys
}
