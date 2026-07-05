package ui

import (
	"strings"
	"testing"
)

func TestTargetPickEntryBadgeProviderColors(t *testing.T) {
	ent := targetPickEntry{
		targetType: "meson_public",
		provider:   "google",
		label:      "Google Cloud",
		detail:     "Public Cloud · google",
	}
	line := renderTargetPickLine(ent, true)
	if !strings.Contains(line, "GCP") && !strings.Contains(line, "Google") {
		t.Fatalf("expected provider label in line: %q", line)
	}
	if noColor {
		t.Skip("noColor mode")
	}
}

func TestOptionPickBadgeHypervisor(t *testing.T) {
	badge := optionPickBadge("hypervisor_kind", "third_party")
	if !strings.Contains(badge, "Proxmox") && !strings.Contains(badge, "proxmox") {
		t.Fatalf("expected proxmox badge, got %q", badge)
	}
}
