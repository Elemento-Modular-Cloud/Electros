package ui

import (
	"github.com/charmbracelet/lipgloss"
)

var noColor bool

// Palette — accent matches Electros brand #FFA600.
var (
	colAccent   = lipgloss.Color("#FFA600")
	colAccentHi = lipgloss.Color("#FFC940")
	colText     = lipgloss.Color("252")
	colMuted    = lipgloss.Color("243")
	colFaint    = lipgloss.Color("238")
	colBorder   = lipgloss.Color("238")
	colError    = lipgloss.Color("203")
	colSuccess  = lipgloss.Color("42")
	colBarBg    = lipgloss.Color("235")
	colChipFg   = lipgloss.Color("16") // dark text on amber chips
)

// Styles used across the shell and views.
var (
	StyleTitle         lipgloss.Style
	StyleError         lipgloss.Style
	StyleSuccess       lipgloss.Style
	StyleMuted         lipgloss.Style
	StyleHelp          lipgloss.Style
	StyleDim           lipgloss.Style
	StyleSidebarActive lipgloss.Style
	StyleSidebarItem   lipgloss.Style
	StyleSidebarOpen   lipgloss.Style

	// Header bar.
	StyleHeaderBar lipgloss.Style
	StyleBrand     lipgloss.Style
	StyleCrumb     lipgloss.Style
	StyleCrumbSep  lipgloss.Style
	StyleUser      lipgloss.Style
	StyleDotOK     lipgloss.Style
	StyleDotBad    lipgloss.Style

	// Status bar.
	StyleStatusBar  lipgloss.Style
	StyleChip       lipgloss.Style
	StyleStatusOK   lipgloss.Style
	StyleStatusErr  lipgloss.Style
	StyleStatusHint lipgloss.Style
	StyleStat       lipgloss.Style
	StyleStatLabel  lipgloss.Style

	// Panels.
	StylePanelTitle        lipgloss.Style
	StylePanelTitleBlurred lipgloss.Style

	panelBorderFocused lipgloss.TerminalColor = colAccent
	panelBorderBlurred lipgloss.TerminalColor = colBorder
)

func init() {
	applyTheme(true)
}

func applyTheme(color bool) {
	if color {
		StyleTitle = lipgloss.NewStyle().Bold(true).Foreground(colAccent)
		StyleError = lipgloss.NewStyle().Foreground(colError)
		StyleSuccess = lipgloss.NewStyle().Foreground(colSuccess)
		StyleMuted = lipgloss.NewStyle().Foreground(colMuted)
		StyleHelp = lipgloss.NewStyle().Foreground(colMuted)
		StyleDim = lipgloss.NewStyle().Foreground(colFaint)

		StyleSidebarActive = lipgloss.NewStyle().Bold(true).Background(colAccent).Foreground(colChipFg)
		StyleSidebarItem = lipgloss.NewStyle().Foreground(colText)
		StyleSidebarOpen = lipgloss.NewStyle().Foreground(colAccentHi)

		StyleHeaderBar = lipgloss.NewStyle().Background(colBarBg).Foreground(colText)
		StyleBrand = lipgloss.NewStyle().Bold(true).Background(colAccent).Foreground(colChipFg).Padding(0, 1)
		StyleCrumb = lipgloss.NewStyle().Background(colBarBg).Foreground(colText)
		StyleCrumbSep = lipgloss.NewStyle().Background(colBarBg).Foreground(colMuted)
		StyleUser = lipgloss.NewStyle().Background(colBarBg).Foreground(colMuted)
		StyleDotOK = lipgloss.NewStyle().Background(colBarBg).Foreground(colSuccess)
		StyleDotBad = lipgloss.NewStyle().Background(colBarBg).Foreground(colError)

		StyleStatusBar = lipgloss.NewStyle().Background(colBarBg).Foreground(colMuted)
		StyleChip = lipgloss.NewStyle().Bold(true).Background(colAccent).Foreground(colChipFg).Padding(0, 1)
		StyleStatusOK = lipgloss.NewStyle().Background(colBarBg).Foreground(colSuccess)
		StyleStatusErr = lipgloss.NewStyle().Background(colBarBg).Foreground(colError)
		StyleStatusHint = lipgloss.NewStyle().Background(colBarBg).Foreground(colMuted)
		StyleStat = lipgloss.NewStyle().Background(colBarBg).Foreground(colAccentHi)
		StyleStatLabel = lipgloss.NewStyle().Background(colBarBg).Foreground(colMuted)

		StylePanelTitle = lipgloss.NewStyle().Bold(true).Foreground(colAccent)
		StylePanelTitleBlurred = lipgloss.NewStyle().Foreground(colMuted)

		panelBorderFocused = colAccent
		panelBorderBlurred = colBorder
	} else {
		plain := lipgloss.NewStyle()
		bold := lipgloss.NewStyle().Bold(true)

		StyleTitle = bold
		StyleError = plain
		StyleSuccess = plain
		StyleMuted = plain
		StyleHelp = plain
		StyleDim = plain

		StyleSidebarActive = lipgloss.NewStyle().Bold(true).Reverse(true)
		StyleSidebarItem = plain
		StyleSidebarOpen = bold

		StyleHeaderBar = plain
		StyleBrand = bold.Padding(0, 1)
		StyleCrumb = plain
		StyleCrumbSep = plain
		StyleUser = plain
		StyleDotOK = plain
		StyleDotBad = plain

		StyleStatusBar = plain
		StyleChip = lipgloss.NewStyle().Bold(true).Reverse(true).Padding(0, 1)
		StyleStatusOK = plain
		StyleStatusErr = plain
		StyleStatusHint = plain
		StyleStat = plain
		StyleStatLabel = plain

		StylePanelTitle = bold
		StylePanelTitleBlurred = plain

		panelBorderFocused = lipgloss.NoColor{}
		panelBorderBlurred = lipgloss.NoColor{}
	}
}

// SetNoColor disables lipgloss colors.
func SetNoColor(v bool) {
	noColor = v
	applyTheme(!v)
}
