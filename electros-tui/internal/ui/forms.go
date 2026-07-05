package ui

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
)

type formDoneMsg struct {
	err    error
	notice string
}

type fieldDef struct {
	Key         string
	Label       string
	Placeholder string
	Default     string
	Multiline   bool
	Picker      PickerKind
	Options     []SelectOption
	DependsOn   string
	OptionsMap  map[string][]SelectOption
}

func (d fieldDef) isSelect() bool {
	return len(d.Options) > 0 || len(d.OptionsMap) > 0
}

type formSpec struct {
	title  string
	fields []fieldDef
	submit func(*Deps, map[string]string) tea.Cmd
}

type formField struct {
	def             fieldDef
	input           textinput.Model
	selectIdx       int
	resolvedOptions []SelectOption
	pickerValue     string
}

type formView struct {
	deps    *Deps
	path    string
	title   string
	fields  []formField
	focus   int
	w, h    int
	vp      viewport.Model
	submit  func(*Deps, map[string]string) tea.Cmd
	errMsg  string
	notice  string
	focused bool
	modal   *pickerModal
}

func newFormView(deps *Deps, w, h int, path string, spec formSpec) *formView {
	v := &formView{
		deps:   deps,
		path:   path,
		title:  spec.title,
		w:      w,
		h:      h,
		submit: spec.submit,
		vp:     viewport.New(w, max(h-2, 4)),
	}
	for _, def := range spec.fields {
		def = enrichFieldDef(deps, def)
		ff := formField{def: def}
		if def.isPicker() {
			ff.pickerValue = def.Default
			if ff.pickerValue == "" {
				ff.pickerValue = "[]"
			}
		} else if def.isSelect() {
			ff.selectIdx = 0
		} else {
			in := textinput.New()
			in.Placeholder = def.Placeholder
			if in.Placeholder == "" {
				in.Placeholder = def.Key
			}
			in.CharLimit = 0
			if def.Default != "" {
				in.SetValue(def.Default)
			}
			if def.Multiline {
				in.Width = max(w-4, 20)
			}
			ff.input = in
		}
		v.fields = append(v.fields, ff)
	}
	for i := range v.fields {
		v.resolveFieldOptions(i)
		if v.fields[i].def.isSelect() {
			v.fields[i].selectIdx = selectIndexForDefault(v.fields[i].resolvedOptions, v.fields[i].def.Default)
		}
	}
	if len(v.fields) > 0 {
		v.focusField(0)
	}
	v.applyContextDefaults(deps, path)
	v.syncViewport()
	return v
}

func enrichFieldDef(deps *Deps, def fieldDef) fieldDef {
	if deps == nil || deps.FormOpts == nil {
		return def
	}
	switch def.Key {
	case "os_family":
		if len(deps.FormOpts.OSFamilies) > 0 {
			def.Options = deps.FormOpts.OSFamilies
		}
	case "os_flavour":
		if len(deps.FormOpts.OSFlavours) > 0 {
			def.DependsOn = "os_family"
			def.OptionsMap = deps.FormOpts.OSFlavours
		}
	}
	return def
}

func selectIndexForDefault(opts []SelectOption, def string) int {
	if len(opts) == 0 {
		return 0
	}
	for i, o := range opts {
		if o.Value == def {
			return i
		}
	}
	return 0
}

func (v *formView) resolveFieldOptions(i int) {
	f := &v.fields[i]
	if len(f.def.OptionsMap) > 0 && f.def.DependsOn != "" {
		parent := v.fieldValueByKey(f.def.DependsOn)
		f.resolvedOptions = append([]SelectOption(nil), f.def.OptionsMap[parent]...)
	} else {
		f.resolvedOptions = append([]SelectOption(nil), f.def.Options...)
	}
	if f.selectIdx >= len(f.resolvedOptions) {
		f.selectIdx = 0
	}
}

func (v *formView) fieldValueByKey(key string) string {
	for i := range v.fields {
		if v.fields[i].def.Key == key {
			return v.fields[i].fieldValue()
		}
	}
	return ""
}

func (f *formField) fieldValue() string {
	if f.def.isPicker() {
		return strings.TrimSpace(f.pickerValue)
	}
	if f.def.isSelect() {
		if f.selectIdx >= 0 && f.selectIdx < len(f.resolvedOptions) {
			return f.resolvedOptions[f.selectIdx].Value
		}
		return ""
	}
	return strings.TrimSpace(f.input.Value())
}

func (f *formField) isSelect() bool  { return f.def.isSelect() }
func (f *formField) isPicker() bool  { return f.def.isPicker() }

func (v *formView) applyContextDefaults(deps *Deps, path string) {
	if deps.Context == nil {
		return
	}
	if id := deps.Context["target_id"]; id != "" && strings.Contains(path, "detail") {
		v.setFieldValue("target_id", id)
	}
	if id := deps.Context["vm_uuid"]; id != "" && strings.Contains(path, "detail") {
		v.setFieldValue("uuid", id)
	}
}

func (v *formView) setFieldValue(key, value string) {
	for i := range v.fields {
		if v.fields[i].def.Key != key {
			continue
		}
		if v.fields[i].isSelect() {
			v.fields[i].selectIdx = selectIndexForDefault(v.fields[i].resolvedOptions, value)
		} else if v.fields[i].isPicker() {
			v.fields[i].pickerValue = value
		} else {
			v.fields[i].input.SetValue(value)
		}
	}
}

func (v *formView) Init() tea.Cmd { return textinput.Blink }

func (v *formView) Title() string { return v.title }

func (v *formView) Hints() string {
	if v.modal != nil {
		if v.modal.kind == PickerPCI {
			return "PCI picker · Enter add · Ctrl+S done · Esc back/cancel"
		}
		return "Picker · Space toggle · Enter/Ctrl+S confirm · Esc cancel"
	}
	return "Tab/Enter next · ←/→ selects · Enter opens pickers · Ctrl+S submit · Esc back · j/k scroll"
}

func (v *formView) CapturingInput() bool {
	return v.focused && (len(v.fields) > 0 || v.modal != nil)
}

func (v *formView) SetFocused(f bool) {
	v.focused = f
	if f && len(v.fields) > 0 {
		v.focusField(v.focus)
	} else {
		for i := range v.fields {
			v.fields[i].input.Blur()
		}
	}
}

func (v *formView) focusField(idx int) {
	if len(v.fields) == 0 {
		return
	}
	v.focus = idx
	for i := range v.fields {
		if i == v.focus && !v.fields[i].isSelect() && !v.fields[i].isPicker() {
			v.fields[i].input.Focus()
		} else {
			v.fields[i].input.Blur()
		}
	}
	v.syncViewport()
}

func (v *formView) focusNext() tea.Cmd {
	if len(v.fields) == 0 {
		return nil
	}
	next := (v.focus + 1) % len(v.fields)
	v.focusField(next)
	if !v.fields[next].isSelect() && !v.fields[next].isPicker() {
		return textinput.Blink
	}
	return nil
}

func (v *formView) focusPrev() tea.Cmd {
	if len(v.fields) == 0 {
		return nil
	}
	prev := (v.focus - 1 + len(v.fields)) % len(v.fields)
	v.focusField(prev)
	if !v.fields[prev].isSelect() && !v.fields[prev].isPicker() {
		return textinput.Blink
	}
	return nil
}

func (v *formView) cycleSelect(delta int) {
	f := &v.fields[v.focus]
	if len(f.resolvedOptions) == 0 {
		return
	}
	f.selectIdx = (f.selectIdx + delta + len(f.resolvedOptions)) % len(f.resolvedOptions)
	v.onSelectChanged(v.focus)
}

func (v *formView) onSelectChanged(changedIdx int) {
	key := v.fields[changedIdx].def.Key
	for i := range v.fields {
		if v.fields[i].def.DependsOn == key {
			prev := v.fields[i].fieldValue()
			v.resolveFieldOptions(i)
			v.fields[i].selectIdx = selectIndexForDefault(v.fields[i].resolvedOptions, prev)
			if v.fields[i].selectIdx >= len(v.fields[i].resolvedOptions) {
				v.fields[i].selectIdx = 0
			}
		}
	}
	v.syncViewport()
}

func (v *formView) submitForm() tea.Cmd {
	if v.submit == nil || len(v.fields) == 0 {
		return nil
	}
	return v.submit(v.deps, v.collectVals())
}

func (v *formView) SetSize(w, h int) {
	v.w, v.h = w, h
	v.vp.Width = w
	v.vp.Height = max(h-2, 4)
	for i := range v.fields {
		v.fields[i].input.Width = max(w-4, 20)
	}
	v.syncViewport()
}

func (v *formView) Update(msg tea.Msg) (View, tea.Cmd) {
	if v.modal != nil {
		if cmd, handled := v.updatePickerModal(msg); handled {
			v.syncViewport()
			return v, cmd
		}
	}

	switch msg := msg.(type) {
	case formDoneMsg:
		if msg.err != nil {
			v.errMsg = msg.err.Error()
			v.notice = ""
			v.syncViewport()
			return v, nil
		}
		return v, nil
	case tea.KeyMsg:
		if !v.focused || len(v.fields) == 0 {
			return v, nil
		}
		key := msg.String()
		if key == "ctrl+s" {
			return v, v.submitForm()
		}

		cur := &v.fields[v.focus]
		if cur.isPicker() {
			switch key {
			case "enter", " ":
				return v, v.openPickerModal(cur.def.Picker)
			case "tab", "down":
				return v, v.focusNext()
			case "shift+tab", "up":
				return v, v.focusPrev()
			case "j":
				v.vp.LineDown(1)
				return v, nil
			case "k":
				v.vp.LineUp(1)
				return v, nil
			}
			return v, nil
		}
		if cur.isSelect() {
			switch key {
			case "left", "h":
				v.cycleSelect(-1)
				return v, nil
			case "right", "l":
				v.cycleSelect(1)
				return v, nil
			case "enter", "tab", "down":
				return v, v.focusNext()
			case "shift+tab", "up":
				return v, v.focusPrev()
			case "j":
				v.vp.LineDown(1)
				return v, nil
			case "k":
				v.vp.LineUp(1)
				return v, nil
			}
			return v, nil
		}

		switch key {
		case "tab", "down":
			return v, v.focusNext()
		case "shift+tab", "up":
			return v, v.focusPrev()
		case "enter":
			if !cur.def.Multiline {
				return v, v.focusNext()
			}
		case "j":
			v.vp.LineDown(1)
			return v, nil
		case "k":
			v.vp.LineUp(1)
			return v, nil
		}
	}

	if len(v.fields) == 0 || v.fields[v.focus].isSelect() || v.fields[v.focus].isPicker() {
		return v, nil
	}
	var cmd tea.Cmd
	v.fields[v.focus].input, cmd = v.fields[v.focus].input.Update(msg)
	v.syncViewport()
	return v, cmd
}

func (v *formView) collectVals() map[string]string {
	vals := make(map[string]string, len(v.fields))
	for _, f := range v.fields {
		vals[f.def.Key] = f.fieldValue()
	}
	return vals
}

func (v *formView) renderSelect(f *formField, focused bool) string {
	if len(f.resolvedOptions) == 0 {
		return StyleMuted.Render("(no options)")
	}
	opt := f.resolvedOptions[f.selectIdx]
	label := opt.Label
	if label == "" {
		label = opt.Value
	}
	prefix := StyleMuted.Render("◀ ")
	suffix := StyleMuted.Render(" ▶")
	val := label
	if focused {
		val = StyleTitle.Render(label)
	}
	hint := ""
	if focused {
		hint = StyleHelp.Render("  ←/→")
	}
	return prefix + val + suffix + hint
}

func (v *formView) View() string {
	var b strings.Builder
	if v.title != "" {
		b.WriteString(StyleStatLabel.Render(v.title) + "\n\n")
	}
	if len(v.fields) == 0 {
		b.WriteString(StyleMuted.Render("No form fields for this route.\nPress Esc to go back."))
	} else {
		for i := range v.fields {
			f := &v.fields[i]
			label := f.def.Label
			if label == "" {
				label = f.def.Key
			}
			line := StyleMuted.Render(label)
			if i == v.focus {
				line = StyleTitle.Render(label)
			}
			b.WriteString(line + "\n")
			switch {
			case f.isSelect():
				b.WriteString(v.renderSelect(f, i == v.focus) + "\n\n")
			case f.isPicker():
				summary := f.pickerSummary(v.deps)
				if i == v.focus {
					summary = StyleTitle.Render(summary) + StyleHelp.Render("  Enter")
				}
				b.WriteString(summary + "\n\n")
			default:
				b.WriteString(f.input.View() + "\n\n")
			}
		}
		b.WriteString(StyleHelp.Render("Ctrl+S — submit form") + "\n")
	}
	if v.notice != "" {
		b.WriteString(StyleSuccess.Render(v.notice) + "\n")
	}
	if v.errMsg != "" {
		b.WriteString(StyleError.Render(v.errMsg) + "\n")
	}
	body := b.String()
	v.vp.SetContent(body)
	v.syncViewport()
	view := v.vp.View()
	if v.modal != nil {
		view = overlayCentered(view, v.renderPickerModal(), v.w, v.vp.Height)
	}
	return view
}

func (v *formView) syncViewport() {
	if len(v.fields) == 0 {
		return
	}
	targetLine := v.focus * 3
	if targetLine < v.vp.YOffset {
		v.vp.SetYOffset(targetLine)
	}
	if targetLine > v.vp.YOffset+v.vp.Height-3 {
		v.vp.SetYOffset(max(targetLine-v.vp.Height+3, 0))
	}
}

func navigateBack(deps *Deps) tea.Cmd {
	return func() tea.Msg {
		deps.Router.GoBack()
		return navigateMsg{}
	}
}
