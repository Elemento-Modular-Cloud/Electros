package ui

import "testing"

func TestFormatOsLabel(t *testing.T) {
	got := formatOsLabel("linux", "ubuntu")
	if got != "Linux Ubuntu" {
		t.Fatalf("got %q", got)
	}
	got = formatOsLabel("windows", "windows11")
	if got != "Windows 11" {
		t.Fatalf("got %q", got)
	}
}

func TestRenderProviderTagKnown(t *testing.T) {
	out := renderProviderTag("google")
	if out == "" || out == "—" {
		t.Fatal("expected colored GCP tag")
	}
	if noColor {
		t.Skip("noColor mode")
	}
}

func TestRenderOsCellPreservesFamily(t *testing.T) {
	out := renderOsCell("linux", "debian")
	if out == "" {
		t.Fatal("empty os cell")
	}
	if !containsPlain(out, "Linux") && !containsPlain(out, "Debian") {
		t.Fatalf("unexpected os label: %q", out)
	}
}

func containsPlain(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
