package ui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ProviderCatalog maps provider name → services and regions (from supported_providers.json).
type ProviderCatalog struct {
	providers map[string]*providerEntry
}

type providerEntry struct {
	displayName string
	status      string
	serverIPs   []string
	services    map[string]providerService
}

type providerService struct {
	subType      string
	supportLevel string
	regions      []SelectOption
}

// HasService reports whether a provider offers a PaaS/SaaS sub_type.
func (c *ProviderCatalog) HasService(provider, subType string) bool {
	if c == nil {
		return false
	}
	p := c.providers[strings.ToLower(provider)]
	if p == nil {
		return false
	}
	for _, svc := range p.services {
		if svc.subType == subType && svc.supportLevel == "full" {
			return true
		}
	}
	return false
}

// Regions returns all region options for a provider.
func (c *ProviderCatalog) Regions(provider string) []SelectOption {
	if c == nil {
		return nil
	}
	p := c.providers[strings.ToLower(provider)]
	if p == nil {
		return nil
	}
	seen := map[string]struct{}{}
	var out []SelectOption
	for _, svc := range p.services {
		for _, r := range svc.regions {
			if _, ok := seen[r.Value]; ok {
				continue
			}
			seen[r.Value] = struct{}{}
			out = append(out, r)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Label < out[j].Label })
	return out
}

// RegionsForService returns regions for a specific service sub_type on a provider.
func (c *ProviderCatalog) RegionsForService(provider, subType string) []SelectOption {
	if c == nil {
		return nil
	}
	p := c.providers[strings.ToLower(provider)]
	if p == nil {
		return nil
	}
	for _, svc := range p.services {
		if svc.subType == subType {
			return append([]SelectOption(nil), svc.regions...)
		}
	}
	return nil
}

// ProviderOptions returns tethered/public provider select options (production only).
func (c *ProviderCatalog) ProviderOptions() []SelectOption {
	if c == nil {
		return optCloudProvider
	}
	names := make([]string, 0, len(c.providers))
	for name, p := range c.providers {
		if p.status == "production" || p.status == "beta" {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	out := make([]SelectOption, len(names))
	for i, name := range names {
		label := name
		if p := c.providers[name]; p.displayName != "" {
			label = p.displayName
		}
		out[i] = SelectOption{Value: name, Label: label}
	}
	if len(out) == 0 {
		return optCloudProvider
	}
	return out
}

// ServerIP returns a primary server endpoint for a tethered provider.
func (c *ProviderCatalog) ServerIP(provider string) string {
	if c == nil {
		return ""
	}
	p := c.providers[strings.ToLower(provider)]
	if p == nil || len(p.serverIPs) == 0 {
		return ""
	}
	return p.serverIPs[0]
}

// LoadProviderCatalog reads ecd/supported_providers.json.
func LoadProviderCatalog(ecdDir string) (*ProviderCatalog, error) {
	path := filepath.Join(ecdDir, "supported_providers.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var root map[string]map[string]json.RawMessage
	if err := json.Unmarshal(data, &root); err != nil {
		return nil, err
	}
	group, ok := root["ELEMENTO_SUPPORTED_PROVIDERS"]
	if !ok {
		return &ProviderCatalog{providers: map[string]*providerEntry{}}, nil
	}
	catalog := &ProviderCatalog{providers: make(map[string]*providerEntry, len(group))}
	for name, raw := range group {
		var body struct {
			DisplayName string   `json:"display_name"`
			Status      string   `json:"status"`
			ServerIPs   []string `json:"server_ips"`
			Services    []struct {
				SubType      string `json:"sub_type"`
				SupportLevel string `json:"support_level"`
				Regions      map[string]struct {
					Country  string `json:"country"`
					Location string `json:"location"`
				} `json:"regions"`
			} `json:"services"`
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			continue
		}
		entry := &providerEntry{
			displayName: body.DisplayName,
			status:      body.Status,
			serverIPs:   body.ServerIPs,
			services:    map[string]providerService{},
		}
		for _, svc := range body.Services {
			regions := make([]SelectOption, 0, len(svc.Regions))
			for code, meta := range svc.Regions {
				label := code
				if meta.Location != "" {
					label = meta.Location
					if meta.Country != "" {
						label += ", " + meta.Country
					}
				}
				regions = append(regions, SelectOption{Value: code, Label: label})
			}
			sort.Slice(regions, func(i, j int) bool { return regions[i].Label < regions[j].Label })
			entry.services[svc.SubType] = providerService{
				subType:      svc.SubType,
				supportLevel: svc.SupportLevel,
				regions:      regions,
			}
		}
		catalog.providers[strings.ToLower(name)] = entry
	}
	return catalog, nil
}

func (v *formView) submitHint() string {
	if v.wizardEnabled() && v.step == 0 {
		return "next step"
	}
	return "submit"
}
