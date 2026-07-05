package api

import (
	"context"

	"electros-tui/internal/models"
)

func (c *Client) storageBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.StorageClientRestAPIPort, c.ecd.RestKeys.StorageClientAPIURLKey)
}

// StorageHealth checks storage daemon health.
func (c *Client) StorageHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.StorageClientRestAPIPort)
}

// ListVolumes returns accessible volumes.
func (c *Client) ListVolumes(ctx context.Context) ([]models.VolumeRecord, error) {
	var out []models.VolumeRecord
	url := c.storageBase() + c.ecd.RestKeys.AccessibleVolumesAPIKey
	err := c.get(ctx, url, "ListVolumes", &out)
	return out, err
}

// CreateVolume creates a volume.
func (c *Client) CreateVolume(ctx context.Context, body map[string]any) (models.VolumeRecord, error) {
	var out models.VolumeRecord
	url := c.storageBase() + c.ecd.RestKeys.CreateVolumeAPIKey
	err := c.post(ctx, url, body, "CreateVolume", &out)
	return out, err
}

// DestroyVolume deletes a volume.
func (c *Client) DestroyVolume(ctx context.Context, body map[string]any) error {
	url := c.storageBase() + c.ecd.RestKeys.DestroyVolumeAPIKey
	return c.postOK(ctx, url, body, "DestroyVolume")
}

// GetVolumeInfo returns volume info.
func (c *Client) GetVolumeInfo(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.storageBase() + c.ecd.RestKeys.VolumeInfoAPIKey
	err := c.post(ctx, url, body, "GetVolumeInfo", &out)
	return out, err
}

// CanCreateVolume checks volume creation eligibility.
func (c *Client) CanCreateVolume(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.storageBase() + "/cancreate"
	err := c.post(ctx, url, body, "CanCreateVolume", &out)
	return out, err
}

// CreateCloudInitVolume creates a cloud-init volume.
func (c *Client) CreateCloudInitVolume(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	key := c.ecd.RestKeys.CloudInitCreateVolumeAPIKey
	if key == "" {
		key = "/cloudinit/create"
	}
	url := c.storageBase() + key
	err := c.post(ctx, url, body, "CreateCloudInitVolume", &out)
	return out, err
}

// ResizeVolume resizes a volume.
func (c *Client) ResizeVolume(ctx context.Context, body map[string]any) error {
	url := c.storageBase() + "/update/resize"
	return c.postOK(ctx, url, body, "ResizeVolume")
}

// CloneVolume clones a volume.
func (c *Client) CloneVolume(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.storageBase() + "/clone"
	err := c.post(ctx, url, body, "CloneVolume", &out)
	return out, err
}
