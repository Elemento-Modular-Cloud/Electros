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
	if f.PaaSInstances > 0 {
		parts = append(parts, fmt.Sprintf("%d PaaS", f.PaaSInstances))
	}
	if f.SaaSInstances > 0 {
		parts = append(parts, fmt.Sprintf("%d SaaS", f.SaaSInstances))
	}
	return strings.Join(parts, " · ")
}

func fleetSummaryLong(f session.FleetSummary, refreshAgo string) string {
	parts := []string{
		fmt.Sprintf("%d VMs (%d running, %d stopped)", f.VMs, f.VMsRunning, f.VMsStopped),
		fmt.Sprintf("%d volumes (%s)", f.Volumes, formatBytes(f.VolumeBytes)),
		fmt.Sprintf("%d networks", f.Networks),
		fmt.Sprintf("%d targets", f.Targets),
	}
	if f.PaaSInstances > 0 {
		parts = append(parts, fmt.Sprintf("%d PaaS", f.PaaSInstances))
	}
	if f.SaaSInstances > 0 {
		parts = append(parts, fmt.Sprintf("%d SaaS", f.SaaSInstances))
	}
	parts = append(parts, "refreshed "+refreshAgo)
	return strings.Join(parts, " · ")
}
