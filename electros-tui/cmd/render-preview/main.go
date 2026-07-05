// Command render-preview dumps a static shell frame for layout inspection.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"electros-tui/internal/api"
	"electros-tui/internal/config"
	"electros-tui/internal/nav"
	"electros-tui/internal/services"
	"electros-tui/internal/session"
	"electros-tui/internal/ui"
)

func main() {
	ecdDir := filepath.Join("..", "elemento-gui-new", "electros", "ecd")
	ecd, err := config.Load(config.Options{ECDDir: ecdDir, UseLocalhost: true, Host: "127.0.0.1"})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	router, _ := nav.LoadRouter(config.DefaultPagesPath(ecdDir))
	if reg, err := services.LoadRegistry(services.DefaultIntentsPath(ecdDir)); err == nil {
		nav.InjectServiceRoutes(router, reg)
	}
	client := api.NewClient(ecd)
	store := session.NewStore(client)

	ui.SetNoColor(true)
	w, h, chat := 120, 36, true
	mode := "shell"
	if len(os.Args) > 3 {
		fmt.Sscanf(os.Args[1], "%d", &w)
		fmt.Sscanf(os.Args[2], "%d", &h)
		chat = os.Args[3] == "chat"
	}
	if len(os.Args) > 4 {
		mode = os.Args[4]
	}
	fmt.Println(ui.RenderPreviewFrame(&ui.Deps{Session: store, Router: router, Client: client}, w, h, chat, mode))
}
