package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Options holds runtime configuration for the TUI.
type Options struct {
	ECDDir     string
	PagesPath  string
	Host       string
	PathPrefix string
	UseLocalhost bool
	AtomOS     bool
	Deeplink   string
	NoColor    bool
}

// Networking holds daemon port numbers from ECD networking.json.
type Networking struct {
	MatcherClientRestAPIPort  int `json:"MATCHER_CLIENT_REST_API_PORT"`
	StorageClientRestAPIPort  int `json:"STORAGE_CLIENT_REST_API_PORT"`
	NetworkClientRestAPIPort  int `json:"NETWORK_CLIENT_REST_API_PORT"`
	AuthClientRestAPIPort     int `json:"AUTH_CLIENT_REST_API_PORT"`
	TargetClientRestAPIPort   int `json:"TARGET_CLIENT_REST_API_PORT"`
	ServiceClientRestAPIPort  int `json:"SERVICE_CLIENT_REST_API_PORT"`
	MCPServerPort             int `json:"MCP_SERVER_PORT"`
}

// RestKeys holds API path suffixes from ECD restkeys.json.
type RestKeys struct {
	ClientAPIURLKey          string `json:"CLIENT_API_URL_KEY"`
	StorageClientAPIURLKey   string `json:"STORAGE_CLIENT_API_URL_KEY"`
	NetworkClientAPIURLKey   string `json:"NETWORK_CLIENT_API_URL_KEY"`
	ServiceClientAPIURLKey   string `json:"SERVICE_CLIENT_API_URL_KEY"`
	AuthClientAPIURLKey      string `json:"AUTH_CLIENT_API_URL_KEY"`
	TargetClientAPIURLKey    string `json:"TARGET_CLIENT_API_URL_KEY"`

	AuthLogin    string `json:"AUTH_LOGIN"`
	AuthLogout   string `json:"AUTH_LOGOUT"`
	StatusAPIKey string `json:"STATUS_API_KEY"`

	OAuthProviders string `json:"OAUTH_PROVIDERS"`
	OAuthLogin     string `json:"OAUTH_LOGIN"`

	TemplatesAPIKey   string `json:"TEMPLATES_API_KEY"`
	HostStatusAPIKey  string `json:"HOST_STATUS_API_KEY"`
	CanAllocateAPIKey string `json:"CANALLOCATE_API_KEY"`
	RegisterAPIKey    string `json:"REGISTER_API_KEY"`
	UnregisterAPIKey  string `json:"UNREGISTER_API_KEY"`
	StartVMKey        string `json:"START_VM_KEY"`
	StopVMKey         string `json:"STOP_VM_KEY"`
	RebootVMKey       string `json:"REBOOT_VM_KEY"`
	MigrationAPIKey   string `json:"MIGRATION_API_KEY"`

	PortTunnelVNCWithWS     string `json:"PORTTUNNEL_VNC_WITH_WS"`
	PortTunnelStopVNCWithWS string `json:"PORTTUNNEL_STOP_VNC_WITH_WS"`
	PortTunnelStart         string `json:"PORTTUNNEL_START"`
	PortTunnelStop          string `json:"PORTTUNNEL_STOP"`

	AccessibleVolumesAPIKey string `json:"ACCESSIBLE_VOLUMES_API_KEY"`
	CreateVolumeAPIKey      string `json:"CREATE_VOLUME_API_KEY"`
	DestroyVolumeAPIKey     string `json:"DESTROY_VOLUME_API_KEY"`
	VolumeInfoAPIKey        string `json:"VOLUME_INFO_API_KEY"`

	ListNetworksAPIKey  string `json:"LIST_NETWORKS_API_KEY"`
	CreateNetworkAPIKey string `json:"CREATE_NETWORK_API_KEY"`
	DeleteNetworkAPIKey string `json:"DELETE_NETWORK_API_KEY"`
	InfoNetworkAPIKey   string `json:"INFO_NETWORK_API_KEY"`

	ListForwardedPortsAPIKey string `json:"LIST_FORWARDED_PORTS_API_KEY"`
	ForwardPortAPIKey      string `json:"FORWARD_PORT_API_KEY"`

	TargetListAPIKey   string `json:"TARGET_LIST_API_KEY"`
	TargetCreateAPIKey string `json:"TARGET_CREATE_API_KEY"`
	TargetUpdateAPIKey string `json:"TARGET_UPDATE_API_KEY"`
	TargetDeleteAPIKey string `json:"TARGET_DELETE_API_KEY"`
	TargetPingAPIKey   string `json:"TARGET_PING_API_KEY"`
	TargetTypesAPIKey  string `json:"TARGET_TYPES_API_KEY"`

	ListServiceAPIKey        string `json:"LIST_SERVICE_API_KEY"`
	CreateServiceAPIKey      string `json:"CREATE_SERVICE_API_KEY"`
	DeleteServiceAPIKey      string `json:"DELETE_SERVICE_API_KEY"`
	CanCreateServiceAPIKey   string `json:"CAN_CREATE_SERVICE_API_KEY"`
	GenerateServiceCredsKey  string `json:"GENERATE_SERVICE_CREDENTIALS_API_KEY"`

	CloudInitCreateVolumeAPIKey string `json:"CLOUDINIT_CREATE_VOLUME_API_KEY"`

	BillingStatusAPIKey string `json:"BILLING_STATUS_API_KEY"`

	AtomOSGUILocalLogin string `json:"ATOMOSGUI_LOCAL_LOGIN"`
}

// ECD bundles loaded configuration files.
type ECD struct {
	Networking Networking
	RestKeys   RestKeys
	Options    Options
}

// DefaultECDDir resolves the sibling GUI ECD path relative to the repo.
func DefaultECDDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "../elemento-gui-new/electros/ecd"
	}
	candidate := filepath.Join(cwd, "..", "elemento-gui-new", "electros", "ecd")
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return filepath.Join(cwd, "elemento-gui-new", "electros", "ecd")
}

// DefaultPagesPath resolves pages.json relative to ECD dir.
func DefaultPagesPath(ecdDir string) string {
	return filepath.Join(filepath.Dir(ecdDir), "configs", "pages.json")
}

// Load reads ECD JSON files and merges runtime options.
func Load(opts Options) (*ECD, error) {
	if opts.ECDDir == "" {
		opts.ECDDir = DefaultECDDir()
	}
	if opts.PagesPath == "" {
		opts.PagesPath = DefaultPagesPath(opts.ECDDir)
	}
	if opts.Host == "" {
		opts.Host = "127.0.0.1"
	}
	if opts.PathPrefix == "" && !opts.UseLocalhost {
		opts.UseLocalhost = true
	}
	if opts.PathPrefix != "" {
		opts.UseLocalhost = false
	}

	net, err := loadJSON[Networking](filepath.Join(opts.ECDDir, "networking.json"))
	if err != nil {
		return nil, fmt.Errorf("networking.json: %w", err)
	}
	keys, err := loadJSON[RestKeys](filepath.Join(opts.ECDDir, "restkeys.json"))
	if err != nil {
		return nil, fmt.Errorf("restkeys.json: %w", err)
	}

	return &ECD{Networking: net, RestKeys: keys, Options: opts}, nil
}

func loadJSON[T any](path string) (T, error) {
	var out T
	data, err := os.ReadFile(path)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(data, &out)
	return out, err
}

// BaseURL builds a daemon base URL for localhost or path-prefix mode.
func (e *ECD) BaseURL(port int, apiKey string) string {
	if e.Options.UseLocalhost {
		return fmt.Sprintf("http://%s:%d%s", e.Options.Host, port, apiKey)
	}
	return fmt.Sprintf("%s%s", e.Options.PathPrefix, apiKey)
}

// HealthURL returns the root health check URL for a daemon port.
func (e *ECD) HealthURL(port int) string {
	if e.Options.UseLocalhost {
		return fmt.Sprintf("http://%s:%d/", e.Options.Host, port)
	}
	return e.Options.PathPrefix + "/"
}
