package services

import (
	"path/filepath"
	"testing"
)

func TestLoadRegistry(t *testing.T) {
	intentsPath := filepath.Join("..", "..", "..", "elemento-gui-new", "electros", "ecd", "supported_intents.json")
	reg, err := LoadRegistry(intentsPath)
	if err != nil {
		t.Fatalf("LoadRegistry: %v", err)
	}
	if len(reg.Services) < 5 {
		t.Fatalf("expected at least 5 services, got %d", len(reg.Services))
	}
	if reg.ByPath["paas/managedkubernetes"] == nil {
		t.Fatal("missing paas/managedkubernetes route")
	}
	if reg.ByPath["saas/n8n"] == nil {
		t.Fatal("missing saas/n8n route")
	}
	paas := reg.ByCategory("paas")
	saas := reg.ByCategory("saas")
	if len(paas) == 0 || len(saas) == 0 {
		t.Fatalf("expected paas and saas services, got paas=%d saas=%d", len(paas), len(saas))
	}
}
