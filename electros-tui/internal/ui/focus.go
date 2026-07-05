package ui

// FocusArea controls which panel keyboard input targets.
type FocusArea string

const (
	FocusSidebar FocusArea = "sidebar"
	FocusContent FocusArea = "content"
	FocusChat    FocusArea = "chat"
)

// focusable views can enable/disable input capture (e.g. tables, forms).
type focusable interface {
	SetFocused(bool)
}

// textCapturing views (forms) consume plain letter keys, so global
// single-letter shortcuts must be suppressed while they are focused.
type textCapturing interface {
	CapturingInput() bool
}

func (a *App) syncContentFocus() {
	if a.content == nil {
		return
	}
	if f, ok := a.content.(focusable); ok {
		f.SetFocused(a.focusArea == FocusContent)
	}
}

// cycleFocus advances Tab focus: sidebar -> content -> chat (when open).
func (a *App) cycleFocus() {
	switch a.focusArea {
	case FocusSidebar:
		a.focusArea = FocusContent
	case FocusContent:
		if a.chatOpen {
			a.focusArea = FocusChat
		} else {
			a.focusArea = FocusSidebar
		}
	case FocusChat:
		a.focusArea = FocusSidebar
	}
	a.syncChatFocus()
	a.syncContentFocus()
}

func (a *App) syncChatFocus() {
	if a.focusArea == FocusChat {
		a.chatInput.Focus()
	} else {
		a.chatInput.Blur()
	}
}

func (a *App) contentCapturesText() bool {
	if a.content == nil {
		return false
	}
	if t, ok := a.content.(textCapturing); ok {
		return t.CapturingInput() && a.focusArea == FocusContent
	}
	return false
}
