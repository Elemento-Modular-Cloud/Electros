package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// TableColumn describes a service list column from supported_intents.json.
type TableColumn struct {
	Title   string
	JSONKey string
}

// ServiceDef is a navigable PaaS/SaaS service page.
type ServiceDef struct {
	APIServiceType string
	Category       string
	PageName       string
	Label          string
	Path           string
	CreatePath     string
	Icon           string
	Columns        []TableColumn
	CreateFields   []CreateField
}

// CreateField describes one advanced create form input.
type CreateField struct {
	Key         string
	Label       string
	Placeholder string
	Default     string
	Multiline   bool
	Options     []FieldOption
}

// FieldOption is one value in a select-style create field.
type FieldOption struct {
	Value string
	Label string
}

// Registry holds service definitions loaded from supported_intents.json.
type Registry struct {
	Services []ServiceDef
	ByPath   map[string]*ServiceDef
}

// DefaultIntentsPath resolves supported_intents.json next to the ECD directory.
func DefaultIntentsPath(ecdDir string) string {
	return filepath.Join(ecdDir, "supported_intents.json")
}

// LoadRegistry reads supported_intents.json and builds service route metadata.
func LoadRegistry(intentsPath string) (*Registry, error) {
	data, err := os.ReadFile(intentsPath)
	if err != nil {
		return nil, err
	}

	var raw map[string]map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	reg := &Registry{ByPath: make(map[string]*ServiceDef)}
	for _, group := range raw {
		for apiType, bodyRaw := range group {
			def, err := parseServiceDef(apiType, bodyRaw)
			if err != nil {
				return nil, err
			}
			if def == nil {
				continue
			}
			reg.Services = append(reg.Services, *def)
			reg.ByPath[def.Path] = &reg.Services[len(reg.Services)-1]
			reg.ByPath[def.CreatePath] = &reg.Services[len(reg.Services)-1]
		}
	}

	sort.Slice(reg.Services, func(i, j int) bool {
		if reg.Services[i].Category != reg.Services[j].Category {
			return reg.Services[i].Category < reg.Services[j].Category
		}
		return reg.Services[i].Label < reg.Services[j].Label
	})

	return reg, nil
}

type intentBody struct {
	Metadata struct {
		Category             string `json:"category"`
		PageName             string `json:"page_name"`
		PageNameLocalization string `json:"page_name_localization"`
		PageIcon             string `json:"page_icon"`
	} `json:"metadata"`
	MainFormData map[string]json.RawMessage `json:"main_form_data"`
	TableLayout  []struct {
		Name    string `json:"name"`
		JSONKey string `json:"json_key"`
	} `json:"table_layout"`
}

func parseServiceDef(apiType string, raw json.RawMessage) (*ServiceDef, error) {
	var body intentBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, fmt.Errorf("parse service %s: %w", apiType, err)
	}
	category := strings.ToLower(strings.TrimSpace(body.Metadata.Category))
	pageName := strings.ToLower(strings.TrimSpace(body.Metadata.PageName))
	if category == "" || pageName == "" {
		return nil, nil
	}
	if category != "paas" && category != "saas" {
		return nil, nil
	}

	label := localizeIntentLabel(body.Metadata.PageNameLocalization, pageName)
	path := category + "/" + pageName

	cols := make([]TableColumn, 0, len(body.TableLayout))
	for _, col := range body.TableLayout {
		title := strings.TrimSpace(col.Name)
		key := strings.TrimSpace(col.JSONKey)
		if title == "" || key == "" {
			continue
		}
		cols = append(cols, TableColumn{Title: title, JSONKey: key})
	}
	if len(cols) == 0 {
		cols = defaultServiceColumns()
	}

	return &ServiceDef{
		APIServiceType: apiType,
		Category:       category,
		PageName:       pageName,
		Label:          label,
		Path:           path,
		CreatePath:     path + "/create",
		Icon:           body.Metadata.PageIcon,
		Columns:        cols,
		CreateFields:   parseCreateFields(body.MainFormData),
	}, nil
}

func parseCreateFields(raw map[string]json.RawMessage) []CreateField {
	if len(raw) == 0 {
		return nil
	}
	keys := make([]string, 0, len(raw))
	for k := range raw {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	out := make([]CreateField, 0, len(keys))
	for _, key := range keys {
		fieldRaw := raw[key]
		var meta struct {
			UserLabel string `json:"user_label"`
			Type      string `json:"type"`
			Default   interface{} `json:"default"`
			Options   []struct {
				UserLabel string `json:"user_label"`
				Value     string `json:"value"`
			} `json:"options"`
		}
		if err := json.Unmarshal(fieldRaw, &meta); err != nil {
			continue
		}
		label := strings.TrimSpace(meta.UserLabel)
		if label == "" {
			label = key
		}
		def := formatDefault(meta.Default)
		switch strings.ToLower(meta.Type) {
		case "boolean", "bool":
			d := "false"
			if b, ok := meta.Default.(bool); ok && b {
				d = "true"
			} else if def == "true" {
				d = "true"
			}
			out = append(out, CreateField{
				Key:     key,
				Label:   label,
				Default: d,
				Options: []FieldOption{
					{Value: "true", Label: "Yes"},
					{Value: "false", Label: "No"},
				},
			})
		case "select", "enum", "radio":
			opts := make([]FieldOption, 0, len(meta.Options))
			for _, o := range meta.Options {
				val := strings.TrimSpace(o.Value)
				if val == "" {
					continue
				}
				lbl := strings.TrimSpace(o.UserLabel)
				if lbl == "" {
					lbl = val
				}
				opts = append(opts, FieldOption{Value: val, Label: lbl})
			}
			if len(opts) == 0 {
				out = append(out, CreateField{Key: key, Label: label, Default: def})
			} else {
				if def == "" {
					def = opts[0].Value
				}
				out = append(out, CreateField{Key: key, Label: label, Default: def, Options: opts})
			}
		case "datalist", "object", "map":
			out = append(out, CreateField{
				Key:       key + "_json",
				Label:     label + " (JSON)",
				Default:   "[]",
				Multiline: true,
			})
		case "textarea", "text-area":
			out = append(out, CreateField{Key: key, Label: label, Default: def, Multiline: true})
		default:
			out = append(out, CreateField{Key: key, Label: label, Default: def})
		}
	}
	return out
}

func formatDefault(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		b, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val)
		}
		return string(b)
	}
}

func localizeIntentLabel(loc, fallback string) string {
	loc = strings.TrimSpace(loc)
	if strings.HasPrefix(loc, "literal:") {
		return strings.TrimPrefix(loc, "literal:")
	}
	if loc != "" {
		return loc
	}
	return titleCase(fallback)
}

func defaultServiceColumns() []TableColumn {
	return []TableColumn{
		{Title: "Name", JSONKey: "cluster_name"},
		{Title: "UUID", JSONKey: "service_uuid"},
		{Title: "Status", JSONKey: "status"},
	}
}

func titleCase(s string) string {
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// ByCategory returns services grouped by category in stable order.
func (r *Registry) ByCategory(category string) []ServiceDef {
	var out []ServiceDef
	for _, def := range r.Services {
		if def.Category == category {
			out = append(out, def)
		}
	}
	return out
}
