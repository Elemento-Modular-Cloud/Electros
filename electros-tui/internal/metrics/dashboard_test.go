package metrics

import (
	"strings"
	"testing"
)

func TestRenderPanelBarAlignment(t *testing.T) {
	p := Panel{
		Title: "Compute",
		Bars: []Bar{
			{Label: "running", Count: 12, Total: 26},
			{Label: "shut off", Count: 10, Total: 26},
			{Label: "linux/ubuntu", Count: 8, Total: 26},
			{Label: "Managed Kubernetes", Count: 18, Total: 54},
		},
	}
	out := RenderPanel(p, 72)
	lines := strings.Split(strings.TrimSpace(out), "\n")
	var barLines []string
	for _, line := range lines {
		if strings.Contains(line, "[") && strings.Contains(line, "]") {
			barLines = append(barLines, line)
		}
	}
	if len(barLines) != 4 {
		t.Fatalf("expected 4 bar lines, got %d:\n%s", len(barLines), out)
	}
	bracketCol := -1
	barWidth := -1
	for _, line := range barLines {
		i := strings.Index(line, "[")
		j := strings.Index(line, "]")
		if i < 0 || j < 0 || j <= i {
			t.Fatalf("malformed bar line: %q", line)
		}
		if bracketCol < 0 {
			bracketCol = i
			barWidth = j - i - 1
			continue
		}
		if i != bracketCol {
			t.Errorf("misaligned opening bracket at col %d (want %d): %q", i, bracketCol, line)
		}
		if j-i-1 != barWidth {
			t.Errorf("inconsistent bar width %d (want %d): %q", j-i-1, barWidth, line)
		}
	}
}
