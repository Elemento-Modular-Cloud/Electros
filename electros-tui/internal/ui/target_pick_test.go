package ui

import (
	"testing"

	"electros-tui/internal/models"
)

func TestTargetEligibleMatchesGUIPolicies(t *testing.T) {
	deps := &Deps{FormOpts: DefaultFormOptions()}
	targets := []models.TargetRecord{
		{TargetID: "a1", TargetType: "atomos_local_ip"},
		{TargetID: "m1", TargetType: "meson_public", TargetConfig: []byte(`{"provider":"google"}`)},
		{TargetID: "m2", TargetType: "meson_private", TargetConfig: []byte(`{"provider":"ovh"}`)},
		{TargetID: "p1", TargetType: "hypervisor_proxmox"},
		{TargetID: "e1", TargetType: "hypervisor_esxi"},
	}

	check := func(mode targetPickMode, service string, want ...string) {
		t.Helper()
		got := make([]string, 0)
		for _, tgt := range targets {
			if targetEligible(deps, mode, service, tgt) {
				got = append(got, tgt.TargetID)
			}
		}
		if len(got) != len(want) {
			t.Fatalf("mode=%s service=%q got %v want %v", mode, service, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("mode=%s got %v want %v", mode, got, want)
			}
		}
	}

	check(targetPickDefault, "", "a1", "m1", "m2")
	check(targetPickCloudOnly, "", "m1", "m2")
	check(targetPickCloudInitHosts, "", "a1", "p1")
}

func TestTargetNeedsRegionOnlyForServices(t *testing.T) {
	if !targetNeedsRegion(targetPickService, "meson_public") {
		t.Fatal("service meson_public needs region")
	}
	if targetNeedsRegion(targetPickCloudOnly, "meson_public") {
		t.Fatal("ephemeral cloud-only should not require region picker in GUI host-picker")
	}
	if targetNeedsRegion(targetPickDefault, "meson_public") {
		t.Fatal("default VM host-picker has no region card")
	}
}
