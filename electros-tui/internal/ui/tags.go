package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Provider brand colors — aligned with elemento-gui `common/providerTags.ts`.
var providerColors = map[string]string{
	"google":          "#4285f4",
	"azure":           "#0078d4",
	"ovh":             "#123f6d",
	"upcloud":         "#7b68ee",
	"wasabi":          "#00c65e",
	"scaleway":        "#4f0599",
	"impossiblecloud": "#00c65e",
	"oracle":          "#f80000",
	"aws":             "#ff9900",
	"proxmox":         "#eb7e02",
	"esxi":            "#8cbb55",
	"vmware":          "#8cbb55",
	"atomos":          "#118acb",
}

var providerLabels = map[string]string{
	"google": "GCP",
	"aws":    "AWS",
	"esxi":   "VMware ESXi",
	"vmware": "VMware ESXi",
}

// OS foreground colors — aligned with `css/themes.css` (light theme).
var osColors = map[string]map[string]string{
	"linux": {
		"default": "#000000",
		"ubuntu":  "#E95420",
		"fedora":  "#294172",
		"centos":  "#932279",
		"debian":  "#A81D33",
		"redhat":  "#EE0000",
	},
	"windows": {
		"default":        "#0078D6",
		"windowsxp":      "#01A601",
		"windows10":      "#00A4EF",
		"windows11":      "#0078D7",
		"windowssrv2003": "#01A601",
		"windowssrv2008": "#006cbe",
		"windowssrv2012": "#006cbe",
		"windowssrv2016": "#005ca2",
		"windowssrv2019": "#014675",
		"windowssrv2022": "#002238",
	},
	"bsd": {
		"default": "#EE0000",
		"freebsd": "#EE0000",
	},
	"macos": {
		"default": "#393939",
	},
}

// Network type tag backgrounds — `common/networkTypeTags.ts`.
var networkTypeColors = map[string]string{
	"libvirt":   "#E95420",
	"tailscale": "#000000",
	"headscale": "#6366F1",
	"shared":    "#0D9488",
}

// Volume format tag backgrounds — `common/volumeFormatTags.ts`.
var volumeFormatColors = map[string]string{
	"qcow2": "#FF6347",
	"raw":   "#002a9a",
	"iso":   "#B19CD9",
	"rbd":   "#57B154",
	"vmdk":  "#57B154",
}

// Target / hypervisor badge colors — `css/themes.css` tagchip badges.
var targetBadgeColors = map[string][2]string{
	"hypervisor-proxmox":        {"#EB7E02", "#000000"},
	"hypervisor-esxi":           {"#8CBB55", "#000000"},
	"onprem-atomos":             {"#005e91", "#ffffff"},
	"onprem-atomos-discovery":   {"#005e91", "#ffffff"},
	"remote-atomos":             {"#B19CD9", "#8A2BE2"},
	"provider":                  {"#FFA07A", "#FF6347"},
	"provider-private":          {"#EA5159", "#BA1631"},
	"atomosphere":               {"#EA5159", "#ffffff"},
	"legacy-atomos":             {"#6A6C75", "#F5F5FA"},
}

var statusBadgeColors = map[string][2]string{
	"running":      {"#00953B", "#ffffff"},
	"stopped":      {"#4a4e53", "#ffffff"},
	"shut off":     {"#4a4e53", "#ffffff"},
	"shutdown":     {"#4a4e53", "#ffffff"},
	"updating":     {"#FF7F50", "#000000"},
	"error":        {"#BA1631", "#ffffff"},
	"failed":       {"#BA1631", "#ffffff"},
	"provisioning": {"#006AC9", "#ffffff"},
	"degraded":     {"#FFA600", "#000000"},
	"pending":      {"#006AC9", "#ffffff"},
	"active":       {"#00953B", "#ffffff"},
	"inactive":     {"#4a4e53", "#ffffff"},
}

func normalizeKey(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func contrastingFG(bgHex string) string {
	if bgHex == "" {
		return "#F5F5FA"
	}
	h := strings.TrimPrefix(strings.ToLower(bgHex), "#")
	if len(h) != 6 {
		return "#F5F5FA"
	}
	r := hexByte(h[0:2])
	g := hexByte(h[2:4])
	b := hexByte(h[4:6])
	lum := 0.2126*float64(r) + 0.7152*float64(g) + 0.0722*float64(b)
	if lum > 140 {
		return "#000000"
	}
	return "#ffffff"
}

func hexByte(s string) float64 {
	var n float64
	for _, c := range s {
		n *= 16
		switch {
		case c >= '0' && c <= '9':
			n += float64(c - '0')
		case c >= 'a' && c <= 'f':
			n += float64(c-'a') + 10
		case c >= 'A' && c <= 'F':
			n += float64(c-'A') + 10
		}
	}
	return n
}

func renderTag(label, bgHex, fgHex string) string {
	label = strings.TrimSpace(label)
	if label == "" || label == "—" || label == "-" {
		return "—"
	}
	if noColor {
		return label
	}
	if fgHex == "" {
		fgHex = contrastingFG(bgHex)
	}
	return lipgloss.NewStyle().
		Background(lipgloss.Color(bgHex)).
		Foreground(lipgloss.Color(fgHex)).
		Padding(0, 1).
		Render(label)
}

func renderProviderTag(providerKey string) string {
	key := normalizeKey(providerKey)
	if key == "" {
		return "—"
	}
	label := providerLabels[key]
	if label == "" {
		label = titleCaseProvider(key)
	}
	bg := providerColors[key]
	if bg == "" {
		return label
	}
	return renderTag(label, bg, contrastingFG(bg))
}

func titleCaseProvider(key string) string {
	parts := strings.FieldsFunc(key, func(r rune) bool { return r == '-' || r == '_' })
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}

func inferProviderKey(name string) string {
	if name == "" {
		return ""
	}
	seg := strings.ToLower(strings.Split(name, "-")[0])
	if _, ok := providerColors[seg]; ok {
		return seg
	}
	return ""
}

func resolveProviderKey(explicit, name string) string {
	if k := normalizeKey(explicit); k != "" {
		return k
	}
	return inferProviderKey(name)
}

func targetTypeClass(targetType string) string {
	switch normalizeKey(targetType) {
	case "atomos_local_ip", "atomos_local", "atomos":
		return "onprem-atomos"
	case "atomos_discovery":
		return "onprem-atomos-discovery"
	case "meson_public":
		return "provider"
	case "meson_private":
		return "provider-private"
	case "proxmox":
		return "hypervisor-proxmox"
	case "esxi", "vmware":
		return "hypervisor-esxi"
	case "remote_atomos":
		return "remote-atomos"
	case "atomosphere":
		return "atomosphere"
	default:
		if targetType == "" {
			return "legacy-atomos"
		}
		return "legacy-atomos"
	}
}

func targetTypeLabel(targetType string) string {
	switch normalizeKey(targetType) {
	case "atomos_local_ip":
		return "AtomOS Local"
	case "meson_public":
		return "Public Cloud"
	case "meson_private":
		return "Private Cloud"
	case "proxmox":
		return "Proxmox"
	case "esxi", "vmware":
		return "ESXi"
	default:
		if targetType == "" {
			return "Unknown"
		}
		return targetType
	}
}

func renderTargetTypeBadge(targetType string) string {
	class := targetTypeClass(targetType)
	colors, ok := targetBadgeColors[class]
	if !ok {
		colors = targetBadgeColors["legacy-atomos"]
	}
	return renderTag(targetTypeLabel(targetType), colors[0], colors[1])
}

func formatOsLabel(family, flavour string) string {
	familyKey := normalizeKey(family)
	if familyKey == "widnows" {
		familyKey = "windows"
	}
	flavourKey := normalizeKey(flavour)

	var formattedName string
	if familyKey == "windows" && flavourKey != "" && flavourKey != "windows" {
		formattedName = formattedWindowsFlavour(flavourKey)
	} else if familyKey == "windows" {
		formattedName = "Windows"
	} else if family != "" {
		formattedName = strings.ToUpper(family[:1]) + family[1:]
	} else {
		formattedName = "Unknown"
	}

	var formattedFlavour string
	if flavourKey == familyKey || familyKey == "windows" {
		formattedFlavour = ""
	} else if flavour != "" {
		formattedFlavour = strings.ToUpper(flavour[:1]) + flavour[1:]
	}
	if formattedFlavour != "" {
		return formattedName + " " + formattedFlavour
	}
	return formattedName
}

func formattedWindowsFlavour(flavour string) string {
	windowsMap := map[string]string{
		"windowsxp": "Windows XP", "windows10": "Windows 10", "windows11": "Windows 11",
		"windowssrv2003": "Windows Server 2003", "windowssrv2008": "Windows Server 2008",
		"windowssrv2012": "Windows Server 2012", "windowssrv2016": "Windows Server 2016",
		"windowssrv2019": "Windows Server 2019", "windowssrv2022": "Windows Server 2022",
	}
	if v, ok := windowsMap[flavour]; ok {
		return v
	}
	if flavour == "" {
		return "Windows"
	}
	return strings.ToUpper(flavour[:1]) + flavour[1:]
}

func osColor(family, flavour string) string {
	familyKey := normalizeKey(family)
	if familyKey == "widnows" {
		familyKey = "windows"
	}
	flavourKey := normalizeKey(flavour)
	if familyColors, ok := osColors[familyKey]; ok {
		if c, ok := familyColors[flavourKey]; ok {
			return c
		}
		return familyColors["default"]
	}
	return "#6A6C75"
}

func renderOsCell(family, flavour string) string {
	label := formatOsLabel(family, flavour)
	if noColor {
		return label
	}
	color := osColor(family, flavour)
	return lipgloss.NewStyle().Foreground(lipgloss.Color(color)).Bold(true).Render(label)
}

func renderNetworkTypeTag(networkType string) string {
	key := normalizeKey(strings.ReplaceAll(networkType, " ", ""))
	if key == "" {
		return "—"
	}
	bg := networkTypeColors[key]
	if bg == "" {
		return networkType
	}
	label := key
	switch key {
	case "libvirt":
		label = "Libvirt"
	case "tailscale":
		label = "Tailscale"
	case "headscale":
		label = "Headscale"
	case "shared":
		label = "Shared"
	default:
		label = strings.ToUpper(key[:1]) + key[1:]
	}
	return renderTag(label, bg, contrastingFG(bg))
}

func renderVolumeFormatTag(format string) string {
	key := normalizeKey(format)
	bg := volumeFormatColors[key]
	if bg == "" {
		bg = "#007BFF"
	}
	if format == "" {
		format = "unknown"
	}
	return renderTag(strings.ToUpper(format), bg, contrastingFG(bg))
}

func renderStatusTag(status string) string {
	key := normalizeKey(status)
	if key == "" {
		return "—"
	}
	colors, ok := statusBadgeColors[key]
	if !ok {
		return status
	}
	return renderTag(status, colors[0], colors[1])
}
