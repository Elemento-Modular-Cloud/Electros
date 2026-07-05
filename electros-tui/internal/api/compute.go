package api

import (
	"context"

	"electros-tui/internal/models"
)

func (c *Client) computeBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.MatcherClientRestAPIPort, c.ecd.RestKeys.ClientAPIURLKey)
}

// ComputeHealth checks compute daemon health.
func (c *Client) ComputeHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.MatcherClientRestAPIPort)
}

// ListVMs returns all VMs.
func (c *Client) ListVMs(ctx context.Context) ([]models.VmRecord, error) {
	var out []models.VmRecord
	url := c.computeBase() + c.ecd.RestKeys.StatusAPIKey
	err := c.get(ctx, url, "ListVMs", &out)
	return out, err
}

// ListTemplates returns VM templates.
func (c *Client) ListTemplates(ctx context.Context) ([]models.VmRecord, error) {
	var out []models.VmRecord
	url := c.computeBase() + c.ecd.RestKeys.TemplatesAPIKey
	err := c.get(ctx, url, "ListTemplates", &out)
	return out, err
}

// GetHostStatus returns host status map.
func (c *Client) GetHostStatus(ctx context.Context) (models.HostStatus, error) {
	var out models.HostStatus
	url := c.computeBase() + c.ecd.RestKeys.HostStatusAPIKey
	err := c.get(ctx, url, "GetHostStatus", &out)
	return out, err
}

// CanAllocate checks if VM can be allocated.
func (c *Client) CanAllocate(ctx context.Context, body map[string]any) (models.CanAllocateResponse, error) {
	var out models.CanAllocateResponse
	url := c.computeBase() + c.ecd.RestKeys.CanAllocateAPIKey
	err := c.post(ctx, url, body, "CanAllocate", &out)
	return out, err
}

// RegisterVM creates a VM.
func (c *Client) RegisterVM(ctx context.Context, body map[string]any) (models.VmRecord, error) {
	var out models.VmRecord
	url := c.computeBase() + c.ecd.RestKeys.RegisterAPIKey
	err := c.post(ctx, url, body, "RegisterVM", &out)
	return out, err
}

// UnregisterVM deletes a VM.
func (c *Client) UnregisterVM(ctx context.Context, localIndex string) error {
	body := map[string]string{"local_index": localIndex}
	url := c.computeBase() + c.ecd.RestKeys.UnregisterAPIKey
	return c.postOK(ctx, url, body, "UnregisterVM")
}

// StartVM powers on a VM.
func (c *Client) StartVM(ctx context.Context, localIndex string) error {
	return c.vmPower(ctx, c.ecd.RestKeys.StartVMKey, localIndex, "StartVM")
}

// StopVM powers off a VM.
func (c *Client) StopVM(ctx context.Context, localIndex string) error {
	return c.vmPower(ctx, c.ecd.RestKeys.StopVMKey, localIndex, "StopVM")
}

// RebootVM reboots a VM.
func (c *Client) RebootVM(ctx context.Context, localIndex string) error {
	return c.vmPower(ctx, c.ecd.RestKeys.RebootVMKey, localIndex, "RebootVM")
}

func (c *Client) vmPower(ctx context.Context, key, localIndex, op string) error {
	body := map[string]string{"local_index": localIndex}
	url := c.computeBase() + key
	return c.postOK(ctx, url, body, op)
}

// MigrateVM migrates a VM.
func (c *Client) MigrateVM(ctx context.Context, body map[string]any) error {
	url := c.computeBase() + c.ecd.RestKeys.MigrationAPIKey
	return c.postOK(ctx, url, body, "MigrateVM")
}

// StartVNCTunnel opens a VNC port tunnel.
func (c *Client) StartVNCTunnel(ctx context.Context, body map[string]any) (models.TcpTunnelInstance, error) {
	var out models.TcpTunnelInstance
	url := c.computeBase() + c.ecd.RestKeys.PortTunnelVNCWithWS
	err := c.post(ctx, url, body, "StartVNCTunnel", &out)
	return out, err
}

// StopVNCTunnel closes a VNC tunnel.
func (c *Client) StopVNCTunnel(ctx context.Context, instanceID string) error {
	body := map[string]string{"instanceId": instanceID}
	url := c.computeBase() + c.ecd.RestKeys.PortTunnelStopVNCWithWS
	return c.postOK(ctx, url, body, "StopVNCTunnel")
}

// StartPortTunnel starts a generic port tunnel.
func (c *Client) StartPortTunnel(ctx context.Context, body map[string]any) (models.TcpTunnelInstance, error) {
	var out models.TcpTunnelInstance
	url := c.computeBase() + c.ecd.RestKeys.PortTunnelStart
	err := c.post(ctx, url, body, "StartPortTunnel", &out)
	return out, err
}

// StopPortTunnel stops a port tunnel.
func (c *Client) StopPortTunnel(ctx context.Context, instanceID string) error {
	body := map[string]string{"instanceId": instanceID}
	url := c.computeBase() + c.ecd.RestKeys.PortTunnelStop
	return c.postOK(ctx, url, body, "StopPortTunnel")
}

// RunQemuAgent runs a QEMU agent command.
func (c *Client) RunQemuAgent(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.computeBase() + "/agent/run"
	err := c.post(ctx, url, body, "RunQemuAgent", &out)
	return out, err
}

// AttachNetwork attaches a network to a VM.
func (c *Client) AttachNetwork(ctx context.Context, body map[string]any) error {
	url := c.computeBase() + "/network/attach"
	return c.postOK(ctx, url, body, "AttachNetwork")
}

// DetachNetwork detaches a network from a VM.
func (c *Client) DetachNetwork(ctx context.Context, body map[string]any) error {
	url := c.computeBase() + "/network/detach"
	return c.postOK(ctx, url, body, "DetachNetwork")
}

// ListBackups lists VM backups.
func (c *Client) ListBackups(ctx context.Context, vmUUID string) ([]map[string]any, error) {
	var out []map[string]any
	url := c.computeBase() + "/backups?vm_uuid=" + vmUUID
	err := c.get(ctx, url, "ListBackups", &out)
	return out, err
}

// CreateBackup creates a VM backup.
func (c *Client) CreateBackup(ctx context.Context, body map[string]any) error {
	url := c.computeBase() + "/backup"
	return c.postOK(ctx, url, body, "CreateBackup")
}
