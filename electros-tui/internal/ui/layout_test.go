package ui

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/charmbracelet/lipgloss"

	"electros-tui/internal/api"
	"electros-tui/internal/config"
	"electros-tui/internal/nav"
	"electros-tui/internal/services"
	"electros-tui/internal/session"
)

func TestComputeLayoutFillsWidth(t *testing.T) {
	cases := []struct {
		w, h     int
		chatOpen bool
	}{
		{80, 24, false},
		{80, 24, true},   // chat collapses below 110 cols
		{120, 40, true},  // chat visible
		{120, 40, false},
		{200, 50, true},
		{60, 20, false},  // compact sidebar
	}
	for _, tc := range cases {
		l := computeLayout(tc.w, tc.h, tc.chatOpen)
		if got := l.sidebarW + l.contentW + l.chatW; got != l.width {
			t.Errorf("%dx%d chat=%v: regions sum %d, want %d", tc.w, tc.h, tc.chatOpen, got, l.width)
		}
		if l.contentW < minContentWidth {
			t.Errorf("%dx%d chat=%v: content width %d below minimum", tc.w, tc.h, tc.chatOpen, l.contentW)
		}
		if l.bodyH != l.height-headerHeight-statusHeight {
			t.Errorf("%dx%d: bodyH %d, want %d", tc.w, tc.h, l.bodyH, l.height-2)
		}
	}
}

func TestRenderPanelDimensions(t *testing.T) {
	for _, focused := range []bool{true, false} {
		out := renderPanel("Test Panel", "line one\nline two", 40, 10, focused)
		lines := strings.Split(out, "\n")
		if len(lines) != 10 {
			t.Fatalf("panel height %d, want 10", len(lines))
		}
		for i, line := range lines {
			if w := lipgloss.Width(line); w != 40 {
				t.Errorf("line %d width %d, want 40", i, w)
			}
		}
	}
}

func TestRenderPanelClipsOverflow(t *testing.T) {
	long := strings.Repeat("x", 200)
	body := strings.Repeat(long+"\n", 50)
	out := renderPanel("Overflow", body, 30, 8, true)
	lines := strings.Split(out, "\n")
	if len(lines) != 8 {
		t.Fatalf("panel height %d, want 8", len(lines))
	}
	for i, line := range lines {
		if w := lipgloss.Width(line); w != 30 {
			t.Errorf("line %d width %d, want 30", i, w)
		}
	}
}

// TestShellRenderSizes renders the full shell at several terminal sizes and
// asserts the frame is exactly terminal-sized with no ragged lines.
func TestShellRenderSizes(t *testing.T) {
	ecdDir := filepath.Join("..", "..", "..", "elemento-gui-new", "electros", "ecd")
	ecd, err := config.Load(config.Options{ECDDir: ecdDir, UseLocalhost: true, Host: "127.0.0.1"})
	if err != nil {
		t.Skipf("ECD config unavailable: %v", err)
	}
	router, err := nav.LoadRouter(config.DefaultPagesPath(ecdDir))
	if err != nil {
		t.Skipf("pages.json unavailable: %v", err)
	}
	if reg, err := services.LoadRegistry(services.DefaultIntentsPath(ecdDir)); err == nil {
		nav.InjectServiceRoutes(router, reg)
	}
	formOpts, _ := LoadFormOptions(ecdDir)
	if formOpts == nil {
		formOpts = DefaultFormOptions()
	}
	client := api.NewClient(ecd)
	store := session.NewStore(client)

	sizes := []struct{ w, h int }{
		{80, 24},
		{120, 40},
		{200, 50},
	}
	for _, chatOpen := range []bool{false, true} {
		for _, size := range sizes {
			app := NewApp(&Deps{Session: store, Router: router, Client: client, FormOpts: formOpts})
			app.mode = "shell"
			app.width = size.w
			app.height = size.h
			app.chatOpen = chatOpen
			app.resizePanels()
			app.loadCurrentView()

			out := app.viewShell()
			lines := strings.Split(out, "\n")
			if len(lines) != size.h {
				t.Errorf("%dx%d chat=%v: rendered %d lines, want %d", size.w, size.h, chatOpen, len(lines), size.h)
			}
			for i, line := range lines {
				if w := lipgloss.Width(line); w > size.w {
					t.Errorf("%dx%d chat=%v: line %d width %d exceeds terminal", size.w, size.h, chatOpen, i, w)
				}
			}
		}
	}
}
