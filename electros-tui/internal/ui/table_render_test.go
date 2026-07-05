package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
)

func TestAlignCellPreservesStyledContent(t *testing.T) {
	styled := renderStatusTag("running")
	out := alignCell(styled, 10)
	if lipgloss.Width(out) != 10 {
		t.Fatalf("width = %d, want 10; out=%q", lipgloss.Width(out), out)
	}
	if !strings.Contains(out, "running") {
		t.Fatalf("expected running in %q", out)
	}
}

func TestAlignCellTruncatesLongPlain(t *testing.T) {
	out := alignCell("very-long-host-name", 8)
	if lipgloss.Width(out) != 8 {
		t.Fatalf("width = %d, want 8", lipgloss.Width(out))
	}
}

func TestPrepareTableRowsFitsAllColumns(t *testing.T) {
	cols := []table.Column{
		{Title: "State", Width: 10},
		{Title: "OS", Width: 14},
	}
	rows := []table.Row{
		{renderStatusTag("running"), renderOsCell("linux", "ubuntu")},
	}
	out := prepareTableRows(rows, cols)
	for j, cell := range out[0] {
		if lipgloss.Width(cell) != cols[j].Width {
			t.Fatalf("col %d width = %d, want %d", j, lipgloss.Width(cell), cols[j].Width)
		}
	}
}

func TestDataTableRendersNoExtraBlankRows(t *testing.T) {
	cols := []table.Column{{Title: "Name", Width: 12}, {Title: "State", Width: 10}}
	rows := []table.Row{{"vm-a", "running"}, {"vm-b", "stopped"}}
	dt := dataTable{cols: cols, rows: rows, cursor: 0, width: 30, height: 3}
	out := dt.render()
	lines := strings.Split(out, "\n")
	if len(lines) != 3 {
		t.Fatalf("lines = %d, want 3 (header + 2 rows); %q", len(lines), out)
	}
}

func TestFitColumnsExpandsToViewport(t *testing.T) {
	cols := []table.Column{
		{Title: "Name", Width: 14},
		{Title: "Type", Width: 12},
		{Title: "Provider", Width: 10},
		{Title: "Server", Width: 18},
		{Title: "ID", Width: 14},
	}
	out := fitColumns(cols, 120)
	if tableTotalWidth(out) != 120 {
		t.Fatalf("total width = %d, want 120", tableTotalWidth(out))
	}
	if out[0].Width <= 14 {
		t.Fatalf("name column should expand beyond base width, got %d", out[0].Width)
	}
}

func TestVisibleColumnsExpandToViewport(t *testing.T) {
	cols := []table.Column{
		{Title: "A", Width: 10},
		{Title: "B", Width: 10},
		{Title: "C", Width: 10},
		{Title: "D", Width: 10},
	}
	dt := dataTable{cols: cols, colOff: 1, width: 50, height: 3}
	_, _, vis := dt.visibleColumns()
	if tableTotalWidth(vis) != 50 {
		t.Fatalf("visible width = %d, want 50", tableTotalWidth(vis))
	}
}

func TestDataTableRowFillsViewportWidth(t *testing.T) {
	cols := []table.Column{{Title: "Name", Width: 12}, {Title: "State", Width: 10}}
	rows := []table.Row{{"vm-a", "running"}}
	dt := dataTable{cols: cols, rows: rows, cursor: 0, width: 40, height: 3}
	out := dt.render()
	line := strings.Split(out, "\n")[1]
	if lipgloss.Width(line) != 40 {
		t.Fatalf("row width = %d, want 40", lipgloss.Width(line))
	}
}

func TestMaxColOffset(t *testing.T) {
	cols := []table.Column{
		{Title: "A", Width: 10},
		{Title: "B", Width: 10},
		{Title: "C", Width: 10},
	}
	max := maxColOffset(cols, 22)
	if max < 1 {
		t.Fatalf("max col offset = %d, want >= 1", max)
	}
	_, end := visibleColRange(cols, max, 22)
	if end != len(cols) {
		t.Fatalf("end = %d, want %d", end, len(cols))
	}
}
