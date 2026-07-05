package ui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

const (
	panelInnerX          = 1 // skip left border
	panelInnerY          = 1 // skip top border
	sidebarNavStartInner = 3 // Fleet header + stats + blank
	doubleClickWindow    = 450 * time.Millisecond
)

// mouseTarget views handle clicks and scroll within the content panel body.
type mouseTarget interface {
	HandleMouse(msg tea.MouseMsg, innerX, innerY int) tea.Cmd
}

func (a *App) handleShellMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	if a.width <= 0 || a.height <= 0 {
		return a, nil
	}
	lay := computeLayout(a.width, a.height, a.chatOpen)

	// Header and status bar are not interactive.
	if msg.Y == 0 || msg.Y >= a.height-1 {
		return a, nil
	}

	bodyY := msg.Y - 1
	if bodyY < 0 || bodyY >= lay.bodyH {
		return a, nil
	}

	switch {
	case msg.X < lay.sidebarW:
		return a.handleSidebarMouse(lay, msg, bodyY)
	case msg.X < lay.sidebarW+lay.contentW:
		return a.handleContentMouse(lay, msg, bodyY)
	case lay.chatW > 0 && msg.X < lay.sidebarW+lay.contentW+lay.chatW:
		return a.handleChatMouse(msg, bodyY)
	}
	return a, nil
}

func (a *App) handleSidebarMouse(lay layout, msg tea.MouseMsg, bodyY int) (tea.Model, tea.Cmd) {
	a.focusArea = FocusSidebar
	a.syncContentFocus()

	if msg.Button != tea.MouseButtonLeft || msg.Action != tea.MouseActionPress {
		return a, nil
	}

	innerY := bodyY - panelInnerY
	idx := sidebarItemIndex(innerY)
	routes := a.deps.Router.TopLevelRoutes()
	if idx < 0 || idx >= len(routes) {
		return a, nil
	}

	a.sidebarIdx = idx
	_ = a.deps.Router.NavigateTo(routes[idx].Path)
	a.loadCurrentView()
	a.focusArea = FocusContent
	a.syncContentFocus()
	return a, nil
}

func sidebarItemIndex(innerY int) int {
	idx := innerY - sidebarNavStartInner
	if idx < 0 {
		return -1
	}
	return idx
}

func (a *App) handleContentMouse(lay layout, msg tea.MouseMsg, bodyY int) (tea.Model, tea.Cmd) {
	a.focusArea = FocusContent
	a.syncContentFocus()

	innerX := msg.X - lay.sidebarW - panelInnerX
	innerY := bodyY - panelInnerY
	if innerX < 0 || innerY < 0 {
		return a, nil
	}

	if a.content == nil {
		return a, nil
	}
	if t, ok := a.content.(mouseTarget); ok {
		if cmd := t.HandleMouse(msg, innerX, innerY); cmd != nil {
			return a, cmd
		}
	}
	return a, nil
}

func (a *App) handleChatMouse(msg tea.MouseMsg, bodyY int) (tea.Model, tea.Cmd) {
	a.focusArea = FocusChat
	a.syncChatFocus()
	a.syncContentFocus()

	if bodyY-panelInnerY < 0 {
		return a, nil
	}

	var cmds []tea.Cmd
	var cmd tea.Cmd
	a.chatView, cmd = a.chatView.Update(msg)
	if cmd != nil {
		cmds = append(cmds, cmd)
	}
	a.chatInput, cmd = a.chatInput.Update(msg)
	if cmd != nil {
		cmds = append(cmds, cmd)
	}
	return a, tea.Batch(cmds...)
}

func isDoubleClick(lastIdx, idx int, lastAt time.Time) bool {
	return idx >= 0 && idx == lastIdx && time.Since(lastAt) < doubleClickWindow
}
