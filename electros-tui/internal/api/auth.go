package api

import (
	"context"
	"fmt"

	"electros-tui/internal/models"
)

func (c *Client) authBase() string {
	return c.ecd.BaseURL(c.ecd.Networking.AuthClientRestAPIPort, c.ecd.RestKeys.AuthClientAPIURLKey)
}

// AuthHealth checks auth daemon health.
func (c *Client) AuthHealth(ctx context.Context) bool {
	return c.HealthCheck(ctx, c.ecd.Networking.AuthClientRestAPIPort)
}

// GetAuthStatus returns current authentication status.
func (c *Client) GetAuthStatus(ctx context.Context) (models.AuthStatus, error) {
	var status models.AuthStatus
	url := c.authBase() + "/status"
	err := c.get(ctx, url, "GetAuthStatus", &status)
	return status, err
}

// Login authenticates with username/password.
func (c *Client) Login(ctx context.Context, username, password, org string) error {
	body := map[string]string{
		"username": username,
		"password": password,
	}
	if org != "" {
		body["org"] = org
	}
	url := c.authBase() + c.ecd.RestKeys.AuthLogin
	return c.postOK(ctx, url, body, "Login")
}

// LocalLogin performs AtomOS local login.
func (c *Client) LocalLogin(ctx context.Context, username, password string) error {
	body := map[string]string{
		"username": username,
		"password": password,
	}
	key := c.ecd.RestKeys.AtomOSGUILocalLogin
	if key == "" {
		key = "/local_login"
	}
	url := c.authBase() + key
	return c.postOK(ctx, url, body, "LocalLogin")
}

// Logout ends the session.
func (c *Client) Logout(ctx context.Context) error {
	url := c.authBase() + c.ecd.RestKeys.AuthLogout
	return c.postOK(ctx, url, nil, "Logout")
}

// GetOAuthProviders lists OAuth providers.
func (c *Client) GetOAuthProviders(ctx context.Context) (models.OAuthProvidersResponse, error) {
	var out models.OAuthProvidersResponse
	url := c.authBase() + c.ecd.RestKeys.OAuthProviders
	err := c.get(ctx, url, "GetOAuthProviders", &out)
	return out, err
}

// StartOAuthLogin returns OAuth redirect URL.
func (c *Client) StartOAuthLogin(ctx context.Context, provider string) (models.OAuthLoginResponse, error) {
	var out models.OAuthLoginResponse
	url := c.authBase() + c.ecd.RestKeys.OAuthLogin
	err := c.post(ctx, url, map[string]string{"provider": provider}, "StartOAuthLogin", &out)
	return out, err
}

// GetBillingStatus returns billing status.
func (c *Client) GetBillingStatus(ctx context.Context) (models.BillingStatus, error) {
	var out models.BillingStatus
	url := c.authBase() + c.ecd.RestKeys.BillingStatusAPIKey
	err := c.get(ctx, url, "GetBillingStatus", &out)
	return out, err
}

// GetAccountDetails returns account details.
func (c *Client) GetAccountDetails(ctx context.Context) (models.AccountDetails, error) {
	var out models.AccountDetails
	url := c.authBase() + "/account/details"
	err := c.get(ctx, url, "GetAccountDetails", &out)
	return out, err
}

// RefreshPaymentLink returns Stripe payment URL.
func (c *Client) RefreshPaymentLink(ctx context.Context, billingUUID string) (models.PaymentLinkResponse, error) {
	var out models.PaymentLinkResponse
	url := fmt.Sprintf("%s/billing/%s/refresh-link", c.authBase(), billingUUID)
	err := c.post(ctx, url, nil, "RefreshPaymentLink", &out)
	return out, err
}

// ListLicenses returns license list.
func (c *Client) ListLicenses(ctx context.Context) ([]map[string]any, error) {
	var out []map[string]any
	url := c.authBase() + "/license/list"
	err := c.get(ctx, url, "ListLicenses", &out)
	return out, err
}

// ListOrganizations returns org list.
func (c *Client) ListOrganizations(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	url := c.authBase() + "/org/list"
	err := c.get(ctx, url, "ListOrganizations", &out)
	return out, err
}

// GetBillingTransactions returns billing transactions.
func (c *Client) GetBillingTransactions(ctx context.Context, billingUUID string) ([]map[string]any, error) {
	var out []map[string]any
	url := c.authBase() + "/billing/my/transactions"
	if billingUUID != "" {
		url += "?billing_uuid=" + billingUUID
	}
	err := c.get(ctx, url, "GetBillingTransactions", &out)
	return out, err
}

// MCPBaseURL returns MCP server URL.
func (c *Client) MCPBaseURL() string {
	return fmt.Sprintf("http://%s:%d", c.ecd.Options.Host, c.ecd.Networking.MCPServerPort)
}

// AuthBaseURL exposes auth base for host layer.
func (c *Client) AuthBaseURL() string { return c.authBase() }
