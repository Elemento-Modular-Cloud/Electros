package nav

import (
	"path/filepath"
	"testing"

	"electros-tui/internal/config"
	"electros-tui/internal/services"
)

func TestInjectServiceRoutes(t *testing.T) {
	ecdDir := filepath.Join("..", "..", "..", "elemento-gui-new", "electros", "ecd")
	pagesPath := config.DefaultPagesPath(ecdDir)
	router, err := LoadRouter(pagesPath)
	if err != nil {
		t.Fatalf("LoadRouter: %v", err)
	}
	reg, err := services.LoadRegistry(services.DefaultIntentsPath(ecdDir))
	if err != nil {
		t.Fatalf("LoadRegistry: %v", err)
	}
	InjectServiceRoutes(router, reg)

	paas := router.ByPath["paas"]
	saas := router.ByPath["saas"]
	if paas == nil || saas == nil {
		t.Fatal("missing PaaS/SaaS containers")
	}
	if len(paas.Children) == 0 {
		t.Fatal("PaaS container has no children")
	}
	if len(saas.Children) == 0 {
		t.Fatal("SaaS container has no children")
	}

	foundIAAS := false
	foundPaaSAfter := false
	for _, rt := range router.Root {
		if rt.Name == "iaas" {
			foundIAAS = true
			continue
		}
		if foundIAAS && rt.Name == "paas" {
			foundPaaSAfter = true
		}
	}
	if !foundPaaSAfter {
		t.Fatal("PaaS container not inserted after IaaS in root nav")
	}
}
