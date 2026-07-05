package api

import (
	"context"

	"electros-tui/internal/models"
)

func (c *Client) networkBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.NetworkClientRestAPIPort, c.ecd.RestKeys.NetworkClientAPIURLKey)
}

// NetworkHealth checks network daemon health.
func (c *Client) NetworkHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.NetworkClientRestAPIPort)
}

// ListNetworks returns all networks.
func (c *Client) ListNetworks(ctx context.Context) ([]models.NetworkRecord, error) {
	var out []models.NetworkRecord
	url := c.networkBase() + c.ecd.RestKeys.ListNetworksAPIKey
	err := c.get(ctx, url, "ListNetworks", &out)
	return out, err
}

// CreateNetwork creates a network.
func (c *Client) CreateNetwork(ctx context.Context, body map[string]any) (models.NetworkRecord, error) {
	var out models.NetworkRecord
	url := c.networkBase() + c.ecd.RestKeys.CreateNetworkAPIKey
	err := c.post(ctx, url, body, "CreateNetwork", &out)
	return out, err
}

// DeleteNetwork deletes a network.
func (c *Client) DeleteNetwork(ctx context.Context, body map[string]any) error {
	url := c.networkBase() + c.ecd.RestKeys.DeleteNetworkAPIKey
	return c.postOK(ctx, url, body, "DeleteNetwork")
}

// GetNetworkInfo returns network info.
func (c *Client) GetNetworkInfo(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.networkBase() + c.ecd.RestKeys.InfoNetworkAPIKey
	err := c.post(ctx, url, body, "GetNetworkInfo", &out)
	return out, err
}

// ListPortForwards returns port forwards.
func (c *Client) ListPortForwards(ctx context.Context) ([]models.PortForwardRecord, error) {
	var out []models.PortForwardRecord
	key := c.ecd.RestKeys.ListForwardedPortsAPIKey
	if key == "" {
		key = "/portforwards"
	}
	url := c.networkBase() + key
	err := c.get(ctx, url, "ListPortForwards", &out)
	return out, err
}

// CreatePortForward creates a port forward.
func (c *Client) CreatePortForward(ctx context.Context, body map[string]any) error {
	key := c.ecd.RestKeys.ForwardPortAPIKey
	if key == "" {
		key = "/portforward"
	}
	url := c.networkBase() + key
	return c.postOK(ctx, url, body, "CreatePortForward")
}

// DeletePortForward removes a port forward.
func (c *Client) DeletePortForward(ctx context.Context, body map[string]any) error {
	key := c.ecd.RestKeys.ForwardPortAPIKey
	if key == "" {
		key = "/portforward"
	}
	url := c.networkBase() + key
	return c.delete(ctx, url, body, "DeletePortForward", nil)
}
