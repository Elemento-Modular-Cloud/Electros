package metrics

import (
	"fmt"
	"sort"
	"strings"

	"github.com/mattn/go-runewidth"

	"electros-tui/internal/models"
)

// Panel renders a dashboard metrics section as text lines.
type Panel struct {
	Title  string
	Lines  []string
	Gauges []Gauge
	Stats  []Stat
	Bars   []Bar
	Dots   []DotGrid
}

// Gauge is a percentage gauge row.
type Gauge struct {
	Label string
	Value float64
	Max   float64
}

// Stat is a key metric.
type Stat struct {
	Label string
	Value string
}

// Bar is a distribution bar.
type Bar struct {
	Label string
	Count int
	Total int
}

// DotGrid is a capacity dot grid summary.
type DotGrid struct {
	Title string
	Used  int
	Total int
}

// BuildDashboardPanels builds all six dashboard panels from fleet data.
func BuildDashboardPanels(vms []models.VmRecord, vols []models.VolumeRecord, nets []models.NetworkRecord, targets []models.TargetRecord) []Panel {
	return []Panel{
		buildOverview(vms, vols, nets, targets),
		buildCompute(vms),
		buildStorage(vols),
		buildPlatform(vms, targets),
		buildTargets(targets),
		BuildServicesPanel(0, 0, nil), // replaced at render time with live counts
	}
}

func buildOverview(vms []models.VmRecord, vols []models.VolumeRecord, nets []models.NetworkRecord, targets []models.TargetRecord) Panel {
	running, stopped := 0, 0
	for _, vm := range vms {
		req, _ := vm.ParseReqJSON()
		if strings.EqualFold(req.States, "running") {
			running++
		} else {
			stopped++
		}
	}
	return Panel{
		Title: "Overview",
		Stats: []Stat{
			{Label: "Virtual Machines", Value: fmt.Sprintf("%d", len(vms))},
			{Label: "Running", Value: fmt.Sprintf("%d", running)},
			{Label: "Stopped", Value: fmt.Sprintf("%d", stopped)},
			{Label: "Volumes", Value: fmt.Sprintf("%d", len(vols))},
			{Label: "Networks", Value: fmt.Sprintf("%d", len(nets))},
			{Label: "Cloud Targets", Value: fmt.Sprintf("%d", len(targets))},
		},
		Gauges: []Gauge{
			{Label: "VM running ratio", Value: float64(running), Max: float64(max(len(vms), 1))},
		},
	}
}

func buildCompute(vms []models.VmRecord) Panel {
	stateCounts := map[string]int{}
	osCounts := map[string]int{}
	cores, gpus := 0, 0
	for _, vm := range vms {
		req, _ := vm.ParseReqJSON()
		stateCounts[req.States]++
		key := req.OSFamily + "/" + req.OSFlavour
		osCounts[key]++
		cores += req.Slots
	}
	bars := topBars(stateCounts, len(vms))
	osBars := topBars(osCounts, len(vms))
	return Panel{
		Title: "Compute",
		Stats: []Stat{
			{Label: "Total VMs", Value: fmt.Sprintf("%d", len(vms))},
			{Label: "CPU Slots", Value: fmt.Sprintf("%d", cores)},
			{Label: "GPU VMs", Value: fmt.Sprintf("%d", gpus)},
		},
		Bars: append(bars, osBars...),
		Dots: []DotGrid{{Title: "Fleet capacity", Used: len(vms), Total: max(len(vms)+4, 20)}},
	}
}

func buildStorage(vols []models.VolumeRecord) Panel {
	bootable, private, public := 0, 0, 0
	formatCounts := map[string]int{}
	var totalSize int64
	for _, v := range vols {
		if v.Bootable {
			bootable++
		}
		if v.Private {
			private++
		} else {
			public++
		}
		formatCounts[v.Format]++
		totalSize += v.Size
	}
	return Panel{
		Title: "Storage",
		Stats: []Stat{
			{Label: "Volumes", Value: fmt.Sprintf("%d", len(vols))},
			{Label: "Bootable", Value: fmt.Sprintf("%d", bootable)},
			{Label: "Private", Value: fmt.Sprintf("%d", private)},
			{Label: "Public", Value: fmt.Sprintf("%d", public)},
			{Label: "Total Size", Value: formatBytes(totalSize)},
		},
		Bars: topBars(formatCounts, len(vols)),
	}
}

func buildPlatform(vms []models.VmRecord, targets []models.TargetRecord) Panel {
	providerCounts := map[string]int{}
	for _, t := range targets {
		p := t.Provider()
		if p == "" {
			p = t.TargetType
		}
		providerCounts[p]++
	}
	for _, vm := range vms {
		p := vm.Provider
		if p == "" {
			p = vm.TargetType
		}
		providerCounts[p]++
	}
	return Panel{
		Title: "Platform",
		Stats: []Stat{
			{Label: "Targets", Value: fmt.Sprintf("%d", len(targets))},
			{Label: "Providers", Value: fmt.Sprintf("%d", len(providerCounts))},
		},
		Bars: topBars(providerCounts, len(targets)+len(vms)),
	}
}

func buildTargets(targets []models.TargetRecord) Panel {
	typeCounts := map[string]int{}
	lines := make([]string, 0, len(targets))
	for _, t := range targets {
		typeCounts[t.TargetType]++
		name := t.DisplayName()
		lines = append(lines, fmt.Sprintf("%-24s %-18s %s", name, t.TargetType, t.ServerURL()))
	}
	sort.Strings(lines)
	return Panel{
		Title: "Cloud Targets",
		Lines: lines,
		Bars:  topBars(typeCounts, len(targets)),
		Stats: []Stat{{Label: "Total Targets", Value: fmt.Sprintf("%d", len(targets))}},
	}
}

func BuildServicesPanel(paasTotal, saasTotal int, serviceBars []Bar) Panel {
	total := paasTotal + saasTotal
	stats := []Stat{
		{Label: "PaaS instances", Value: fmt.Sprintf("%d", paasTotal)},
		{Label: "SaaS instances", Value: fmt.Sprintf("%d", saasTotal)},
		{Label: "Total instances", Value: fmt.Sprintf("%d", total)},
	}
	barTotal := total
	if barTotal == 0 {
		barTotal = 1
	}
	for i := range serviceBars {
		if serviceBars[i].Total == 0 {
			serviceBars[i].Total = barTotal
		}
	}
	lines := []string(nil)
	if total == 0 {
		lines = []string{"No managed service instances running."}
	}
	return Panel{
		Title: "PaaS / SaaS",
		Stats: stats,
		Bars:  serviceBars,
		Lines: lines,
	}
}

func topBars(counts map[string]int, total int) []Bar {
	type kv struct {
		k string
		v int
	}
	items := make([]kv, 0, len(counts))
	for k, v := range counts {
		if k == "" {
			k = "(unknown)"
		}
		items = append(items, kv{k, v})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].v > items[j].v })
	if len(items) > 6 {
		items = items[:6]
	}
	bars := make([]Bar, len(items))
	for i, item := range items {
		bars[i] = Bar{Label: item.k, Count: item.v, Total: max(total, 1)}
	}
	return bars
}

// RenderPanel formats a panel for terminal display.
func RenderPanel(p Panel, width int) string {
	var b strings.Builder
	b.WriteString(p.Title + "\n")
	b.WriteString(strings.Repeat("─", min(width, 60)) + "\n")
	for _, s := range p.Stats {
		b.WriteString(fmt.Sprintf("  %-22s %s\n", s.Label+":", s.Value))
	}
	if len(p.Gauges) > 0 || len(p.Bars) > 0 {
		layout := chartLayoutForPanel(p, width)
		for _, g := range p.Gauges {
			b.WriteString(renderGauge(g, layout) + "\n")
		}
		for _, bar := range p.Bars {
			b.WriteString(renderBar(bar, layout) + "\n")
		}
	}
	for _, d := range p.Dots {
		b.WriteString(renderDots(d) + "\n")
	}
	for _, line := range p.Lines {
		b.WriteString("  " + line + "\n")
	}
	return b.String()
}

type chartLayout struct {
	labelW int
	barW   int
	valueW int
}

func chartLayoutForPanel(p Panel, width int) chartLayout {
	labels := make([]string, 0, len(p.Gauges)+len(p.Bars))
	for _, g := range p.Gauges {
		labels = append(labels, g.Label)
	}
	for _, bar := range p.Bars {
		labels = append(labels, bar.Label)
	}

	labelW := 8
	for _, label := range labels {
		labelW = max(labelW, runewidth.StringWidth(label))
	}
	// Leave room for bars; truncate long labels rather than shrinking bars too far.
	maxLabel := max(12, min(width/3, 26))
	if labelW > maxLabel {
		labelW = maxLabel
	}

	valueW := 3
	for _, bar := range p.Bars {
		valueW = max(valueW, runewidth.StringWidth(fmt.Sprintf("%d", bar.Count)))
	}
	for _, g := range p.Gauges {
		valueW = max(valueW, runewidth.StringWidth(fmt.Sprintf("%.0f%%", pctOf(g))))
	}

	const indent = 2
	// indent + label + " " + "[" + bar + "]" + " " + value
	barW := width - indent - labelW - 1 - 2 - 1 - valueW
	barW = max(8, min(barW, 36))

	return chartLayout{labelW: labelW, barW: barW, valueW: valueW}
}

func pctOf(g Gauge) float64 {
	if g.Max <= 0 {
		return 0
	}
	return g.Value / g.Max * 100
}

func padLabel(label string, width int) string {
	if width <= 0 {
		return label
	}
	if runewidth.StringWidth(label) > width {
		for len(label) > 0 && runewidth.StringWidth(label) > width-1 {
			label = label[:len(label)-1]
		}
		return label + "…"
	}
	return label + strings.Repeat(" ", width-runewidth.StringWidth(label))
}

func padValue(value string, width int) string {
	if width <= 0 {
		return value
	}
	pad := width - runewidth.StringWidth(value)
	if pad < 0 {
		return value
	}
	return strings.Repeat(" ", pad) + value
}

func renderGauge(g Gauge, layout chartLayout) string {
	pct := pctOf(g)
	filled := 0
	if layout.barW > 0 {
		filled = int(pct / 100 * float64(layout.barW))
	}
	if filled > layout.barW {
		filled = layout.barW
	}
	bar := strings.Repeat("█", filled) + strings.Repeat("░", layout.barW-filled)
	value := padValue(fmt.Sprintf("%.0f%%", pct), layout.valueW)
	return fmt.Sprintf("  %s [%s] %s", padLabel(g.Label, layout.labelW), bar, value)
}

func renderBar(bar Bar, layout chartLayout) string {
	filled := 0
	if bar.Total > 0 && layout.barW > 0 {
		filled = bar.Count * layout.barW / bar.Total
	}
	if filled > layout.barW {
		filled = layout.barW
	}
	barStr := strings.Repeat("█", filled) + strings.Repeat("░", layout.barW-filled)
	value := padValue(fmt.Sprintf("%d", bar.Count), layout.valueW)
	return fmt.Sprintf("  %s [%s] %s", padLabel(bar.Label, layout.labelW), barStr, value)
}

func renderDots(d DotGrid) string {
	const cols = 20
	used := d.Used
	total := max(d.Total, used)
	row := strings.Builder{}
	row.WriteString(fmt.Sprintf("  %s ", d.Title))
	for i := 0; i < total && i < cols*3; i++ {
		if i < used {
			row.WriteString("●")
		} else {
			row.WriteString("○")
		}
		if (i+1)%cols == 0 {
			row.WriteString("\n    ")
		}
	}
	return row.String()
}

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

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
