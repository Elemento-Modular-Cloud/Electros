package ui

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"electros-tui/internal/api"
	"electros-tui/internal/host"
	"electros-tui/internal/nav"
	"electros-tui/internal/services"
	"electros-tui/internal/session"
)

type tickMsg time.Time
type refreshDoneMsg struct{ err error }
type dataLoadedMsg struct {
	err error
}
type authDoneMsg struct {
	err error
}
type actionDoneMsg struct {
	err    error
	notice string
}
type chatRespMsg struct {
	text   string
	thread string
	err    error
}
type noticeClearMsg struct{ seq int }

type navigateMsg struct {
	path string
}

// App is the root Bubble Tea model.
type App struct {
	deps      *Deps
	mode      string // login, shell
	overlay   string // "", search, cmd
	width     int
	height    int
	errMsg    string
	notice    string
	noticeSeq int
	connOK    bool

	sidebarIdx int
	focusArea  FocusArea
	content    View

	// login
	userInput  textinput.Model
	passInput  textinput.Model
	orgInput   textinput.Model
	loginFocus int
	// search
	searchInput textinput.Model
	searchHits  []*nav.Route
	searchIdx   int
	// cmd palette
	cmdInput textinput.Model
	// agent chat panel (docked right)
	chatOpen     bool
	chatInput    textinput.Model
	chatLog      []string
	chatThread   string
	chatView     viewport.Model
	chatWaiting  bool
	// suspend fn for SSH
	suspend func(func() error) tea.Cmd
}

// Deps holds runtime dependencies.
type Deps struct {
	Session    *session.Store
	Router     *nav.Router
	Client     *api.Client
	Services   *services.Registry
	FormOpts   *FormOptions
	AtomOS     bool
	Deeplink   string
	Context    map[string]string
	OnNavigate func(path string)
}

// NewApp creates the application model.
func NewApp(deps *Deps) *App {
	user := textinput.New()
	user.Placeholder = "username"
	user.Focus()
	pass := textinput.New()
	pass.Placeholder = "password"
	pass.EchoMode = textinput.EchoPassword
	pass.EchoCharacter = '•'
	org := textinput.New()
	org.Placeholder = "organization (optional)"
	search := textinput.New()
	search.Placeholder = "search pages..."
	cmd := textinput.New()
	cmd.Placeholder = "route path or electros:// deeplink"
	chat := textinput.New()
	chat.Placeholder = "Ask Electra AI..."
	a := &App{
		deps:        deps,
		mode:        "login",
		focusArea:   FocusContent,
		userInput:   user,
		passInput:   pass,
		orgInput:    org,
		searchInput: search,
		cmdInput:    cmd,
		chatInput:   chat,
		chatView:    viewport.New(30, 10),
	}
	deps.Session.SetUnauthorizedHandler(func() {
		a.mode = "login"
		a.errMsg = "session expired — please log in again"
	})
	deps.Context = make(map[string]string)
	deps.OnNavigate = func(path string) {
		_ = deps.Router.NavigateTo(path)
	}
	return a
}

func (a *App) Init() tea.Cmd {
	return tea.Batch(textinput.Blink, a.checkAuth())
}

func (a *App) checkAuth() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		status, err := a.deps.Session.RefreshAuth(ctx)
		if err != nil {
			return authDoneMsg{err: err}
		}
		if status.IsLoggedIn() {
			if err := a.refreshFleet(ctx); err != nil {
				return dataLoadedMsg{err: err}
			}
			return authDoneMsg{}
		}
		return authDoneMsg{err: fmt.Errorf("not authenticated")}
	}
}

func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.resizePanels()
	case tea.KeyMsg:
		switch a.mode {
		case "login":
			return a.updateLogin(msg)
		default:
			switch a.overlay {
			case "search":
				return a.updateSearch(msg)
			case "cmd":
				return a.updateCmd(msg)
			}
			return a.updateShell(msg)
		}
	case tea.MouseMsg:
		switch a.mode {
		case "login":
			return a, nil
		default:
			if a.overlay != "" {
				return a, nil
			}
			return a.handleShellMouse(msg)
		}
	case authDoneMsg:
		if msg.err == nil {
			a.mode = "shell"
			a.errMsg = ""
			a.connOK = true
			a.focusArea = FocusContent
			initCmd := a.loadCurrentView()
			return a, tea.Batch(tickEvery(), a.refreshData(), initCmd)
		}
		a.mode = "login"
		a.connOK = false
		a.errMsg = msg.err.Error()
	case dataLoadedMsg:
		if msg.err != nil {
			a.errMsg = msg.err.Error()
			a.connOK = false
		} else {
			a.errMsg = ""
			a.connOK = true
			if a.content != nil {
				a.content.Init()
			}
		}
	case refreshDoneMsg:
		if msg.err != nil {
			a.errMsg = msg.err.Error()
			a.connOK = false
		} else {
			a.errMsg = ""
			a.connOK = true
			if a.content != nil {
				a.content.Init()
			}
		}
	case actionDoneMsg:
		var clear tea.Cmd
		if msg.err != nil {
			a.errMsg = msg.err.Error()
		} else {
			a.notice = msg.notice
			a.errMsg = ""
			clear = a.scheduleNoticeClear()
		}
		return a, tea.Batch(a.refreshData(), clear)
	case chatRespMsg:
		a.chatWaiting = false
		if msg.err != nil {
			a.chatLog = append(a.chatLog, StyleError.Render("error: "+msg.err.Error()))
		} else {
			a.chatLog = append(a.chatLog, StyleSuccess.Render("AI ▸ ")+msg.text)
			if msg.thread != "" {
				a.chatThread = msg.thread
			}
		}
		a.refreshChatViewport()
	case noticeClearMsg:
		if msg.seq == a.noticeSeq {
			a.notice = ""
		}
	case formDoneMsg:
		if msg.err == nil {
			a.notice = msg.notice
			a.errMsg = ""
			a.deps.Router.GoBack()
			initCmd := a.loadCurrentView()
			return a, tea.Batch(a.refreshData(), a.scheduleNoticeClear(), initCmd)
		}
		if a.content != nil {
			var cmd tea.Cmd
			a.content, cmd = a.content.Update(msg)
			return a, cmd
		}
		return a, nil
	case navigateMsg:
		return a, a.loadCurrentView()
	case tickMsg:
		return a, tea.Batch(tickEvery(), func() tea.Msg {
			ctx := context.Background()
			_, err := a.deps.Session.RefreshAuth(ctx)
			return refreshDoneMsg{err: err}
		})
	}
	if a.content != nil && a.mode == "shell" {
		var cmd tea.Cmd
		a.content, cmd = a.content.Update(msg)
		return a, cmd
	}
	return a, nil
}

func (a *App) scheduleNoticeClear() tea.Cmd {
	a.noticeSeq++
	seq := a.noticeSeq
	return tea.Tick(4*time.Second, func(time.Time) tea.Msg { return noticeClearMsg{seq: seq} })
}

func (a *App) resizePanels() {
	lay := computeLayout(a.width, a.height, a.chatOpen)
	if a.content != nil {
		if s, ok := a.content.(sizable); ok {
			s.SetSize(lay.contentW-2, lay.bodyH-2)
		}
	}
	a.chatView.Width = lay.chatW - 2
	a.chatView.Height = lay.bodyH - 4 // panel borders + divider + input row
	if a.chatView.Height < 3 {
		a.chatView.Height = 3
	}
	a.refreshChatViewport()
}

// --- login ---

func (a *App) updateLogin(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c":
		return a, tea.Quit
	case "tab", "shift+tab", "down", "up":
		if msg.String() == "shift+tab" || msg.String() == "up" {
			a.loginFocus = (a.loginFocus + 2) % 3
		} else {
			a.loginFocus = (a.loginFocus + 1) % 3
		}
		a.syncLoginFocus()
		return a, nil
	case "enter":
		return a, a.doLogin()
	}
	var cmd tea.Cmd
	switch a.loginFocus {
	case 0:
		a.userInput, cmd = a.userInput.Update(msg)
	case 1:
		a.passInput, cmd = a.passInput.Update(msg)
	case 2:
		a.orgInput, cmd = a.orgInput.Update(msg)
	}
	return a, cmd
}

func (a *App) syncLoginFocus() {
	a.userInput.Blur()
	a.passInput.Blur()
	a.orgInput.Blur()
	switch a.loginFocus {
	case 0:
		a.userInput.Focus()
	case 1:
		a.passInput.Focus()
	case 2:
		a.orgInput.Focus()
	}
}

func (a *App) doLogin() tea.Cmd {
	user := strings.TrimSpace(a.userInput.Value())
	pass := a.passInput.Value()
	org := strings.TrimSpace(a.orgInput.Value())
	return func() tea.Msg {
		ctx := context.Background()
		if err := a.deps.Session.Login(ctx, user, pass, org, a.deps.AtomOS); err != nil {
			return authDoneMsg{err: err}
		}
		if err := a.refreshFleet(ctx); err != nil {
			return dataLoadedMsg{err: err}
		}
		return authDoneMsg{}
	}
}

func (a *App) refreshFleet(ctx context.Context) error {
	err := a.deps.Session.RefreshAll(ctx)
	if a.deps.Services != nil {
		specs := make([]session.ServiceRefreshSpec, 0, len(a.deps.Services.Services))
		for _, def := range a.deps.Services.Services {
			specs = append(specs, session.ServiceRefreshSpec{
				APIServiceType: def.APIServiceType,
				Path:           def.Path,
				Category:       def.Category,
			})
		}
		a.deps.Session.RefreshServiceCounts(ctx, specs)
	}
	return err
}

// --- shell input ---

func (a *App) updateShell(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	// Always-available shortcuts.
	switch key {
	case "ctrl+c":
		return a, tea.Quit
	case "tab":
		a.cycleFocus()
		return a, nil
	case "f2":
		a.toggleChat()
		return a, nil
	}

	if a.focusArea == FocusChat {
		return a.updateChat(msg)
	}

	// Letter shortcuts are suppressed while a form is capturing text.
	if !a.contentCapturesText() {
		switch key {
		case "?":
			a.notice = "Tab: cycle focus | /: search | :: goto | c: AI chat | click: select | r: refresh | b/Esc: back | l: logout | q: quit"
			return a, a.scheduleNoticeClear()
		case "/":
			a.overlay = "search"
			a.searchInput.SetValue("")
			a.searchInput.Focus()
			a.filterSearch("")
			return a, textinput.Blink
		case ":":
			a.overlay = "cmd"
			a.cmdInput.SetValue("")
			a.cmdInput.Focus()
			return a, textinput.Blink
		case "c":
			a.toggleChat()
			return a, textinput.Blink
		case "r":
			return a, a.refreshData()
		case "l":
			return a, func() tea.Msg {
				ctx := context.Background()
				err := a.deps.Session.Logout(ctx)
				a.mode = "login"
				return actionDoneMsg{err: err, notice: "logged out"}
			}
		case "q":
			if a.focusArea == FocusSidebar {
				return a, tea.Quit
			}
		}
	}

	if a.focusArea == FocusSidebar {
		switch key {
		case "j", "down":
			if a.sidebarIdx < len(a.deps.Router.TopLevelRoutes())-1 {
				a.sidebarIdx++
			}
			return a, nil
		case "k", "up":
			if a.sidebarIdx > 0 {
				a.sidebarIdx--
			}
			return a, nil
		case "enter":
			routes := a.deps.Router.TopLevelRoutes()
			if a.sidebarIdx < len(routes) {
				_ = a.deps.Router.NavigateTo(routes[a.sidebarIdx].Path)
				a.focusArea = FocusContent
				a.syncContentFocus()
				return a, a.loadCurrentView()
			}
			return a, nil
		}
		return a, nil
	}

	// Content focus: back navigation.
	if !a.contentCapturesText() || key == "esc" {
		switch key {
		case "b", "esc":
			if a.deps.Router.GoBack() {
				return a, a.loadCurrentView()
			}
			return a, nil
		}
	}

	if a.content != nil {
		var cmd tea.Cmd
		a.content, cmd = a.content.Update(msg)
		return a, cmd
	}
	return a, nil
}

func (a *App) toggleChat() {
	a.chatOpen = !a.chatOpen
	if a.chatOpen {
		a.focusArea = FocusChat
	} else if a.focusArea == FocusChat {
		a.focusArea = FocusContent
	}
	a.syncChatFocus()
	a.syncContentFocus()
	a.resizePanels()
}

// --- search / cmd overlays ---

func (a *App) updateSearch(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c":
		return a, tea.Quit
	case "esc":
		a.overlay = ""
		return a, nil
	case "enter":
		if len(a.searchHits) > 0 && a.searchIdx < len(a.searchHits) {
			_ = a.deps.Router.NavigateTo(a.searchHits[a.searchIdx].Path)
			a.overlay = ""
			return a, a.loadCurrentView()
		}
		return a, nil
	case "up":
		if a.searchIdx > 0 {
			a.searchIdx--
		}
		return a, nil
	case "down":
		if a.searchIdx < len(a.searchHits)-1 {
			a.searchIdx++
		}
		return a, nil
	}
	var cmd tea.Cmd
	a.searchInput, cmd = a.searchInput.Update(msg)
	a.filterSearch(a.searchInput.Value())
	return a, cmd
}

func (a *App) updateCmd(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c":
		return a, tea.Quit
	case "esc":
		a.overlay = ""
		return a, nil
	case "enter":
		raw := strings.TrimSpace(a.cmdInput.Value())
		if strings.HasPrefix(raw, "electros://") {
			path, handler, params, err := nav.ParseDeeplink(raw)
			if err == nil {
				_ = a.deps.Router.NavigateTo(path)
				a.overlay = ""
				initCmd := a.loadCurrentView()
				if handler == "openVnc" && params["vmUuid"] != "" {
					a.notice = "VNC deeplink for VM " + params["vmUuid"]
				}
				return a, initCmd
			}
			return a, nil
		}
		if err := a.deps.Router.NavigateTo(raw); err == nil {
			a.overlay = ""
			return a, a.loadCurrentView()
		} else {
			a.errMsg = err.Error()
		}
		return a, nil
	}
	var cmd tea.Cmd
	a.cmdInput, cmd = a.cmdInput.Update(msg)
	return a, cmd
}

// --- chat ---

func (a *App) updateChat(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		a.focusArea = FocusContent
		a.syncChatFocus()
		a.syncContentFocus()
		return a, nil
	case "pgup", "pgdown", "ctrl+u", "ctrl+d":
		var cmd tea.Cmd
		a.chatView, cmd = a.chatView.Update(msg)
		return a, cmd
	case "enter":
		prompt := strings.TrimSpace(a.chatInput.Value())
		if prompt == "" || a.chatWaiting {
			return a, nil
		}
		a.chatLog = append(a.chatLog, StyleTitle.Render("You ▸ ")+prompt)
		a.chatInput.SetValue("")
		a.chatWaiting = true
		a.refreshChatViewport()
		thread := a.chatThread
		return a, func() tea.Msg {
			ctx := context.Background()
			resp, err := a.deps.Client.SendMCPPrompt(ctx, prompt, thread)
			if err != nil {
				return chatRespMsg{err: err}
			}
			text, _ := resp["response"].(string)
			if text == "" {
				text = fmt.Sprintf("%v", resp)
			}
			tid, _ := resp["thread_id"].(string)
			return chatRespMsg{text: text, thread: tid}
		}
	}
	var cmd tea.Cmd
	a.chatInput, cmd = a.chatInput.Update(msg)
	return a, cmd
}

func (a *App) refreshChatViewport() {
	w := a.chatView.Width
	if w < 10 {
		w = 10
	}
	wrap := lipgloss.NewStyle().Width(w)
	var b strings.Builder
	if len(a.chatLog) == 0 && !a.chatWaiting {
		f := a.deps.Session.FleetSummary()
		b.WriteString(StyleMuted.Render(
			"Ask about your fleet, services,\nor how to do something.\n\n"+
				fleetSummaryLine(f)+"\n\n"+
				"Enter: send · Esc: leave chat",
		))
	}
	for i, line := range a.chatLog {
		if i > 0 {
			b.WriteString("\n")
		}
		b.WriteString(wrap.Render(line))
	}
	if a.chatWaiting {
		b.WriteString("\n" + StyleMuted.Render("thinking..."))
	}
	a.chatView.SetContent(b.String())
	a.chatView.GotoBottom()
}

// --- helpers ---

func (a *App) filterSearch(q string) {
	q = strings.ToLower(strings.TrimSpace(q))
	a.searchHits = nil
	for _, rt := range a.deps.Router.FlatRoutes() {
		if q == "" || strings.Contains(strings.ToLower(rt.Label), q) || strings.Contains(strings.ToLower(rt.Path), q) {
			a.searchHits = append(a.searchHits, rt)
		}
	}
	a.searchIdx = 0
}

func (a *App) loadCurrentView() tea.Cmd {
	lay := computeLayout(a.width, a.height, a.chatOpen)
	path := a.deps.Router.Current.Path
	a.content = NewViewForRoute(path, a.deps, lay.contentW-2, lay.bodyH-2)
	a.syncContentFocus()
	for i, rt := range a.deps.Router.TopLevelRoutes() {
		if path == rt.Path || strings.HasPrefix(path, rt.Path+"/") {
			a.sidebarIdx = i
			break
		}
	}
	if a.content != nil {
		return a.content.Init()
	}
	return nil
}

func (a *App) refreshData() tea.Cmd {
	return func() tea.Msg {
		err := a.refreshFleet(context.Background())
		return refreshDoneMsg{err: err}
	}
}

func tickEvery() tea.Cmd {
	return tea.Tick(5*time.Minute, func(t time.Time) tea.Msg { return tickMsg(t) })
}

// --- rendering ---

func (a *App) View() string {
	if a.mode == "login" {
		return a.viewLogin()
	}
	shell := a.viewShell()
	switch a.overlay {
	case "search":
		return overlayCentered(shell, a.renderSearchModal(), a.width, a.height)
	case "cmd":
		return overlayCentered(shell, a.renderCmdModal(), a.width, a.height)
	}
	return shell
}

func (a *App) viewLogin() string {
	form := lipgloss.JoinVertical(lipgloss.Left,
		StyleMuted.Render("Username"),
		a.userInput.View(),
		"",
		StyleMuted.Render("Password"),
		a.passInput.View(),
		"",
		StyleMuted.Render("Organization"),
		a.orgInput.View(),
	)
	body := StyleBrand.Render("ELECTROS") + "  " + StyleMuted.Render("Terminal Console") + "\n\n" + form + "\n\n" +
		StyleHelp.Render("Tab: next field · Enter: login · Ctrl+C: quit")
	if a.errMsg != "" {
		body += "\n" + StyleError.Render(a.errMsg)
	}
	card := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(panelBorderFocused).
		Padding(1, 3).
		Render(body)
	if a.width > 0 && a.height > 0 {
		return lipgloss.Place(a.width, a.height, lipgloss.Center, lipgloss.Center, card)
	}
	return card
}

func (a *App) viewShell() string {
	lay := computeLayout(a.width, a.height, a.chatOpen)

	header := a.renderHeader(lay)
	sidebar := renderPanel("Navigation", a.renderSidebarBody(lay), lay.sidebarW, lay.bodyH, a.focusArea == FocusSidebar)

	contentTitle := a.contentTitle()
	body := ""
	if a.content != nil {
		body = a.content.View()
	}
	content := renderPanel(contentTitle, body, lay.contentW, lay.bodyH, a.focusArea == FocusContent)

	panels := []string{sidebar, content}
	if lay.chatW > 0 {
		panels = append(panels, renderPanel("Electra AI", a.renderChatBody(lay), lay.chatW, lay.bodyH, a.focusArea == FocusChat))
	}
	main := lipgloss.JoinHorizontal(lipgloss.Top, panels...)

	status := a.renderStatusBar(lay)
	return lipgloss.JoinVertical(lipgloss.Left, header, main, status)
}

func (a *App) contentTitle() string {
	if t, ok := a.content.(titled); ok {
		if title := t.Title(); title != "" {
			return title
		}
	}
	if a.deps.Router.Current != nil {
		return a.deps.Router.Current.Label
	}
	return "Content"
}

func (a *App) renderHeader(lay layout) string {
	brand := StyleBrand.Render("ELECTROS")

	crumb := a.renderBreadcrumb()
	if crumb == "" {
		f := a.deps.Session.FleetSummary()
		crumb = StyleStat.Render(fleetSummaryLine(f))
	}

	dot := StyleDotBad.Render("●")
	if a.connOK {
		dot = StyleDotOK.Render("●")
	}
	user := StyleUser.Render(a.deps.Session.UserInfo()+" ") + dot + StyleUser.Render(" ")

	return barSegments(brand, crumb, user, lay.width, StyleHeaderBar)
}

func (a *App) renderBreadcrumb() string {
	if a.deps.Router.Current == nil {
		return ""
	}
	path := a.deps.Router.Current.Path
	segs := strings.Split(path, "/")
	parts := make([]string, 0, len(segs))
	prefix := ""
	for _, seg := range segs {
		if prefix == "" {
			prefix = seg
		} else {
			prefix = prefix + "/" + seg
		}
		label := seg
		if rt := a.deps.Router.ByPath[prefix]; rt != nil && rt.Label != "" {
			label = rt.Label
		}
		parts = append(parts, StyleCrumb.Render(label))
	}
	sep := StyleCrumbSep.Render(" › ")
	route := strings.Join(parts, sep)

	// Append compact fleet stats after the route breadcrumb.
	f := a.deps.Session.FleetSummary()
	stats := StyleStatLabel.Render("  ") + StyleStat.Render(fleetSummaryLine(f))
	return route + stats
}

func (a *App) renderSidebarBody(lay layout) string {
	innerW := lay.sidebarW - 2
	currentPath := ""
	if a.deps.Router.Current != nil {
		currentPath = a.deps.Router.Current.Path
	}
	f := a.deps.Session.FleetSummary()

	var b strings.Builder
	b.WriteString(StyleStatLabel.Render("Fleet") + "\n")
	b.WriteString(StyleMuted.Render(truncateSidebar(fleetSummaryLine(f), innerW)) + "\n\n")

	for i, rt := range a.deps.Router.TopLevelRoutes() {
		label := rt.Label
		if count := a.sidebarCount(rt, f); count != "" {
			label += " " + StyleStat.Render(count)
		}
		if rt.Experimental || rt.Beta {
			label += StyleDim.Render(" ◦")
		}
		open := currentPath == rt.Path || strings.HasPrefix(currentPath, rt.Path+"/")
		marker := "  "
		if open {
			marker = "• "
		}
		line := marker + label
		line = padSidebarLine(line, innerW)
		if i == a.sidebarIdx {
			b.WriteString(StyleSidebarActive.Render(line))
		} else if open {
			b.WriteString(StyleSidebarOpen.Render(line))
		} else {
			b.WriteString(StyleSidebarItem.Render(line))
		}
		b.WriteString("\n")
	}
	return b.String()
}

func (a *App) sidebarCount(rt *nav.Route, f session.FleetSummary) string {
	switch rt.Name {
	case "dashboard":
		return ""
	case "my-clouds":
		if f.Targets > 0 {
			return fmt.Sprintf("(%d)", f.Targets)
		}
	case "iaas":
		n := f.VMs + f.Volumes + f.Networks
		if n > 0 {
			return fmt.Sprintf("(%d)", n)
		}
	case "paas":
		if f.PaaSInstances > 0 {
			return fmt.Sprintf("(%d)", f.PaaSInstances)
		}
	case "saas":
		if f.SaaSInstances > 0 {
			return fmt.Sprintf("(%d)", f.SaaSInstances)
		}
	}
	return ""
}

func truncateSidebar(s string, w int) string {
	if lipgloss.Width(s) <= w {
		return s
	}
	for len(s) > 0 && lipgloss.Width(s) > w-1 {
		s = s[:len(s)-1]
	}
	return s + "…"
}

func padSidebarLine(line string, innerW int) string {
	if lipgloss.Width(line) > innerW {
		// Strip ANSI for truncation is hard; use plain truncation on visible part
		return line[:min(len(line), innerW)]
	}
	return line + strings.Repeat(" ", max(innerW-lipgloss.Width(line), 0))
}

func (a *App) renderChatBody(lay layout) string {
	// The viewport always renders exactly its height, so the divider and
	// input stay pinned to the bottom of the panel.
	divider := StyleDim.Render(strings.Repeat("─", max(lay.chatW-2, 1)))
	return a.chatView.View() + "\n" + divider + "\n" + a.chatInput.View()
}

func (a *App) renderStatusBar(lay layout) string {
	chip := StyleChip.Render(a.modeChip())

	msg := ""
	if a.notice != "" {
		msg = StyleStatusOK.Render(a.notice)
	} else if a.errMsg != "" {
		msg = StyleStatusErr.Render(a.errMsg)
	} else {
		f := a.deps.Session.FleetSummary()
		msg = StyleStatLabel.Render(fleetSummaryLong(f, a.deps.Session.LastRefreshAgo()))
	}

	hints := a.statusHints()
	if lay.chatCollapsed {
		hints = "chat hidden: widen terminal · " + hints
	}
	right := StyleStatusHint.Render(" " + hints + " ")

	return barSegments(chip, msg, right, lay.width, StyleStatusBar)
}

func (a *App) modeChip() string {
	switch a.focusArea {
	case FocusSidebar:
		return "NAV"
	case FocusChat:
		return "CHAT"
	}
	switch a.content.(type) {
	case *formView:
		return "FORM"
	case *listView:
		return "LIST"
	case *dashboardView:
		return "DASH"
	default:
		return "VIEW"
	}
}

func (a *App) statusHints() string {
	switch a.focusArea {
	case FocusSidebar:
		return "j/k move · Enter open · Tab focus · q quit"
	case FocusChat:
		return "Enter send · PgUp/PgDn scroll · Esc leave"
	}
	if h, ok := a.content.(hinted); ok {
		if hint := h.Hints(); hint != "" {
			return hint
		}
	}
	return "Tab focus · click · / search · : goto · c chat · ? help"
}

func (a *App) renderSearchModal() string {
	w := min(70, a.width-8)
	var b strings.Builder
	b.WriteString(a.searchInput.View() + "\n\n")
	shown := 0
	for i, rt := range a.searchHits {
		if shown >= 10 {
			b.WriteString(StyleMuted.Render(fmt.Sprintf("  … %d more", len(a.searchHits)-shown)))
			break
		}
		line := "  " + rt.Label + StyleMuted.Render("  "+rt.Path)
		if i == a.searchIdx {
			line = StyleTitle.Render("▸ "+rt.Label) + StyleMuted.Render("  "+rt.Path)
		}
		b.WriteString(line + "\n")
		shown++
	}
	if len(a.searchHits) == 0 {
		b.WriteString(StyleMuted.Render("  no matches"))
	}
	body := b.String() + "\n" + StyleHelp.Render("↑/↓ select · Enter open · Esc close")
	return renderModalBox("Search", body, w)
}

func (a *App) renderCmdModal() string {
	w := min(70, a.width-8)
	body := a.cmdInput.View() + "\n\n" + StyleHelp.Render("Enter a route path (e.g. paas/dbaas) or electros:// deeplink · Esc close")
	return renderModalBox("Go to", body, w)
}

func renderModalBox(title, body string, w int) string {
	inner := lipgloss.NewStyle().Width(w - 4).Render(body)
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(panelBorderFocused).
		Padding(0, 1).
		Render(inner)
	// Replace the plain top border with a titled one.
	lines := strings.Split(box, "\n")
	if len(lines) > 0 {
		bw := lipgloss.Width(lines[0])
		lines[0] = renderPanelTop(title, bw, lipgloss.NewStyle().Foreground(panelBorderFocused), StylePanelTitle)
	}
	return strings.Join(lines, "\n")
}

// RenderPreviewFrame renders one static frame for layout debugging.
func RenderPreviewFrame(deps *Deps, w, h int, chatOpen bool, mode string) string {
	a := NewApp(deps)
	a.width = w
	a.height = h
	a.chatOpen = chatOpen
	if mode == "login" {
		return a.viewLogin()
	}
	a.mode = "shell"
	a.resizePanels()
	a.loadCurrentView()
	switch mode {
	case "search":
		a.overlay = "search"
		a.filterSearch("")
	case "cmd":
		a.overlay = "cmd"
	}
	return a.View()
}

// OpenVNCForVM opens VNC for a VM UUID (strict 1:1).
func (a *App) OpenVNCForVM(vmUUID string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		_, vms, _, _, _ := a.deps.Session.Snapshot()
		var hostIP string
		for _, vm := range vms {
			if vm.UniqueID == vmUUID {
				hostIP = vm.ServerURL
				break
			}
		}
		tunnel, err := a.deps.Client.StartVNCTunnel(ctx, map[string]any{
			"vmUuid":     vmUUID,
			"serverHost": hostIP,
		})
		if err != nil {
			return actionDoneMsg{err: err}
		}
		if tunnel.Synthetic {
			return actionDoneMsg{notice: "Synthetic daemons: VNC placeholder only. Use real compute daemons for live console."}
		}
		if err := host.LaunchVNCViewer(tunnel.Port, tunnel.Token); err != nil {
			return actionDoneMsg{err: err}
		}
		return actionDoneMsg{notice: fmt.Sprintf("VNC launched on localhost:%d", tunnel.Port)}
	}
}
