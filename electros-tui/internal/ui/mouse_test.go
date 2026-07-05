package ui

import (
	"testing"

	"github.com/charmbracelet/bubbles/table"

	"electros-tui/internal/nav"
	"electros-tui/internal/session"
)

func TestSidebarItemIndex(t *testing.T) {
	tests := []struct {
		innerY int
		want   int
	}{
		{0, -1},
		{2, -1},
		{3, 0},
		{4, 1},
		{10, 7},
	}
	for _, tc := range tests {
		if got := sidebarItemIndex(tc.innerY); got != tc.want {
			t.Fatalf("innerY=%d: got %d, want %d", tc.innerY, got, tc.want)
		}
	}
}

func TestListViewRowIndexAt(t *testing.T) {
	v := &listView{
		w: 80,
		h: 20,
		cfg: listConfig{
			summary: func(*session.Store) string { return "summary" },
		},
		rows:   make([]table.Row, 10),
		cursor: 0,
	}
	// lead=2, header at 2, first row at 3
	if idx, ok := v.rowIndexAt(3); !ok || idx != 0 {
		t.Fatalf("row at 3: got %d ok=%v", idx, ok)
	}
	if _, ok := v.rowIndexAt(2); ok {
		t.Fatal("expected no row on header line")
	}
}

func TestContainerItemIndexAt(t *testing.T) {
	v := &containerView{
		route: &nav.Route{
			Children: []*nav.Route{{Path: "a"}, {Path: "b"}},
		},
	}
	if idx, ok := v.itemIndexAt(2); !ok || idx != 0 {
		t.Fatalf("item 0: got %d ok=%v", idx, ok)
	}
	if idx, ok := v.itemIndexAt(3); !ok || idx != 1 {
		t.Fatalf("item 1: got %d ok=%v", idx, ok)
	}
}
