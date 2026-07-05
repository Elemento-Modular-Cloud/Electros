package session

import (
	"context"
)

// ServiceRefreshSpec identifies one PaaS/SaaS list endpoint to refresh.
type ServiceRefreshSpec struct {
	APIServiceType string
	Path           string
	Category       string
}

// RefreshServiceCounts loads running instance counts for each service type.
func (s *Store) RefreshServiceCounts(ctx context.Context, specs []ServiceRefreshSpec) {
	counts := make(map[string]int, len(specs))
	paasTotal, saasTotal := 0, 0
	for _, spec := range specs {
		items, err := s.client.ListRunningServicesRaw(ctx, spec.APIServiceType)
		if err != nil {
			s.HandleAPIError(err)
			continue
		}
		n := len(items)
		counts[spec.APIServiceType] = n
		if spec.Path != "" {
			counts[spec.Path] = n
		}
		switch spec.Category {
		case "paas":
			paasTotal += n
		case "saas":
			saasTotal += n
		}
	}
	s.mu.Lock()
	s.ServiceCounts = counts
	s.PaaSInstances = paasTotal
	s.SaaSInstances = saasTotal
	s.mu.Unlock()
}
