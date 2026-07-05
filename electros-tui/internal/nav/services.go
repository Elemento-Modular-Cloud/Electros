package nav

import (
	"strings"

	"electros-tui/internal/services"
)

const (
	paasContainerName = "paas"
	saasContainerName = "saas"
)

// InjectServiceRoutes adds PaaS/SaaS containers and service pages from supported_intents.json.
func InjectServiceRoutes(r *Router, reg *services.Registry) {
	if r == nil || reg == nil || len(reg.Services) == 0 {
		return
	}

	paas := ensureContainer(r, paasContainerName, "PaaS", "fa-cubes")
	saas := ensureContainer(r, saasContainerName, "SaaS", "fa-grid-2")

	paas.Children = nil
	saas.Children = nil

	for _, def := range reg.Services {
		page := buildServicePageRoute(&def, containerForCategory(paas, saas, def.Category))
		indexRoute(r, page)
	}

	insertContainersAfterIAAS(r, paas, saas)
}

func containerForCategory(paas, saas *Route, category string) *Route {
	if category == saasContainerName {
		return saas
	}
	return paas
}

func ensureContainer(r *Router, name, label, icon string) *Route {
	if existing := r.ByPath[name]; existing != nil && existing.Type == RouteContainer {
		existing.Label = label
		existing.Icon = icon
		return existing
	}
	rt := &Route{
		Name:  name,
		Path:  name,
		Label: label,
		Icon:  icon,
		Type:  RouteContainer,
	}
	r.ByPath[name] = rt
	return rt
}

func buildServicePageRoute(def *services.ServiceDef, parent *Route) *Route {
	create := &Route{
		Name:   "create",
		Path:   def.CreatePath,
		Label:  "Create " + def.Label,
		Type:   RouteSubpage,
		parent: nil,
	}
	page := &Route{
		Name:       def.PageName,
		Path:       def.Path,
		Label:      def.Label,
		Icon:       def.Icon,
		Type:       RoutePage,
		Searchable: true,
		parent:     parent,
		Children:   []*Route{create},
	}
	create.parent = page
	parent.Children = append(parent.Children, page)
	return page
}

func insertContainersAfterIAAS(r *Router, paas, saas *Route) {
	// Drop stale container entries so we can re-insert in the right order.
	filtered := make([]*Route, 0, len(r.Root))
	for _, rt := range r.Root {
		if rt.Path == paasContainerName || rt.Path == saasContainerName {
			continue
		}
		filtered = append(filtered, rt)
	}

	newRoot := make([]*Route, 0, len(filtered)+2)
	inserted := false
	for _, rt := range filtered {
		newRoot = append(newRoot, rt)
		if rt.Name == "iaas" && !inserted {
			if len(paas.Children) > 0 {
				newRoot = append(newRoot, paas)
			}
			if len(saas.Children) > 0 {
				newRoot = append(newRoot, saas)
			}
			inserted = true
		}
	}
	if !inserted {
		if len(paas.Children) > 0 {
			newRoot = append(newRoot, paas)
		}
		if len(saas.Children) > 0 {
			newRoot = append(newRoot, saas)
		}
	}
	r.Root = newRoot
}

// ServiceRouteForPath returns a service definition path without the /create suffix.
func ServiceRouteForPath(path string) string {
	return strings.TrimSuffix(strings.TrimPrefix(path, "/"), "/create")
}
