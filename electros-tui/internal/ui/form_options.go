package ui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// SelectOption is one selectable value in a form dropdown.
type SelectOption struct {
	Value string
	Label string
}

// FormOptions holds enum values aligned with the GUI (iso.json + static lists).
type FormOptions struct {
	OSFamilies   []SelectOption
	OSFlavours   map[string][]SelectOption
	PCICatalog   map[string]*PCIVendor
	Providers    *ProviderCatalog
	volumeNames  map[string]string
	networkNames map[string]string
}

// PCIVendor is a PCI vendor with device models (from epm/*.json).
type PCIVendor struct {
	ID      string
	Name    string
	Devices []PCIDevice
}

// PCIDevice is one PCI device model.
type PCIDevice struct {
	ID   string
	Name string
}

// DefaultFormOptions returns static enums when iso.json is unavailable.
func DefaultFormOptions() *FormOptions {
	opts := &FormOptions{
		OSFamilies: []SelectOption{
			{Value: "linux", Label: "Linux"},
			{Value: "windows", Label: "Windows"},
			{Value: "macos", Label: "macOS"},
		},
		OSFlavours: map[string][]SelectOption{
			"linux": {
				{Value: "ubuntu", Label: "Ubuntu"},
				{Value: "debian", Label: "Debian"},
				{Value: "centos", Label: "CentOS"},
			},
			"windows": {
				{Value: "windows10", Label: "Windows10"},
				{Value: "windows11", Label: "Windows11"},
			},
			"macos": {
				{Value: "macos", Label: "macOS"},
			},
		},
	}
	return opts
}

// LoadFormOptions reads GUI-aligned option lists from the electros bundle.
func LoadFormOptions(ecdDir string) (*FormOptions, error) {
	opts := DefaultFormOptions()
	isoPath := filepath.Join(filepath.Dir(ecdDir), "ist", "iso.json")
	data, err := os.ReadFile(isoPath)
	if err != nil {
		return opts, err
	}
	var entries []struct {
		OSFamily  string `json:"os_family"`
		OSFlavour string `json:"os_flavour"`
		Name      string `json:"name"`
	}
	if err := json.Unmarshal(data, &entries); err != nil {
		return opts, err
	}

	families := map[string]struct{}{}
	flavourSeen := map[string]map[string]struct{}{}
	flavours := map[string][]SelectOption{}

	for _, e := range entries {
		family := strings.TrimSpace(e.OSFamily)
		flavour := strings.TrimSpace(e.OSFlavour)
		if family == "" || flavour == "" {
			continue
		}
		families[family] = struct{}{}
		if flavourSeen[family] == nil {
			flavourSeen[family] = map[string]struct{}{}
		}
		if _, ok := flavourSeen[family][flavour]; ok {
			continue
		}
		flavourSeen[family][flavour] = struct{}{}
		label := strings.TrimSpace(e.Name)
		if label == "" {
			label = flavour
		}
		flavours[family] = append(flavours[family], SelectOption{Value: flavour, Label: label})
	}

	if len(families) > 0 {
		opts.OSFamilies = opts.OSFamilies[:0]
		for family := range families {
			opts.OSFamilies = append(opts.OSFamilies, SelectOption{
				Value: family,
				Label: formatOSFamilyLabel(family),
			})
		}
		sort.Slice(opts.OSFamilies, func(i, j int) bool {
			return opts.OSFamilies[i].Label < opts.OSFamilies[j].Label
		})
	}
	if len(flavours) > 0 {
		opts.OSFlavours = flavours
		for family := range opts.OSFlavours {
			sort.Slice(opts.OSFlavours[family], func(i, j int) bool {
				return opts.OSFlavours[family][i].Label < opts.OSFlavours[family][j].Label
			})
		}
	}
	if catalog, err := loadPCICatalog(filepath.Dir(ecdDir)); err == nil {
		opts.PCICatalog = catalog
	}
	if providers, err := LoadProviderCatalog(ecdDir); err == nil {
		opts.Providers = providers
	}
	return opts, nil
}

func loadPCICatalog(electrosDir string) (map[string]*PCIVendor, error) {
	vendorsPath := filepath.Join(electrosDir, "epm", "vendors.json")
	modelsPath := filepath.Join(electrosDir, "epm", "models.json")
	vendorRaw, err := os.ReadFile(vendorsPath)
	if err != nil {
		return nil, err
	}
	modelsRaw, err := os.ReadFile(modelsPath)
	if err != nil {
		return nil, err
	}
	var vendorMap map[string]string
	if err := json.Unmarshal(vendorRaw, &vendorMap); err != nil {
		return nil, err
	}
	var modelsMap map[string][][]string
	if err := json.Unmarshal(modelsRaw, &modelsMap); err != nil {
		return nil, err
	}
	catalog := make(map[string]*PCIVendor, len(vendorMap))
	for id, name := range vendorMap {
		if id == "0000" {
			continue
		}
		v := &PCIVendor{ID: id, Name: name}
		for _, pair := range modelsMap[id] {
			if len(pair) < 2 {
				continue
			}
			v.Devices = append(v.Devices, PCIDevice{Name: pair[0], ID: pair[1]})
		}
		sort.Slice(v.Devices, func(i, j int) bool { return v.Devices[i].Name < v.Devices[j].Name })
		catalog[id] = v
	}
	return catalog, nil
}

func formatOSFamilyLabel(family string) string {
	switch family {
	case "windows":
		return "Windows"
	case "macos":
		return "macOS"
	case "linux":
		return "Linux"
	default:
		if family == "" {
			return family
		}
		return strings.ToUpper(family[:1]) + family[1:]
	}
}

var (
	optArch = []SelectOption{
		{Value: "X86_64", Label: "x86_64"},
		{Value: "X86_32", Label: "x86"},
	}
	optFirmware = []SelectOption{
		{Value: "bios", Label: "BIOS"},
		{Value: "efi", Label: "EFI"},
	}
	optTargetType = []SelectOption{
		{Value: "atomos_local_ip", Label: "AtomOS (local IP)"},
		{Value: "atomos_local_discovery", Label: "AtomOS (autodiscovery)"},
		{Value: "meson_public", Label: "Meson public"},
		{Value: "meson_private", Label: "Meson private"},
	}
	optVolumeFormat = []SelectOption{
		{Value: "qcow2", Label: "qcow2"},
		{Value: "raw", Label: "raw"},
		{Value: "iso", Label: "iso"},
	}
	optVolumeBus = []SelectOption{
		{Value: "virtio", Label: "VirtIO"},
		{Value: "sata", Label: "SATA"},
		{Value: "ide", Label: "IDE"},
		{Value: "scsi", Label: "SCSI"},
	}
	optNetworkMode = []SelectOption{
		{Value: "nat", Label: "NAT"},
		{Value: "bridge", Label: "Bridge"},
		{Value: "null", Label: "Isolated"},
		{Value: "route", Label: "Routed"},
		{Value: "open", Label: "Open"},
	}
	optHypervisorType = []SelectOption{
		{Value: "hypervisor_proxmox", Label: "Proxmox VE"},
		{Value: "hypervisor_esxi", Label: "VMware ESXi"},
	}
	optCloudProvider = []SelectOption{
		{Value: "gcp", Label: "Google Cloud"},
		{Value: "aws", Label: "AWS"},
		{Value: "ovh", Label: "OVH"},
		{Value: "scaleway", Label: "Scaleway"},
	}
)
