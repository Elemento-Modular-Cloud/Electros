package session

import (
	"context"
	"sync"
	"time"

	"electros-tui/internal/api"
	"electros-tui/internal/models"
)

// Store holds authenticated user state and cached fleet data.
type Store struct {
	mu          sync.RWMutex
	client      *api.Client
	User        models.AuthStatus
	VMs         []models.VmRecord
	Volumes     []models.VolumeRecord
	Networks    []models.NetworkRecord
	Targets     []models.TargetRecord
	PortForwards []models.PortForwardRecord
	ServiceCounts map[string]int // API type or route path → instance count
	PaaSInstances int
	SaaSInstances int
	LastRefresh time.Time
	onUnauthorized func()
}

// NewStore creates a session store.
func NewStore(client *api.Client) *Store {
	return &Store{client: client}
}

// SetUnauthorizedHandler registers a callback for 401 responses.
func (s *Store) SetUnauthorizedHandler(fn func()) {
	s.onUnauthorized = fn
}

// Client returns the API client.
func (s *Store) Client() *api.Client { return s.client }

// HandleAPIError processes API errors, triggering logout on 401.
func (s *Store) HandleAPIError(err error) error {
	if _, ok := err.(*api.UnauthorizedError); ok {
		s.mu.Lock()
		s.User = models.AuthStatus{}
		s.mu.Unlock()
		if s.onUnauthorized != nil {
			s.onUnauthorized()
		}
	}
	return err
}

// RefreshAuth updates authentication status from daemon.
func (s *Store) RefreshAuth(ctx context.Context) (models.AuthStatus, error) {
	status, err := s.client.GetAuthStatus(ctx)
	if err != nil {
		return status, s.HandleAPIError(err)
	}
	s.mu.Lock()
	s.User = status
	s.mu.Unlock()
	return status, nil
}

// Login performs username/password login.
func (s *Store) Login(ctx context.Context, username, password, org string, atomos bool) error {
	var err error
	if atomos {
		err = s.client.LocalLogin(ctx, username, password)
	} else {
		err = s.client.Login(ctx, username, password, org)
	}
	if err != nil {
		return err
	}
	_, err = s.RefreshAuth(ctx)
	return err
}

// Logout ends the session.
func (s *Store) Logout(ctx context.Context) error {
	err := s.client.Logout(ctx)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.User = models.AuthStatus{}
	s.VMs = nil
	s.Volumes = nil
	s.Networks = nil
	s.Targets = nil
	s.PortForwards = nil
	s.ServiceCounts = nil
	s.PaaSInstances = 0
	s.SaaSInstances = 0
	s.mu.Unlock()
	return nil
}

// RefreshAll reloads fleet data (mirrors GUI Events.reload.all).
func (s *Store) RefreshAll(ctx context.Context) error {
	vms, err := s.client.ListVMs(ctx)
	if err != nil {
		return s.HandleAPIError(err)
	}
	vols, err := s.client.ListVolumes(ctx)
	if err != nil {
		return s.HandleAPIError(err)
	}
	nets, err := s.client.ListNetworks(ctx)
	if err != nil {
		return s.HandleAPIError(err)
	}
	targets, err := s.client.ListTargets(ctx)
	if err != nil {
		return s.HandleAPIError(err)
	}
	pf, err := s.client.ListPortForwards(ctx)
	if err != nil {
		return s.HandleAPIError(err)
	}
	s.mu.Lock()
	s.VMs = vms
	s.Volumes = vols
	s.Networks = nets
	s.Targets = targets
	s.PortForwards = pf
	s.LastRefresh = time.Now()
	s.mu.Unlock()
	return nil
}

// Snapshot returns a copy of cached fleet data.
func (s *Store) Snapshot() (user models.AuthStatus, vms []models.VmRecord, vols []models.VolumeRecord, nets []models.NetworkRecord, targets []models.TargetRecord) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	user = s.User
	vms = append([]models.VmRecord(nil), s.VMs...)
	vols = append([]models.VolumeRecord(nil), s.Volumes...)
	nets = append([]models.NetworkRecord(nil), s.Networks...)
	targets = append([]models.TargetRecord(nil), s.Targets...)
	return
}

// UserInfo returns current user display string.
func (s *Store) UserInfo() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.User.IsLoggedIn() {
		return "not logged in"
	}
	if s.User.Org != "" {
		return s.User.Username + "@" + s.User.Org
	}
	return s.User.Username
}
