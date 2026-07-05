package api

import (
	"context"

	"electros-tui/internal/models"
)

func (c *Client) targetBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.TargetClientRestAPIPort, c.ecd.RestKeys.TargetClientAPIURLKey)
}

// TargetHealth checks target daemon health.
func (c *Client) TargetHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.TargetClientRestAPIPort)
}

// ListTargets returns cloud targets.
func (c *Client) ListTargets(ctx context.Context) ([]models.TargetRecord, error) {
	var wrapped struct {
		Data []models.TargetRecord `json:"data"`
	}
	url := c.targetBase() + c.ecd.RestKeys.TargetListAPIKey
	err := c.get(ctx, url, "ListTargets", &wrapped)
	return wrapped.Data, err
}

// CreateTarget creates a target.
func (c *Client) CreateTarget(ctx context.Context, body map[string]any) (models.TargetRecord, error) {
	var out models.TargetRecord
	url := c.targetBase() + c.ecd.RestKeys.TargetCreateAPIKey
	err := c.post(ctx, url, body, "CreateTarget", &out)
	return out, err
}

// UpdateTarget updates a target.
func (c *Client) UpdateTarget(ctx context.Context, body map[string]any) (models.TargetRecord, error) {
	var out models.TargetRecord
	url := c.targetBase() + c.ecd.RestKeys.TargetUpdateAPIKey
	err := c.post(ctx, url, body, "UpdateTarget", &out)
	return out, err
}

// DeleteTarget deletes a target.
func (c *Client) DeleteTarget(ctx context.Context, body map[string]any) error {
	url := c.targetBase() + c.ecd.RestKeys.TargetDeleteAPIKey
	return c.postOK(ctx, url, body, "DeleteTarget")
}

// PingTargets pings all targets.
func (c *Client) PingTargets(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	url := c.targetBase() + c.ecd.RestKeys.TargetPingAPIKey
	err := c.get(ctx, url, "PingTargets", &out)
	return out, err
}

// PingTarget pings a single target.
func (c *Client) PingTarget(ctx context.Context, targetUUID string) (map[string]any, error) {
	var out map[string]any
	url := c.targetBase() + c.ecd.RestKeys.TargetPingAPIKey + "/" + targetUUID
	err := c.get(ctx, url, "PingTarget", &out)
	return out, err
}

// ListTargetTypes returns supported target types.
func (c *Client) ListTargetTypes(ctx context.Context) ([]map[string]any, error) {
	var out []map[string]any
	url := c.targetBase() + c.ecd.RestKeys.TargetTypesAPIKey
	err := c.get(ctx, url, "ListTargetTypes", &out)
	return out, err
}

// ValidateTarget validates target settings.
func (c *Client) ValidateTarget(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.targetBase() + "/validate"
	err := c.post(ctx, url, body, "ValidateTarget", &out)
	return out, err
}
