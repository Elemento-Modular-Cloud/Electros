package ui

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/nav"
	"electros-tui/internal/services"
	"electros-tui/internal/session"
)

func newServiceListView(deps *Deps, def *services.ServiceDef, w, h int) *listView {
	idCol := serviceUUIDColumn(def)
	return newListView(deps, w, h, listConfig{
		title:       def.Label,
		loader:      serviceListLoader(deps, def),
		summary:     serviceListSummary(def),
		rowDetail:   serviceRowDetail(deps, def),
		delete:      serviceDeleteAction(deps, def, idCol),
		newPath:     def.CreatePath,
		deleteIDCol: idCol,
		help:        "x delete · n create · j/k rows",
	})
}

func serviceListSummary(def *services.ServiceDef) func(*session.Store) string {
	return func(_ *session.Store) string {
		return def.Label + " · API " + def.APIServiceType + " · route " + def.Path
	}
}

func serviceRowDetail(_ *Deps, def *services.ServiceDef) func(*session.Store, int, []table.Row) string {
	return func(_ *session.Store, idx int, rows []table.Row) string {
		if idx >= len(rows) {
			return ""
		}
		parts := make([]string, 0, len(rows[idx]))
		for _, cell := range rows[idx] {
			if cell != "" && cell != "—" {
				parts = append(parts, cell)
			}
		}
		if len(parts) == 0 {
			return ""
		}
		return def.Label + " · " + strings.Join(parts, " · ")
	}
}

func newServiceCreateView(deps *Deps, def *services.ServiceDef, w, h int) *formView {
	return newFormView(deps, w, h, def.CreatePath, serviceCreateSpec(def))
}

func serviceListLoader(deps *Deps, def *services.ServiceDef) listLoader {
	return func(_ *session.Store) ([]table.Row, []table.Column, error) {
		ctx := context.Background()
		items, err := deps.Client.ListRunningServicesRaw(ctx, def.APIServiceType)
		if err != nil {
			return nil, nil, err
		}

		cols := make([]table.Column, len(def.Columns))
		for i, col := range def.Columns {
			cols[i] = table.Column{Title: col.Title, Width: defaultColumnWidth(col.Title)}
		}

		rows := make([]table.Row, 0, len(items))
		for _, item := range items {
			row := make(table.Row, len(def.Columns))
			for i, col := range def.Columns {
				row[i] = colorServiceCell(item, col)
			}
			rows = append(rows, row)
		}
		return rows, cols, nil
	}
}

func serviceUUIDColumn(def *services.ServiceDef) int {
	for i, col := range def.Columns {
		if col.JSONKey == "service_uuid" {
			return i
		}
	}
	if len(def.Columns) > 0 {
		return len(def.Columns) - 1
	}
	return 0
}

func colorServiceCell(item map[string]any, col services.TableColumn) string {
	raw := formatServiceCell(item, col.JSONKey)
	switch col.JSONKey {
	case "status":
		return renderStatusTag(raw)
	case "provider":
		key := resolveProviderKey(raw, formatServiceCell(item, "cluster_name"))
		if key == "" {
			key = resolveProviderKey(raw, formatServiceCell(item, "name"))
		}
		return renderProviderTag(key)
	case "engine":
		if raw == "" || raw == "—" {
			return "—"
		}
		return renderTag(raw, "#006AC9", "#ffffff")
	case "region", "location":
		if raw == "" {
			return "—"
		}
		return renderTag(raw, "#4a4e53", "#ffffff")
	}
	if strings.EqualFold(col.Title, "status") {
		return renderStatusTag(raw)
	}
	if strings.EqualFold(col.Title, "provider") {
		return renderProviderTag(resolveProviderKey(raw, formatServiceCell(item, "cluster_name")))
	}
	return raw
}

func formatServiceCell(item map[string]any, key string) string {
	if v, ok := item[key]; ok && v != nil {
		switch val := v.(type) {
		case string:
			return val
		case float64:
			if val == float64(int64(val)) {
				return fmt.Sprintf("%d", int64(val))
			}
			return fmt.Sprintf("%.2f", val)
		case bool:
			if val {
				return "yes"
			}
			return "no"
		default:
			return fmt.Sprintf("%v", val)
		}
	}
	// Common fallbacks across service types.
	for _, alt := range []string{"cluster_name", "name", "vm_name", "bucket_name"} {
		if v, ok := item[alt]; ok && v != nil {
			return fmt.Sprintf("%v", v)
		}
	}
	return ""
}

func defaultColumnWidth(title string) int {
	switch strings.ToLower(title) {
	case "uuid":
		return 36
	case "status":
		return 12
	case "provider", "region", "location", "version", "engine":
		return 14
	default:
		return 22
	}
}

func serviceDeleteAction(deps *Deps, def *services.ServiceDef, idCol int) actionHandler {
	return func(deps *Deps, idx int, rows []table.Row) tea.Cmd {
		if idx >= len(rows) || len(rows[idx]) == 0 {
			return nil
		}
		col := idCol
		if col < 0 || col >= len(rows[idx]) {
			col = len(rows[idx]) - 1
		}
		uuid := rows[idx][col]
		return func() tea.Msg {
			ctx := context.Background()
			err := deps.Client.DeleteService(ctx, def.APIServiceType, map[string]any{
				"service_uuid": uuid,
			})
			if err != nil {
				return actionDoneMsg{err: deps.Session.HandleAPIError(err)}
			}
			return actionDoneMsg{notice: def.Label + " deleted"}
		}
	}
}

func serviceDefForPath(deps *Deps, path string) *services.ServiceDef {
	if deps == nil || deps.Services == nil {
		return nil
	}
	base := strings.TrimPrefix(path, "/")
	if def := deps.Services.ByPath[base]; def != nil {
		return def
	}
	return deps.Services.ByPath[nav.ServiceRouteForPath(base)]
}
