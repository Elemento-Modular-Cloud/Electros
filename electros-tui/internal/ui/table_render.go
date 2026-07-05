package ui

import (
	"strings"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

const tableColGap = 1

// alignCell fits content to an exact terminal column width without breaking ANSI.
func alignCell(cell string, width int) string {
	if width <= 0 {
		return cell
	}
	box := lipgloss.NewStyle().Width(width).MaxWidth(width).Inline(true)
	plain := ansi.Strip(cell)
	if plain == "" {
		return box.Render(strings.Repeat(" ", width))
	}
	if lipgloss.Width(plain) > width {
		plain = ansi.Truncate(plain, width, "…")
		return box.Render(plain)
	}
	if lipgloss.Width(cell) <= width {
		return box.Render(cell)
	}
	// Styled content (badges) wider than column — fall back to plain text.
	return box.Render(plain)
}

func prepareTableRows(rows []table.Row, cols []table.Column) []table.Row {
	if len(cols) == 0 {
		return rows
	}
	out := make([]table.Row, len(rows))
	for i, row := range rows {
		out[i] = make(table.Row, len(row))
		for j, cell := range row {
			w := 0
			if j < len(cols) {
				w = cols[j].Width
			}
			out[i][j] = alignCell(cell, w)
		}
	}
	return out
}

// fitColumns sizes columns to the viewport: shrink when too wide, expand when extra space.
func fitColumns(cols []table.Column, viewWidth int) []table.Column {
	if viewWidth <= 0 || len(cols) == 0 {
		return cols
	}
	out := applyMinColWidths(cols)
	total := tableTotalWidth(out)
	if total > viewWidth {
		return shrinkColumns(out, viewWidth)
	}
	if total < viewWidth {
		return expandColumnsToWidth(out, viewWidth)
	}
	return out
}

func applyMinColWidths(cols []table.Column) []table.Column {
	out := make([]table.Column, len(cols))
	for i, c := range cols {
		w := c.Width
		if w < minColWidth(c.Title) {
			w = minColWidth(c.Title)
		}
		out[i] = table.Column{Title: c.Title, Width: w}
	}
	return out
}

func shrinkColumns(cols []table.Column, viewWidth int) []table.Column {
	out := append([]table.Column(nil), cols...)
	total := tableTotalWidth(out)
	for total > viewWidth {
		shrunk := false
		for i := range out {
			minW := minColWidth(out[i].Title)
			if out[i].Width > minW {
				out[i].Width--
				shrunk = true
			}
		}
		if !shrunk {
			break
		}
		total = tableTotalWidth(out)
	}
	return out
}

func expandColumnsToWidth(cols []table.Column, viewWidth int) []table.Column {
	if len(cols) == 0 || viewWidth <= 0 {
		return cols
	}
	out := append([]table.Column(nil), cols...)
	total := tableTotalWidth(out)
	if total >= viewWidth {
		return out
	}
	extra := viewWidth - total
	pri := make([]int, len(out))
	sumPri := 0
	for i, c := range out {
		pri[i] = colExpandPriority(c.Title)
		sumPri += pri[i]
	}
	if sumPri == 0 {
		sumPri = len(out)
		for i := range pri {
			pri[i] = 1
		}
	}
	distributed := 0
	for i := range out {
		add := extra * pri[i] / sumPri
		out[i].Width += add
		distributed += add
	}
	for i := 0; distributed < extra; i++ {
		out[i%len(out)].Width++
		distributed++
	}
	return out
}

func colExpandPriority(title string) int {
	switch strings.ToLower(title) {
	case "name", "server", "uuid", "id", "uid":
		return 4
	case "os", "type", "provider", "host", "ip":
		return 3
	case "state", "cpu", "ram":
		return 2
	default:
		return 1
	}
}

func minColWidth(title string) int {
	switch strings.ToLower(title) {
	case "gpu", "vol", "own", "boot", "share", "ro", "priv":
		return 4
	case "fmt", "cpu", "ram", "ip":
		return 8
	case "state", "host", "mode":
		return 10
	case "os", "provider", "type":
		return 12
	case "uuid", "uid", "id":
		return 14
	default:
		return 10
	}
}

func tableTotalWidth(cols []table.Column) int {
	if len(cols) == 0 {
		return 0
	}
	n := (len(cols) - 1) * tableColGap
	for _, c := range cols {
		n += c.Width
	}
	return n
}

func maxColOffset(cols []table.Column, viewWidth int) int {
	if len(cols) == 0 || tableTotalWidth(cols) <= viewWidth {
		return 0
	}
	max := 0
	for off := 0; off < len(cols); off++ {
		_, end := visibleColRange(cols, off, viewWidth)
		if end == len(cols) {
			max = off
		}
	}
	return max
}

func visibleColRange(cols []table.Column, colOff, viewWidth int) (start, end int) {
	start = colOff
	if start >= len(cols) {
		return 0, 0
	}
	used := 0
	end = start
	for i := colOff; i < len(cols); i++ {
		need := cols[i].Width
		if i > colOff {
			need += tableColGap
		}
		if used+need > viewWidth && i > colOff {
			break
		}
		used += need
		end = i + 1
	}
	if end <= start {
		end = start + 1
	}
	return start, end
}

type dataTable struct {
	cols   []table.Column
	rows   []table.Row
	cursor int
	colOff int
	width  int
	height int
}

func (t *dataTable) visibleColumns() (start, end int, vis []table.Column) {
	start, end = visibleColRange(t.cols, t.colOff, t.width)
	if end <= start {
		return start, end, nil
	}
	vis = make([]table.Column, end-start)
	for i := start; i < end; i++ {
		vis[i-start] = t.cols[i]
	}
	vis = expandColumnsToWidth(vis, t.width)
	return start, end, vis
}

func (t *dataTable) render() string {
	if t.width <= 0 || t.height <= 0 || len(t.cols) == 0 {
		return ""
	}
	start, end, visCols := t.visibleColumns()
	if end <= start {
		return StyleMuted.Render("(no columns visible — widen terminal or press h/l)")
	}

	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFC940"))
	rowStyle := StyleSidebarItem
	activeStyle := StyleSidebarActive

	var b strings.Builder
	b.WriteString(t.renderRow(headerStyle, nil, start, visCols, true))
	b.WriteByte('\n')

	maxRows := t.height - 1
	if maxRows < 1 {
		maxRows = 1
	}
	if len(t.rows) < maxRows {
		maxRows = len(t.rows)
	}

	top := 0
	if t.cursor >= maxRows {
		top = t.cursor - maxRows + 1
	}
	for i := 0; i < maxRows; i++ {
		idx := top + i
		if idx >= len(t.rows) {
			break
		}
		style := rowStyle
		if idx == t.cursor {
			style = activeStyle
		}
		b.WriteString(t.renderRow(style, t.rows[idx], start, visCols, false))
		if i < maxRows-1 {
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func (t *dataTable) renderRow(style lipgloss.Style, row table.Row, colStart int, visCols []table.Column, header bool) string {
	parts := make([]string, 0, len(visCols))
	for j, col := range visCols {
		i := colStart + j
		cell := ""
		if header {
			cell = alignCell(col.Title, col.Width)
		} else if i < len(row) {
			cell = alignCell(row[i], col.Width)
		} else {
			cell = alignCell("", col.Width)
		}
		if j > 0 {
			parts = append(parts, strings.Repeat(" ", tableColGap))
		}
		parts = append(parts, style.Render(cell))
	}
	line := strings.Join(parts, "")
	if lipgloss.Width(line) > t.width {
		line = ansi.Truncate(line, t.width, "…")
	} else if pad := t.width - lipgloss.Width(line); pad > 0 {
		line += strings.Repeat(" ", pad)
	}
	return line
}
