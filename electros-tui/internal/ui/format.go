package ui

import (
	"fmt"
	"strings"

	"electros-tui/internal/session"
)

func formatBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

func formatRAM(gb float64) string {
	if gb == 0 {
		return "—"
	}
	if gb < 1 {
		return fmt.Sprintf("%.0f MB", gb*1024)
	}
	return fmt.Sprintf("%.1f GB", gb)
}

func formatBool(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}

func formatState(state string) string {
	if state == "" {
		return renderStatusTag("unknown")
	}
	return renderStatusTag(state)
}

func fleetSummaryLine(f session.FleetSummary) string {
	parts := []string{
		fmt.Sprintf("%d VM", f.VMs),
		fmt.Sprintf("%d run", f.VMsRunning),
		fmt.Sprintf("%d vol", f.Volumes),
		fmt.Sprintf("%d net", f.Networks),
		fmt.Sprintf("%d tgt", f.Targets),
	}
	return strings.Join(parts, " · ")
}

func fleetSummaryLong(f session.FleetSummary, refreshAgo string) string {
	return fmt.Sprintf("%d VMs (%d running, %d stopped) · %d volumes (%s) · %d networks · %d targets · refreshed %s",
		f.VMs, f.VMsRunning, f.VMsStopped,
		f.Volumes, formatBytes(f.VolumeBytes),
		f.Networks, f.Targets, refreshAgo)
}
