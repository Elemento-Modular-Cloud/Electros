package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/api"
	"electros-tui/internal/config"
	"electros-tui/internal/nav"
	"electros-tui/internal/services"
	"electros-tui/internal/session"
	"electros-tui/internal/ui"
)

func main() {
	ecdDir := flag.String("ecd-dir", config.DefaultECDDir(), "Path to ECD directory (networking.json, restkeys.json)")
	host := flag.String("host", "127.0.0.1", "Client daemon host")
	pathPrefix := flag.String("path-prefix", "", "Reverse-proxy prefix (disables localhost mode)")
	atomos := flag.Bool("atomos", false, "Enable AtomOS local login flow")
	deeplink := flag.String("deeplink", "", "Open route on start (electros://...)")
	noColor := flag.Bool("no-color", false, "Disable color output")
	skipHealth := flag.Bool("skip-health", false, "Skip daemon health checks on startup")
	flag.Parse()

	opts := config.Options{
		ECDDir:       *ecdDir,
		Host:         *host,
		PathPrefix:   *pathPrefix,
		AtomOS:       *atomos,
		Deeplink:     *deeplink,
		NoColor:      *noColor,
		UseLocalhost: *pathPrefix == "",
	}

	ecd, err := config.Load(opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}

	if !*skipHealth {
		client := api.NewClient(ecd)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		health := client.AllDaemonsHealthy(ctx)
		var missing []string
		for name, ok := range health {
			if !ok {
				missing = append(missing, name)
			}
		}
		if len(missing) > 0 {
			fmt.Fprintf(os.Stderr, "Warning: daemons not reachable: %s\n", strings.Join(missing, ", "))
			fmt.Fprintf(os.Stderr, "Start synthetic-daemons or client daemons, or use --skip-health\n")
		}
	}

	pagesPath := config.DefaultPagesPath(*ecdDir)
	router, err := nav.LoadRouter(pagesPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "navigation: %v\n", err)
		os.Exit(1)
	}

	intentsPath := services.DefaultIntentsPath(*ecdDir)
	serviceRegistry, err := services.LoadRegistry(intentsPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "services: %v (PaaS/SaaS menus unavailable)\n", err)
	} else {
		nav.InjectServiceRoutes(router, serviceRegistry)
	}

	if *deeplink != "" {
		path, _, _, err := nav.ParseDeeplink(*deeplink)
		if err == nil && path != "" {
			_ = router.NavigateTo(path)
		}
	}

	client := api.NewClient(ecd)
	store := session.NewStore(client)

	formOpts, err := ui.LoadFormOptions(*ecdDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "form options: %v (using defaults)\n", err)
		formOpts = ui.DefaultFormOptions()
	}

	ui.SetNoColor(*noColor)
	app := ui.NewApp(&ui.Deps{
		Session:  store,
		Router:   router,
		Client:   client,
		Services: serviceRegistry,
		FormOpts: formOpts,
		AtomOS:   *atomos,
		Deeplink: *deeplink,
	})

	p := tea.NewProgram(app, tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
