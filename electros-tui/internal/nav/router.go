package nav

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// RouteType mirrors GUI RouteType enum.
type RouteType string

const (
	RouteHome      RouteType = "home"
	RoutePage      RouteType = "page"
	RouteContainer RouteType = "container"
	RouteSubpage   RouteType = "subpage"
	RouteDebug     RouteType = "debug"
)

// Route represents a navigation entry from pages.json.
type Route struct {
	Name         string
	Path         string
	Label        string
	Icon         string
	Type         RouteType
	Searchable   bool
	Experimental bool
	Beta         bool
	Children     []*Route
	parent       *Route
}

// Router manages navigation state.
type Router struct {
	Root         []*Route
	ByPath       map[string]*Route
	Current      *Route
	BackStack    []*Route
	PagesPath    string
}

// PageConfig is the JSON shape from pages.json.
type PageConfig struct {
	Loc      string        `json:"loc"`
	Name     string        `json:"name"`
	Icon     string        `json:"icon"`
	Type     RouteType     `json:"type"`
	Subpages []PageConfig  `json:"subpages"`
	Supports []string      `json:"supports"`
	Experimental bool      `json:"experimental"`
	Beta     bool          `json:"beta"`
}

// LoadRouter reads pages.json and builds the route tree.
func LoadRouter(pagesPath string) (*Router, error) {
	data, err := os.ReadFile(pagesPath)
	if err != nil {
		return nil, err
	}
	var configs []PageConfig
	if err := json.Unmarshal(data, &configs); err != nil {
		return nil, err
	}
	r := &Router{PagesPath: pagesPath, ByPath: make(map[string]*Route)}
	for _, cfg := range configs {
		rt := buildRoute(cfg, "", nil)
		r.Root = append(r.Root, rt)
		indexRoute(r, rt)
	}
	if home := r.ByPath["dashboard"]; home != nil {
		r.Current = home
	} else if len(r.Root) > 0 {
		r.Current = r.Root[0]
	}
	return r, nil
}

func buildRoute(cfg PageConfig, prefix string, parent *Route) *Route {
	path := cfg.Name
	if prefix != "" {
		path = prefix + "/" + cfg.Name
	}
	rt := &Route{
		Name:         cfg.Name,
		Path:         path,
		Label:        localizeLabel(cfg.Loc),
		Icon:         cfg.Icon,
		Type:         cfg.Type,
		Searchable:   contains(cfg.Supports, "searchable"),
		Experimental: cfg.Experimental,
		Beta:         cfg.Beta,
		parent:       parent,
	}
	for _, sub := range cfg.Subpages {
		child := buildRoute(sub, path, rt)
		rt.Children = append(rt.Children, child)
	}
	return rt
}

func indexRoute(r *Router, rt *Route) {
	r.ByPath[rt.Path] = rt
	for _, child := range rt.Children {
		indexRoute(r, child)
	}
}

func localizeLabel(loc string) string {
	if strings.HasPrefix(loc, "literal:") {
		return strings.TrimPrefix(loc, "literal:")
	}
	// Known GUI label keys → readable titles
	known := map[string]string{
		"label/pageDashboard":        "Dashboard",
		"label/pageMyClouds":         "My Clouds",
		"label/pagesIaas/iaas":       "IaaS",
		"label/pagesSettings/settings": "Settings",
		"label/pageUiDemo":           "UI Demo",
	}
	if title, ok := known[loc]; ok {
		return title
	}
	parts := strings.Split(loc, "/")
	last := parts[len(parts)-1]
	last = strings.TrimPrefix(last, "page")
	last = strings.TrimPrefix(last, "pages")
	if last == "" {
		return loc
	}
	// camelCase / path segments → words
	last = strings.ReplaceAll(last, "-", " ")
	if strings.Contains(last, "Iaas") {
		last = strings.ReplaceAll(last, "Iaas", "IaaS")
	}
	return titleCase(last)
}

func titleCase(s string) string {
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func contains(items []string, want string) bool {
	for _, item := range items {
		if item == want {
			return true
		}
	}
	return false
}

// NavigateTo switches to a route by path.
func (r *Router) NavigateTo(path string) error {
	rt, ok := r.ByPath[path]
	if !ok {
		return fmt.Errorf("unknown route: %s", path)
	}
	if r.Current != nil && r.Current.Path != rt.Path {
		r.BackStack = append(r.BackStack, r.Current)
	}
	r.Current = rt
	return nil
}

// GoBack pops the back stack.
func (r *Router) GoBack() bool {
	if len(r.BackStack) == 0 {
		return false
	}
	idx := len(r.BackStack) - 1
	r.Current = r.BackStack[idx]
	r.BackStack = r.BackStack[:idx]
	return true
}

// TopLevelRoutes returns root navigation entries.
func (r *Router) TopLevelRoutes() []*Route {
	return r.Root
}

// SearchableRoutes returns all routes marked searchable.
func (r *Router) SearchableRoutes() []*Route {
	var out []*Route
	var walk func([]*Route)
	walk = func(routes []*Route) {
		for _, rt := range routes {
			if rt.Searchable {
				out = append(out, rt)
			}
			walk(rt.Children)
		}
	}
	walk(r.Root)
	return out
}

// ParseDeeplink parses electros:// URLs into route path and params.
func ParseDeeplink(raw string) (path string, handler string, params map[string]string, err error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "electros://")
	params = make(map[string]string)
	if idx := strings.Index(raw, "?"); idx >= 0 {
		query := raw[idx+1:]
		raw = raw[:idx]
		for _, part := range strings.Split(query, "&") {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 {
				params[kv[0]] = kv[1]
			}
		}
	}
	if idx := strings.Index(raw, "{"); idx >= 0 {
		end := strings.Index(raw, "}")
		if end > idx {
			handler = raw[idx+1 : end]
			raw = raw[:idx] + raw[end+1:]
		}
	}
	path = strings.Trim(raw, "/")
	return path, handler, params, nil
}

// FlatRoutes returns all routes for search/command palette.
func (r *Router) FlatRoutes() []*Route {
	var out []*Route
	var walk func([]*Route)
	walk = func(routes []*Route) {
		for _, rt := range routes {
			out = append(out, rt)
			walk(rt.Children)
		}
	}
	walk(r.Root)
	return out
}
