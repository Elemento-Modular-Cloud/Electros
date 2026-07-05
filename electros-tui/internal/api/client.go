package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"time"

	"electros-tui/internal/config"
)

// UnauthorizedError is returned on HTTP 401 responses.
type UnauthorizedError struct {
	Op     string
	Detail string
}

func (e *UnauthorizedError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: unauthorized: %s", e.Op, e.Detail)
	}
	return fmt.Sprintf("%s: unauthorized", e.Op)
}

// Client wraps HTTP access to all client daemons.
type Client struct {
	http *http.Client
	ecd  *config.ECD
}

// NewClient creates an API client with a shared cookie jar for session auth.
func NewClient(ecd *config.ECD) *Client {
	jar, _ := cookiejar.New(nil)
	return &Client{
		http: &http.Client{
			Timeout: 60 * time.Second,
			Jar:     jar,
		},
		ecd: ecd,
	}
}

// ECD returns the loaded configuration.
func (c *Client) ECD() *config.ECD { return c.ecd }

// HealthCheck probes a daemon root endpoint.
func (c *Client) HealthCheck(ctx context.Context, port int) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.ecd.HealthURL(port), nil)
	if err != nil {
		return false
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

// AllDaemonsHealthy checks all six client daemons.
func (c *Client) AllDaemonsHealthy(ctx context.Context) map[string]bool {
	n := c.ecd.Networking
	checks := map[string]int{
		"auth":     n.AuthClientRestAPIPort,
		"compute":  n.MatcherClientRestAPIPort,
		"storage":  n.StorageClientRestAPIPort,
		"network":  n.NetworkClientRestAPIPort,
		"targets":  n.TargetClientRestAPIPort,
		"services": n.ServiceClientRestAPIPort,
	}
	out := make(map[string]bool, len(checks))
	for name, port := range checks {
		out[name] = c.HealthCheck(ctx, port)
	}
	return out
}

func (c *Client) get(ctx context.Context, url string, op string, out any) error {
	return c.do(ctx, http.MethodGet, url, nil, op, out)
}

func (c *Client) post(ctx context.Context, url string, body any, op string, out any) error {
	return c.do(ctx, http.MethodPost, url, body, op, out)
}

func (c *Client) delete(ctx context.Context, url string, body any, op string, out any) error {
	return c.do(ctx, http.MethodDelete, url, body, op, out)
}

func (c *Client) do(ctx context.Context, method, url string, body any, op string, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return &UnauthorizedError{Op: op, Detail: string(raw)}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if len(raw) == 0 {
			return fmt.Errorf("%s: HTTP %d", op, resp.StatusCode)
		}
		return fmt.Errorf("%s: HTTP %d: %s", op, resp.StatusCode, string(raw))
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}

func (c *Client) postOK(ctx context.Context, url string, body any, op string) error {
	return c.do(ctx, http.MethodPost, url, body, op, nil)
}
