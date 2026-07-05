package models

import (
	"encoding/json"
	"fmt"
)

// VmReqFull extends parsed VM request JSON with advanced table fields.
type VmReqFull struct {
	VmReqJSON
	AllowSMT         bool   `json:"allowSMT"`
	Provider         string `json:"provider"`
	DeploymentRegion string `json:"deployment_region"`
	NetworkConfig    struct {
		IPv4 string `json:"ipv4"`
		MAC  string `json:"mac"`
	} `json:"network_config"`
	PciDevs []struct {
		Vendor   string `json:"vendor"`
		Model    string `json:"model"`
		Quantity int    `json:"quantity"`
	} `json:"pcidevs"`
	Volumes []json.RawMessage `json:"volumes"`
}

// ParseReqFull unmarshals req_json including advanced fields.
func (v *VmRecord) ParseReqFull() (VmReqFull, error) {
	var req VmReqFull
	if len(v.ReqJSON) == 0 {
		return req, nil
	}
	err := json.Unmarshal(v.ReqJSON, &req)
	return req, err
}

// GPUCount returns total GPU devices attached to the VM.
func (r VmReqFull) GPUCount() int {
	n := 0
	for _, d := range r.PciDevs {
		if d.Quantity > 0 {
			n += d.Quantity
		} else {
			n++
		}
	}
	return n
}

// VolumeCount returns attached volume count.
func (r VmReqFull) VolumeCount() int { return len(r.Volumes) }

// PrimaryIPv4 returns the primary network IPv4 if configured.
func (r VmReqFull) PrimaryIPv4() string {
	if r.NetworkConfig.IPv4 != "" {
		return r.NetworkConfig.IPv4
	}
	return "—"
}

// CPULabel returns CPU slots label like the GUI table.
func (r VmReqFull) CPULabel() string {
	unit := "cores"
	if r.AllowSMT {
		unit = "threads"
	}
	return fmt.Sprintf("%d %s", r.Slots, unit)
}
