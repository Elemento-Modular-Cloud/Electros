package session

import (
	"strings"
	"time"

	"electros-tui/internal/models"
)

// FleetSummary aggregates cached fleet counts for the shell UI.
type FleetSummary struct {
	VMs          int
	VMsRunning   int
	VMsStopped   int
	Volumes      int
	Networks     int
	Targets      int
	PortForwards int
	VolumeBytes  int64
	LastRefresh  time.Time
}

// FleetSummary returns aggregate counts from the session cache.
func (s *Store) FleetSummary() FleetSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := FleetSummary{
		VMs:          len(s.VMs),
		Volumes:      len(s.Volumes),
		Networks:     len(s.Networks),
		Targets:      len(s.Targets),
		PortForwards: len(s.PortForwards),
		LastRefresh:  s.LastRefresh,
	}
	for _, vm := range s.VMs {
		req, _ := vm.ParseReqJSON()
		if strings.EqualFold(req.States, "running") {
			out.VMsRunning++
		} else {
			out.VMsStopped++
		}
	}
	for _, v := range s.Volumes {
		out.VolumeBytes += v.Size
	}
	return out
}

// LastRefreshAgo returns a human-readable age string.
func (s *Store) LastRefreshAgo() string {
	s.mu.RLock()
	t := s.LastRefresh
	s.mu.RUnlock()
	if t.IsZero() {
		return "never"
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return d.Round(time.Second).String() + " ago"
	default:
		return t.Format("15:04")
	}
}

// VMByIndex returns a VM from the cached list.
func (s *Store) VMByIndex(idx int) (models.VmRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if idx < 0 || idx >= len(s.VMs) {
		return models.VmRecord{}, false
	}
	return s.VMs[idx], true
}

// VolumeByIndex returns a volume from the cached list.
func (s *Store) VolumeByIndex(idx int) (models.VolumeRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if idx < 0 || idx >= len(s.Volumes) {
		return models.VolumeRecord{}, false
	}
	return s.Volumes[idx], true
}

// NetworkByIndex returns a network from the cached list.
func (s *Store) NetworkByIndex(idx int) (models.NetworkRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if idx < 0 || idx >= len(s.Networks) {
		return models.NetworkRecord{}, false
	}
	return s.Networks[idx], true
}

// TargetByIndex returns a target from the cached list.
func (s *Store) TargetByIndex(idx int) (models.TargetRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if idx < 0 || idx >= len(s.Targets) {
		return models.TargetRecord{}, false
	}
	return s.Targets[idx], true
}
