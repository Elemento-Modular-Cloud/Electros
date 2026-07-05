package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

const (
	headerHeight     = 1
	statusHeight     = 1
	sidebarWidth     = 24
	sidebarCompact   = 14
	chatPanelWidth   = 38
	chatMinTerminal  = 110
	sidebarBreakCols = 70
	minContentWidth  = 30
)

// layout holds computed region sizes for one render pass.
type layout struct {
	width, height int
	bodyH         int
	sidebarW      int
	chatW         int
	contentW      int
	chatCollapsed bool // chat requested but terminal too narrow
}

func computeLayout(w, h int, chatOpen bool) layout {
	if w < 40 {
		w = 40
	}
	if h < 10 {
		h = 10
	}
	l := layout{width: w, height: h}
	l.bodyH = h - headerHeight - statusHeight

	l.sidebarW = sidebarWidth
	if w < sidebarBreakCols {
		l.sidebarW = sidebarCompact
	}

	if chatOpen {
		if w >= chatMinTerminal {
			l.chatW = chatPanelWidth
		} else {
			l.chatCollapsed = true
		}
	}

	l.contentW = w - l.sidebarW - l.chatW
	if l.contentW < minContentWidth {
		// Steal space back from the chat panel first, then the sidebar.
		deficit := minContentWidth - l.contentW
		if l.chatW > 0 {
			take := min(deficit, l.chatW-24)
			l.chatW -= take
			deficit -= take
		}
		if deficit > 0 && l.sidebarW > sidebarCompact {
			take := min(deficit, l.sidebarW-sidebarCompact)
			l.sidebarW -= take
		}
		l.contentW = w - l.sidebarW - l.chatW
	}
	return l
}

// renderPanel draws a rounded-border box of exactly w x h with the title
// embedded in the top border. The focused panel uses the accent border color.
func renderPanel(title, body string, w, h int, focused bool) string {
	if w < 4 || h < 3 {
		return ""
	}
	innerW, innerH := w-2, h-2

	lines := strings.Split(body, "\n")
	if len(lines) > innerH {
		lines = lines[:innerH]
	}
	for i := range lines {
		lines[i] = ansi.Truncate(lines[i], innerW, "…")
	}
	body = strings.Join(lines, "\n")

	borderColor := panelBorderBlurred
	titleStyle := StylePanelTitleBlurred
	if focused {
		borderColor = panelBorderFocused
		titleStyle = StylePanelTitle
	}
	borderStyle := lipgloss.NewStyle().Foreground(borderColor)

	inner := lipgloss.NewStyle().Width(innerW).Height(innerH).Render(body)
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder(), false, true, true, true).
		BorderForeground(borderColor).
		Render(inner)

	top := renderPanelTop(title, w, borderStyle, titleStyle)
	return top + "\n" + box
}

func renderPanelTop(title string, w int, borderStyle, titleStyle lipgloss.Style) string {
	if title == "" {
		return borderStyle.Render("╭" + strings.Repeat("─", w-2) + "╮")
	}
	title = ansi.Truncate(title, w-7, "…")
	tw := lipgloss.Width(title)
	dashes := w - 5 - tw
	if dashes < 0 {
		dashes = 0
	}
	return borderStyle.Render("╭─ ") +
		titleStyle.Render(title) +
		borderStyle.Render(" "+strings.Repeat("─", dashes)+"╮")
}

// overlayCentered draws a modal box over the shell, replacing the full rows
// of the band it occupies so no mid-line ANSI splicing is needed.
func overlayCentered(bg, modal string, w, h int) string {
	bgLines := strings.Split(bg, "\n")
	mLines := strings.Split(modal, "\n")
	mW := lipgloss.Width(modal)
	top := (h - len(mLines)) / 2
	if top < 1 {
		top = 1
	}
	leftPad := (w - mW) / 2
	if leftPad < 0 {
		leftPad = 0
	}
	pad := strings.Repeat(" ", leftPad)
	for i, ml := range mLines {
		row := top + i
		if row < 0 || row >= len(bgLines) {
			continue
		}
		bgLines[row] = pad + ml
	}
	return strings.Join(bgLines, "\n")
}

// barSegments composes a full-width single-line bar from left, middle, and
// right segments, truncating the middle to fit.
func barSegments(left, middle, right string, w int, fill lipgloss.Style) string {
	lw := lipgloss.Width(left)
	rw := lipgloss.Width(right)
	midW := w - lw - rw
	if midW < 0 {
		right = ""
		rw = 0
		midW = w - lw
	}
	if midW < 0 {
		midW = 0
	}
	middle = ansi.Truncate(middle, midW-2, "…")
	gap := midW - lipgloss.Width(middle) - 1
	if gap < 0 {
		gap = 0
	}
	return left + fill.Render(" "+middle+strings.Repeat(" ", gap)) + right
}
