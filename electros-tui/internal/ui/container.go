package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/nav"
	"electros-tui/internal/session"
)

// containerView shows child routes for container-type nav entries (iaas, settings, dev).
type containerView struct {
	deps         *Deps
	route        *nav.Route
	selected     int
	w, h         int
	lastClick    int
	lastClickAt  time.Time
}

func newContainerView(deps *Deps, route *nav.Route, w, h int) *containerView {
	return &containerView{deps: deps, route: route, w: w, h: h}
}

func (v *containerView) Init() tea.Cmd { return nil }
func (v *containerView) SetSize(w, h int) { v.w, v.h = w, h }
func (v *containerView) SetFocused(bool) {}
func (v *containerView) Update(msg tea.Msg) (View, tea.Cmd) {
	if km, ok := msg.(tea.KeyMsg); ok {
		switch km.String() {
		case "j", "down":
			if v.selected < len(v.route.Children)-1 {
				v.selected++
			}
		case "k", "up":
			if v.selected > 0 {
				v.selected--
			}
		case "enter":
			if len(v.route.Children) > 0 {
				child := v.route.Children[v.selected]
				return v, navigateTo(v.deps, child.Path)
			}
		}
	}
	return v, nil
}

func (v *containerView) Title() string { return v.route.Label }
func (v *containerView) Hints() string { return "j/k navigate · click · Enter open · Tab focus" }

func (v *containerView) View() string {
	f := v.deps.Session.FleetSummary()
	var b strings.Builder
	b.WriteString(StyleStatLabel.Render(fmt.Sprintf("%d sections", len(v.route.Children))) + "\n\n")
	for i, child := range v.route.Children {
		label := child.Label
		if count := containerChildCount(child.Path, f); count != "" {
			label += "  " + StyleStat.Render(count)
		}
		path := StyleMuted.Render("  " + child.Path)
		if i == v.selected {
			b.WriteString(StyleSidebarActive.Render(" "+label+" ") + path + "\n")
		} else {
			b.WriteString(" " + label + " " + path + "\n")
		}
	}
	return b.String()
}

func (v *containerView) itemIndexAt(innerY int) (int, bool) {
	const headerLines = 2
	idx := innerY - headerLines
	if idx < 0 || idx >= len(v.route.Children) {
		return -1, false
	}
	return idx, true
}

func (v *containerView) HandleMouse(msg tea.MouseMsg, _, innerY int) tea.Cmd {
	switch msg.Button {
	case tea.MouseButtonWheelUp:
		if v.selected > 0 {
			v.selected--
		}
		return nil
	case tea.MouseButtonWheelDown:
		if v.selected < len(v.route.Children)-1 {
			v.selected++
		}
		return nil
	case tea.MouseButtonLeft:
		if msg.Action != tea.MouseActionPress {
			return nil
		}
		idx, ok := v.itemIndexAt(innerY)
		if !ok {
			return nil
		}
		if isDoubleClick(v.lastClick, idx, v.lastClickAt) {
			return navigateTo(v.deps, v.route.Children[idx].Path)
		}
		v.selected = idx
		v.lastClick = idx
		v.lastClickAt = time.Now()
		return nil
	}
	return nil
}

func containerChildCount(path string, f session.FleetSummary) string {
	switch path {
	case "iaas/storage":
		if f.Volumes > 0 {
			return fmt.Sprintf("%d volumes", f.Volumes)
		}
	case "iaas/networking":
		if f.Networks > 0 {
			return fmt.Sprintf("%d networks", f.Networks)
		}
	case "iaas/virtual-machines", "iaas/ephemeral-vms":
		if f.VMs > 0 {
			return fmt.Sprintf("%d VMs", f.VMs)
		}
	case "my-clouds":
		if f.Targets > 0 {
			return fmt.Sprintf("%d targets", f.Targets)
		}
	}
	return ""
}
