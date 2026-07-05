package host

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// OpenURL opens a URL in the system default browser.
func OpenURL(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

// HasDisplay reports whether a graphical display is likely available.
func HasDisplay() bool {
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		return true
	}
	return os.Getenv("DISPLAY") != "" || os.Getenv("WAYLAND_DISPLAY") != ""
}

// LaunchVNCViewer starts a VNC client for localhost:port.
func LaunchVNCViewer(port int, token string) error {
	if !HasDisplay() {
		return fmt.Errorf("no DISPLAY set — forward port %d over SSH and run: vncviewer localhost:%d (token: %s)", port, port, token)
	}
	viewers := []string{"vncviewer", "xtigervncviewer", "vinagre"}
	for _, bin := range viewers {
		if path, err := exec.LookPath(bin); err == nil {
			args := []string{fmt.Sprintf("localhost:%d", port)}
			if token != "" && bin == "vncviewer" {
				args = append(args, "-PasswordFile", "/dev/stdin")
			}
			cmd := exec.Command(path, args...)
			return cmd.Start()
		}
	}
	return fmt.Errorf("no VNC viewer found (install tigervnc-viewer or vinagre); connect to localhost:%d token=%s", port, token)
}

// LaunchRDP starts FreeRDP to localhost:port.
func LaunchRDP(port int, username, password string) error {
	if !HasDisplay() {
		return fmt.Errorf("no DISPLAY set — forward port %d and run: xfreerdp /v:localhost:%d /u:%s", port, port, username)
	}
	bin, err := exec.LookPath("xfreerdp")
	if err != nil {
		return fmt.Errorf("xfreerdp not found — connect manually to localhost:%d", port)
	}
	args := []string{
		fmt.Sprintf("/v:localhost:%d", port),
		"/cert:ignore",
	}
	if username != "" {
		args = append(args, "/u:"+username)
	}
	if password != "" {
		args = append(args, "/p:"+password)
	}
	return exec.Command(bin, args...).Start()
}

// RunSSH suspends the TUI caller, runs ssh, and returns when done.
func RunSSH(host, username, password string) error {
	bin, err := exec.LookPath("ssh")
	if err != nil {
		return fmt.Errorf("ssh not found in PATH")
	}
	target := host
	if username != "" {
		target = username + "@" + host
	}
	cmd := exec.Command(bin, target)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ReadLegacyHosts reads ~/.elemento/hosts JSON (Electron read-hosts equivalent).
func ReadLegacyHosts() (map[string]any, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := home + "/.elemento/hosts"
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{}, nil
		}
		return nil, err
	}
	out := make(map[string]any)
	// hosts file may be plain text or JSON depending on install
	if strings.HasPrefix(strings.TrimSpace(string(data)), "{") {
		err = json.Unmarshal(data, &out)
		return out, err
	}
	lines := strings.Split(string(data), "\n")
	hosts := make([]string, 0)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			hosts = append(hosts, line)
		}
	}
	out["hosts"] = hosts
	return out, nil
}
