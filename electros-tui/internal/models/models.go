package models

import (
	"encoding/json"
	"fmt"
)

// AuthStatus mirrors auth daemon /status response.
type AuthStatus struct {
	Authenticated bool   `json:"authenticated"`
	Username      string `json:"username"`
	Org           string `json:"org"`
	Email         string `json:"email,omitempty"`
}

// IsLoggedIn returns whether the user is authenticated.
func (a AuthStatus) IsLoggedIn() bool { return a.Authenticated }

// VmRecord is a compute daemon VM list entry.
type VmRecord struct {
	UniqueID   string          `json:"uniqueID"`
	ServerURL  string          `json:"serverurl"`
	TargetType string          `json:"target_type"`
	Provider   string          `json:"provider"`
	ReqJSON    json.RawMessage `json:"req_json"`
}

// VmReqJSON holds parsed VM request fields.
type VmReqJSON struct {
	VMName       string   `json:"vm_name"`
	States       string   `json:"states"`
	RAMSize      float64  `json:"ramsize"`
	Slots        int      `json:"slots"`
	OSFamily     string   `json:"os_family"`
	OSFlavour    string   `json:"os_flavour"`
	Arch         string   `json:"arch"`
	CreationDate string   `json:"creation_date"`
	Autostart    bool     `json:"autostart"`
	QemuAgent    bool     `json:"qemu_agent"`
}

// ParseReqJSON unmarshals req_json into VmReqJSON.
func (v *VmRecord) ParseReqJSON() (VmReqJSON, error) {
	var req VmReqJSON
	if len(v.ReqJSON) == 0 {
		return req, nil
	}
	err := json.Unmarshal(v.ReqJSON, &req)
	return req, err
}

// VolumeRecord is a storage daemon volume entry.
type VolumeRecord struct {
	Name       string `json:"name"`
	VolumeID   string `json:"volumeID"`
	Format     string `json:"format"`
	Size       int64  `json:"size"`
	SizeOnDisk int64  `json:"sizeOnDisk"`
	Bootable   bool   `json:"bootable"`
	Private    bool   `json:"private"`
	Shareable  bool   `json:"shareable"`
	Readonly   bool   `json:"readonly"`
	Clonable   bool   `json:"clonable"`
	Own        bool   `json:"own"`
	Exported   bool   `json:"exported"`
	Server     string `json:"server"`
	CreatorID  string `json:"creatorID"`
	Bus        string `json:"bus"`
	TargetType string `json:"target_type"`
	Provider   string `json:"provider"`
}

// NetworkRecord is a network daemon entry.
type NetworkRecord struct {
	NetworkName string `json:"network_name"`
	NetworkUID  string `json:"network_uid"`
	Mode        string `json:"mode"`
	Private     bool   `json:"private"`
	Type        string `json:"type"`
	Provider    string `json:"provider"`
}

// DisplayName returns the network name for UI lists.
func (n NetworkRecord) DisplayName() string {
	if n.NetworkName != "" {
		return n.NetworkName
	}
	return n.NetworkUID
}

// PortForwardRecord is a port forward entry.
type PortForwardRecord struct {
	ForwardUID  string `json:"forward_uid"`
	Target      string `json:"target"`
	TargetVMUID string `json:"target_vm_uid"`
	Port        int    `json:"port"`
	TargetPort  int    `json:"target_port"`
	Protocol    string `json:"protocol"`
	ServerURL   string `json:"serverurl"`
}

// TargetRecord is a cloud target entry from GET /list.
type TargetRecord struct {
	TargetID     string          `json:"target_id"`
	TargetType   string          `json:"target_type"`
	TargetConfig json.RawMessage `json:"target_config"`
	PingStatus   json.RawMessage `json:"ping_status"`
}

// DisplayName returns the target identifier for UI lists.
func (t TargetRecord) DisplayName() string {
	if t.TargetID != "" {
		return t.TargetID
	}
	return "unknown-target"
}

// Provider returns the provider from target_config when present.
func (t TargetRecord) Provider() string {
	return targetConfigString(t.TargetConfig, "provider")
}

// ServerURL returns a primary server/IP from target_config.
func (t TargetRecord) ServerURL() string {
	var cfg map[string]any
	if json.Unmarshal(t.TargetConfig, &cfg) != nil {
		return ""
	}
	if ips, ok := cfg["ips"].([]any); ok && len(ips) > 0 {
		return fmt.Sprintf("%v", ips[0])
	}
	if ip, ok := cfg["meson_ip"].(string); ok {
		return ip
	}
	if url, ok := cfg["serverurl"].(string); ok {
		return url
	}
	return ""
}

func targetConfigString(raw json.RawMessage, key string) string {
	var cfg map[string]any
	if json.Unmarshal(raw, &cfg) != nil {
		return ""
	}
	if v, ok := cfg[key].(string); ok {
		return v
	}
	return ""
}

// ServiceInstance is a PaaS service row (NDJSON line object).
type ServiceInstance struct {
	UUID        string `json:"uuid"`
	Name        string `json:"name"`
	ServiceType string `json:"service_type"`
	Status      string `json:"status"`
	TargetUUID  string `json:"target_uuid"`
}

// TcpTunnelInstance mirrors compute port tunnel response.
type TcpTunnelInstance struct {
	InstanceID string `json:"instanceId"`
	Token      string `json:"token"`
	Port       int    `json:"port"`
	Synthetic  bool   `json:"synthetic"`
}

// BillingStatus from auth billing endpoint.
type BillingStatus struct {
	Status  string  `json:"status"`
	Balance float64 `json:"balance"`
}

// AccountDetails from auth account endpoint.
type AccountDetails struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

// OAuthProvidersResponse from auth oauth endpoint.
type OAuthProvidersResponse struct {
	Providers []OAuthProvider `json:"providers"`
}

// OAuthProvider is a single OAuth provider.
type OAuthProvider struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// OAuthLoginResponse holds redirect URL.
type OAuthLoginResponse struct {
	AuthURL string `json:"auth_url"`
}

// PaymentLinkResponse from billing refresh-link.
type PaymentLinkResponse struct {
	PaymentURL string `json:"payment_url"`
}

// HostStatus from compute host/status.
type HostStatus map[string]any

// CanAllocateResponse from compute canallocate.
type CanAllocateResponse struct {
	CanAllocate bool `json:"canallocate"`
}
