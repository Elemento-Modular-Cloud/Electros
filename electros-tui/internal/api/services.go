package api

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"electros-tui/internal/models"
)

func (c *Client) servicesBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.ServiceClientRestAPIPort, c.ecd.RestKeys.ServiceClientAPIURLKey)
}

// ServicesHealth checks services daemon health.
func (c *Client) ServicesHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.ServiceClientRestAPIPort)
}

// ListRunningServicesRaw returns NDJSON service instances as generic maps.
func (c *Client) ListRunningServicesRaw(ctx context.Context, serviceType string) ([]map[string]any, error) {
	url := c.servicesBase() + "/" + serviceType + c.ecd.RestKeys.ListServiceAPIKey
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		raw, _ := io.ReadAll(resp.Body)
		return nil, &UnauthorizedError{Op: "ListRunningServicesRaw", Detail: string(raw)}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ListRunningServicesRaw: HTTP %d: %s", resp.StatusCode, string(raw))
	}
	return parseNDJSON[map[string]any](resp.Body)
}

// ListRunningServices returns NDJSON service instances for a service type.
func (c *Client) ListRunningServices(ctx context.Context, serviceType string) ([]models.ServiceInstance, error) {
	url := c.servicesBase() + "/" + serviceType + c.ecd.RestKeys.ListServiceAPIKey
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		raw, _ := io.ReadAll(resp.Body)
		return nil, &UnauthorizedError{Op: "ListRunningServices", Detail: string(raw)}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ListRunningServices: HTTP %d: %s", resp.StatusCode, string(raw))
	}
	return parseNDJSON[models.ServiceInstance](resp.Body)
}

// CanCreateService checks service creation eligibility.
func (c *Client) CanCreateService(ctx context.Context, serviceType string, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.servicesBase() + "/" + serviceType + c.ecd.RestKeys.CanCreateServiceAPIKey
	err := c.post(ctx, url, body, "CanCreateService", &out)
	return out, err
}

// CreateService creates a PaaS service instance.
func (c *Client) CreateService(ctx context.Context, serviceType string, body map[string]any) (map[string]any, error) {
	var out map[string]any
	url := c.servicesBase() + "/" + serviceType + c.ecd.RestKeys.CreateServiceAPIKey
	err := c.post(ctx, url, body, "CreateService", &out)
	return out, err
}

// DeleteService deletes a PaaS service instance.
func (c *Client) DeleteService(ctx context.Context, serviceType string, body map[string]any) error {
	url := c.servicesBase() + "/" + serviceType + c.ecd.RestKeys.DeleteServiceAPIKey
	return c.postOK(ctx, url, body, "DeleteService")
}

// GenerateServiceCredentials returns service credentials.
func (c *Client) GenerateServiceCredentials(ctx context.Context, serviceType string, body map[string]any) (map[string]any, error) {
	var out map[string]any
	key := c.ecd.RestKeys.GenerateServiceCredsKey
	if key == "" {
		key = "/credentials"
	}
	url := c.servicesBase() + "/" + serviceType + key
	err := c.post(ctx, url, body, "GenerateServiceCredentials", &out)
	return out, err
}

// KnownPaaSServices lists PaaS service types used in the GUI.
var KnownPaaSServices = []string{"kaas", "objectstorage", "dbaas", "n8n", "openclaw"}

func parseNDJSON[T any](r io.Reader) ([]T, error) {
	var out []T
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var item T
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, scanner.Err()
}
