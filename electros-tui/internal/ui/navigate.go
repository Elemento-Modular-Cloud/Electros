package ui

import (
	tea "github.com/charmbracelet/bubbletea"
)

func navigateTo(deps *Deps, path string) tea.Cmd {
	return func() tea.Msg {
		if deps.OnNavigate != nil {
			deps.OnNavigate(path)
		}
		return navigateMsg{path: path}
	}
}
