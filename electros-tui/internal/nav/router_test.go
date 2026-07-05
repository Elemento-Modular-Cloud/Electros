package nav

import (
	"path/filepath"
	"testing"

	"electros-tui/internal/config"
)

func TestNavigateToVirtualSubpath(t *testing.T) {
	ecdDir := filepath.Join("..", "..", "..", "elemento-gui-new", "electros", "ecd")
	pagesPath := config.DefaultPagesPath(ecdDir)
	router, err := LoadRouter(pagesPath)
	if err != nil {
		t.Skipf("pages.json unavailable: %v", err)
	}

	if err := router.NavigateTo("my-clouds"); err != nil {
		t.Fatalf("NavigateTo my-clouds: %v", err)
	}
	if err := router.NavigateTo("my-clouds/add"); err != nil {
		t.Fatalf("NavigateTo my-clouds/add: %v", err)
	}
	if router.Current == nil || router.Current.Path != "my-clouds/add" {
		t.Fatalf("current path = %q, want my-clouds/add", router.Current.Path)
	}
	if router.Current.Label != "Add Cloud Target" {
		t.Fatalf("label = %q, want Add Cloud Target", router.Current.Label)
	}
	if _, ok := router.ByPath["my-clouds/add"]; !ok {
		t.Fatal("virtual route not indexed in ByPath")
	}
}
