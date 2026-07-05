package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"electros-tui/internal/services"
)

func fld(key, label, placeholder, def string) fieldDef {
	return fieldDef{Key: key, Label: label, Placeholder: placeholder, Default: def}
}

func fldSelect(key, label, def string, opts []SelectOption) fieldDef {
	return fieldDef{Key: key, Label: label, Default: def, Options: opts}
}

func fldBool(key, label string, def bool) fieldDef {
	d := "false"
	if def {
		d = "true"
	}
	return fieldDef{Key: key, Label: label, Default: d, Options: []SelectOption{
		{Value: "true", Label: "Yes"},
		{Value: "false", Label: "No"},
	}}
}

func fldJSON(key, label, def string) fieldDef {
	return fieldDef{Key: key, Label: label, Placeholder: "JSON", Default: def, Multiline: true}
}

func withTargetWizard(spec formSpec, mode targetPickMode) formSpec {
	spec.wizard = formWizardTargetPick
	spec.targetPickMode = mode
	return spec
}

func myCloudsForms(path string) formSpec {
	switch {
	case strings.HasSuffix(path, "add"), strings.HasSuffix(path, "add-private"),
		strings.HasSuffix(path, "add-public"), strings.HasSuffix(path, "add-hypervisor"):
		return addTargetFormSpec()
	case strings.HasSuffix(path, "detail"):
		return formSpec{
			title: "Target",
			fields: []fieldDef{fld("target_id", "Target ID", "", "")},
			submit: pingTargetSubmit,
		}
	default:
		return formSpec{
			title:  "Target",
			fields: []fieldDef{fld("target_id", "Target ID", "", "")},
			submit: pingTargetSubmit,
		}
	}
}

func addTargetFormSpec() formSpec {
	return formSpec{
		title:  "Add Cloud Target",
		wizard: formWizardAddTarget,
		fields: []fieldDef{
			fldSelect("target_class", "What are you adding?", "hypervisor", []SelectOption{
				{Value: "hypervisor", Label: "Hypervisor (AtomOS or third-party)"},
				{Value: "cloud_provider", Label: "Cloud provider (Elemento tethered)"},
			}),
		},
		submit: func(deps *Deps, vals map[string]string) tea.Cmd {
			return submitAddTargetWizard(deps, vals)
		},
	}
}

func storageForms(path string) formSpec {
	switch {
	case strings.HasSuffix(path, "createVolume"):
		return withTargetWizard(formSpec{
			title: "Create Volume (Advanced)",
			fields: []fieldDef{
				fld("name", "Volume name", "data-vol-001", ""),
				fld("size_gb", "Size (GB)", "100", "100"),
				fldSelect("format", "Format", "qcow2", optVolumeFormat),
				fldSelect("bus", "Bus", "virtio", optVolumeBus),
				fld("priority", "Priority", "0", "0"),
				fldBool("bootable", "Bootable", false),
				fldBool("shareable", "Shareable", false),
				fldBool("readonly", "Read-only", false),
				fldBool("private", "Private", false),
			},
			submit: createVolumeSubmit,
		}, targetPickDefault)
	case strings.HasSuffix(path, "createIsoTool"):
		return withTargetWizard(formSpec{
			title: "Create ISO Tool Volume",
			fields: []fieldDef{
				fld("name", "Volume name", "iso-tool", ""),
				fld("url", "ISO URL", "https://...", ""),
				fldSelect("format", "Format", "iso", optVolumeFormat),
			},
			submit: createVolumeSubmit,
		}, targetPickDefault)
	default:
		return formSpec{title: "Volume Detail", fields: []fieldDef{fld("volumeID", "Volume ID", "", "")}}
	}
}

func cloudInitForms(path string) formSpec {
	switch {
	case strings.HasSuffix(path, "createCloudImage"):
		return withTargetWizard(formSpec{
			title: "Create Cloud Image",
			fields: []fieldDef{
				fld("name", "Image name", "ubuntu-22.04-cloud", ""),
				fld("source_url", "Source URL", "https://...", ""),
				fldSelect("format", "Format", "qcow2", optVolumeFormat),
			},
			submit: cloudInitSubmit,
		}, targetPickCloudInitHosts)
	case strings.HasSuffix(path, "create"):
		return formSpec{
			title: "Create Cloud-init Config",
			fields: []fieldDef{
				fld("name", "Config name", "cloud-init-web", ""),
				fld("userdata", "User-data (#cloud-config)", "#cloud-config\nusers:", ""),
				fld("network_config", "Network config (optional)", "", ""),
			},
			submit: cloudInitSubmit,
		}
	default:
		return formSpec{title: "Cloud-init", fields: nil}
	}
}

func networkForms(path string) formSpec {
	switch {
	case strings.HasSuffix(path, "createLibvirt"):
		return withTargetWizard(formSpec{
			title: "Create Libvirt Network (Advanced)",
			fields: []fieldDef{
				fld("network_name", "Network name", "lab-br0", ""),
				fld("libvirt_network", "Libvirt network", "br0", "br0"),
				fld("device_name", "Device name", "eth0", "eth0"),
				fldSelect("mode", "Network type", "nat", optNetworkMode),
				fld("type", "Type", "libvirt", "libvirt"),
				fld("ip", "Network IP/CIDR", "192.168.50.0/24", ""),
				fld("routes", "Routes (optional)", "", ""),
				fldBool("private", "Private", false),
			},
			submit: createNetworkSubmit,
		}, targetPickDefault)
	case strings.HasSuffix(path, "createTailscale"):
		return withTargetWizard(formSpec{
			title: "Create Tailscale Network",
			fields: []fieldDef{
				fld("network_name", "Network name", "tailscale-mesh", ""),
				fld("tailnet", "Tailnet", "example.com", ""),
				fld("headscale", "Headscale URL", "https://headscale.example.com", ""),
			},
			submit: createNetworkSubmit,
		}, targetPickDefault)
	default:
		return formSpec{title: "Network", fields: nil}
	}
}

func advancedVMFields() []fieldDef {
	return []fieldDef{
		fld("vm_name", "VM name", "ubuntu-vm-new", ""),
		fld("slots", "CPU slots (power of 2)", "2", "2"),
		fld("ramsize_gb", "RAM (GB)", "4", "4"),
		fldSelect("os_family", "OS family", "linux", nil),
		fldSelect("os_flavour", "OS flavour", "ubuntu", nil),
		fldSelect("architecture", "Architecture", "X86_64", optArch),
		fldSelect("firmware", "Firmware", "bios", optFirmware),
		fld("overprovision", "CPU overprovision %", "10", "10"),
		fld("min_cpu_freq", "Minimum CPU frequency (GHz)", "0", "0"),
		fldBool("autostart", "Autostart", false),
		fldBool("allow_smt", "Allow SMT", true),
		fldBool("require_ecc", "Require ECC RAM", false),
		fld("auth_username", "Cloud auth username", "", ""),
		fld("auth_password", "Cloud auth password", "", ""),
		fld("auth_ssh_key", "Cloud auth SSH public key", "", ""),
		fldPicker("volumes_json", "Volumes", PickerVolumes, "[]"),
		fldPicker("networks_json", "Networks", PickerNetworks, "[]"),
		fldPicker("pcidev_json", "PCI devices", PickerPCI, "[]"),
	}
}

func vmForms(path string) formSpec {
	switch {
	case strings.HasSuffix(path, "createTemplate"):
		return withTargetWizard(formSpec{
			title: "Create VM from Template (Advanced)",
			fields: []fieldDef{
				fld("template_id", "Template UUID", "", ""),
				fld("vm_name", "VM name", "from-template-001", ""),
				fldSelect("os_family", "OS family override", "linux", nil),
				fldSelect("os_flavour", "OS flavour override", "ubuntu", nil),
				fld("slots", "CPU slots", "2", "2"),
				fld("ramsize_gb", "RAM (GB)", "4", "4"),
				fldPicker("volumes_json", "Volumes", PickerVolumes, "[]"),
			},
			submit: registerVMSubmit,
		}, targetPickDefault)
	case strings.HasSuffix(path, "createXml"):
		return withTargetWizard(formSpec{
			title: "Create VM from XML",
			fields: []fieldDef{
				fld("xml", "Libvirt XML", "<domain>...</domain>", ""),
			},
			submit: registerVMSubmit,
		}, targetPickDefault)
	case strings.HasSuffix(path, "createAdvanced"):
		return withTargetWizard(formSpec{title: "Create VM (Advanced)", fields: advancedVMFields(), submit: registerVMSubmit}, targetPickDefault)
	case strings.HasSuffix(path, "create"):
		return withTargetWizard(formSpec{title: "Create VM (Advanced)", fields: advancedVMFields(), submit: registerVMSubmit}, targetPickDefault)
	default:
		return formSpec{
			title: "VM Detail",
			fields: []fieldDef{fld("uuid", "VM UUID", "", "")},
			submit: vmDetailSubmit,
		}
	}
}

func ephemeralForms(path string) formSpec {
	if strings.HasSuffix(path, "create") {
		return formSpec{
			title:  "Create Ephemeral VM",
			wizard: formWizardEphemeralCreate,
			fields: []fieldDef{
				fld("vm_name", "VM name", "ephemeral-ubuntu-001", ""),
				fldSelect("os_family", "OS family", "linux", nil),
				fldSelect("os_flavour", "OS flavour", "ubuntu", nil),
			},
			targetPickMode: targetPickCloudOnly,
			submit:         registerVMSubmit,
		}
	}
	return formSpec{title: "Ephemeral VM", fields: nil}
}

func serviceCreateSpec(def *services.ServiceDef) formSpec {
	fields := make([]fieldDef, 0, len(def.CreateFields))
	for _, f := range def.CreateFields {
		fields = append(fields, fieldDef{
			Key:         f.Key,
			Label:       f.Label,
			Placeholder: f.Placeholder,
			Default:     f.Default,
			Multiline:   f.Multiline,
			Options:     toSelectOptions(f.Options),
		})
	}
	if len(fields) == 0 {
		fields = []fieldDef{
			fld("name", "Name", "my-"+def.APIServiceType, ""),
		}
	}
	return formSpec{
		title:          "Create " + def.Label + " (Advanced)",
		fields:         fields,
		wizard:         formWizardTargetPick,
		targetPickMode: targetPickService,
		requireService: def.APIServiceType,
		submit:         serviceCreateSubmit(def),
	}
}

func toSelectOptions(opts []services.FieldOption) []SelectOption {
	if len(opts) == 0 {
		return nil
	}
	out := make([]SelectOption, len(opts))
	for i, o := range opts {
		out[i] = SelectOption{Value: o.Value, Label: o.Label}
	}
	return out
}

func createTargetSubmit(targetType string) func(*Deps, map[string]string) tea.Cmd {
	return func(deps *Deps, vals map[string]string) tea.Cmd {
		return func() tea.Msg {
			ctx := context.Background()
			targetID := vals["name"]
			if targetID == "" {
				return formDoneMsg{err: fmt.Errorf("target name is required")}
			}
			cfg := map[string]any{
				"provider": vals["provider"],
			}
			if vals["serverurl"] != "" {
				cfg["ips"] = []string{vals["serverurl"]}
				cfg["serverurl"] = vals["serverurl"]
			}
			if vals["username"] != "" {
				cfg["username"] = vals["username"]
			}
			if vals["password"] != "" {
				cfg["password"] = vals["password"]
			}
			if vals["api_key"] != "" {
				cfg["api_key"] = vals["api_key"]
			}
			if vals["region"] != "" {
				cfg["region"] = vals["region"]
			}
			if vals["type"] != "" {
				cfg["hypervisor_type"] = vals["type"]
			}
			tt := targetType
			if vals["type"] != "" {
				tt = vals["type"]
			}
			if tt == "" {
				return formDoneMsg{err: fmt.Errorf("target type is required")}
			}
			body := map[string]any{
				"target_id":     targetID,
				"target_type":   tt,
				"target_config": cfg,
			}
			_, err := deps.Client.CreateTarget(ctx, body)
			if err != nil {
				return formDoneMsg{err: deps.Session.HandleAPIError(err)}
			}
			return formDoneMsg{notice: "Target created"}
		}
	}
}

func pingTargetSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		id := vals["target_id"]
		if id == "" {
			return formDoneMsg{err: fmt.Errorf("target_id is required")}
		}
		_, err := deps.Client.PingTarget(ctx, id)
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "Target ping OK"}
	}
}

func createVolumeSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		body := map[string]any{"name": vals["name"], "format": vals["format"]}
		if vals["size_gb"] != "" {
			if gb, err := strconv.Atoi(vals["size_gb"]); err == nil {
				body["size"] = int64(gb) * 1024 * 1024 * 1024
			}
		}
		if vals["bus"] != "" {
			body["bus"] = vals["bus"]
		}
		if vals["ip"] != "" {
			body["ip"] = vals["ip"]
		}
		if vals["url"] != "" {
			body["url"] = vals["url"]
		}
		if p := parseIntDefault(vals["priority"], 0); p != 0 {
			body["priority"] = p
		}
		if b, ok := parseBool(vals["bootable"]); ok {
			body["bootable"] = b
		}
		if b, ok := parseBool(vals["shareable"]); ok {
			body["shareable"] = b
		}
		if b, ok := parseBool(vals["readonly"]); ok {
			body["readonly"] = b
		}
		if b, ok := parseBool(vals["private"]); ok {
			body["private"] = b
		}
		_, err := deps.Client.CreateVolume(ctx, body)
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "Volume created"}
	}
}

func cloudInitSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		body := map[string]any{}
		for k, v := range vals {
			if v == "" || k == "connect_mode" {
				continue
			}
			switch k {
			case "source_url":
				body["url"] = v
			default:
				body[k] = v
			}
		}
		_, err := deps.Client.CreateCloudInitVolume(ctx, body)
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "Cloud-init resource created"}
	}
}

func createNetworkSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		body := map[string]any{}
		if v := vals["network_name"]; v != "" {
			body["network_name"] = v
			body["name"] = v
		}
		for _, key := range []string{"mode", "type", "device_name", "libvirt_network", "ip", "routes", "tailnet"} {
			if vals[key] != "" {
				body[key] = vals[key]
			}
		}
		if vals["servers"] != "" {
			parts := strings.Split(vals["servers"], ",")
			servers := make([]string, 0, len(parts))
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					servers = append(servers, p)
				}
			}
			body["servers"] = servers
		}
		if b, ok := parseBool(vals["private"]); ok {
			body["private"] = b
		}
		if vals["headscale"] != "" {
			body["headscale"] = vals["headscale"]
		}
		_, err := deps.Client.CreateNetwork(ctx, body)
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "Network created"}
	}
}

func registerVMSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		body, err := buildRegisterVMBody(vals)
		if err != nil {
			return formDoneMsg{err: err}
		}
		_, err = deps.Client.RegisterVM(ctx, body)
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "VM registered"}
	}
}

func buildRegisterVMBody(vals map[string]string) (map[string]any, error) {
	body := map[string]any{}
	setStr := func(key string) {
		if v := vals[key]; v != "" {
			body[key] = v
		}
	}
	setStr("vm_name")
	setStr("serverurl")
	setStr("target_type")
	setStr("os_family")
	setStr("os_flavour")
	setStr("provider")
	setStr("deployment_region")
	setStr("instance_flavour_catalog")
	setStr("instance_flavour")
	setStr("xml")

	if v := vals["ramsize_gb"]; v != "" {
		if gb, err := strconv.Atoi(v); err == nil {
			body["ramsize"] = gb
		}
	}
	if v := vals["block_storage_gb"]; v != "" {
		if gb, err := strconv.Atoi(v); err == nil {
			body["block_storage_gb"] = gb
		}
	}
	if v := vals["slots"]; v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			body["slots"] = n
		}
	}
	if v := vals["overprovision"]; v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			body["overprovision"] = n
		}
	}
	if v := vals["min_cpu_freq"]; v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			body["minimumCpuFrequency"] = f
		}
	}
	if v := vals["architecture"]; v != "" {
		body["arch"] = strings.ToLower(v)
	}
	if v := vals["firmware"]; v != "" {
		body["firmware"] = strings.ToLower(v)
	}
	if b, ok := parseBool(vals["autostart"]); ok {
		body["autostart"] = b
	}
	if b, ok := parseBool(vals["allow_smt"]); ok {
		body["allowSMT"] = b
	}
	if b, ok := parseBool(vals["require_ecc"]); ok {
		body["reqECC"] = b
	}

	if u := vals["auth_username"]; u != "" || vals["auth_password"] != "" || vals["auth_ssh_key"] != "" {
		body["userAuth"] = map[string]any{
			"username": vals["auth_username"],
			"password": vals["auth_password"],
			"sshKey":   vals["auth_ssh_key"],
		}
	}

	if err := mergeJSONField(body, "volumes", vals["volumes_json"]); err != nil {
		return nil, err
	}
	if err := mergeJSONField(body, "networks", vals["networks_json"]); err != nil {
		return nil, err
	}
	if err := mergeJSONField(body, "pcidevs", vals["pcidev_json"]); err != nil {
		return nil, err
	}
	if err := mergeJSONField(body, "network_config", vals["network_config_json"]); err != nil {
		return nil, err
	}
	if vals["template_id"] != "" {
		body["template_id"] = vals["template_id"]
	}
	return body, nil
}

func vmDetailSubmit(deps *Deps, vals map[string]string) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		if vals["uuid"] == "" {
			return formDoneMsg{err: fmt.Errorf("uuid is required")}
		}
		err := deps.Client.RebootVM(ctx, vals["uuid"])
		if err != nil {
			return formDoneMsg{err: deps.Session.HandleAPIError(err)}
		}
		return formDoneMsg{notice: "VM reboot requested"}
	}
}

func serviceCreateSubmit(def *services.ServiceDef) func(*Deps, map[string]string) tea.Cmd {
	return func(deps *Deps, vals map[string]string) tea.Cmd {
		return func() tea.Msg {
			ctx := context.Background()
			body := map[string]any{}
			for k, v := range vals {
				v = strings.TrimSpace(v)
				if v == "" {
					continue
				}
				if strings.Contains(k, "/") || strings.HasSuffix(k, "_json") {
					var parsed any
					if err := json.Unmarshal([]byte(v), &parsed); err == nil {
						body[strings.TrimSuffix(k, "_json")] = parsed
						continue
					}
				}
				body[k] = coerceServiceValue(v)
			}
			if body["name"] == nil {
				body["name"] = "tui-" + def.APIServiceType
			}
			_, err := deps.Client.CreateService(ctx, def.APIServiceType, body)
			if err != nil {
				return formDoneMsg{err: deps.Session.HandleAPIError(err)}
			}
			return formDoneMsg{notice: def.Label + " created"}
		}
	}
}

func mergeJSONField(body map[string]any, key, raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var parsed any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return fmt.Errorf("%s: invalid JSON: %w", key, err)
	}
	body[key] = parsed
	return nil
}

func parseBool(s string) (bool, bool) {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return false, false
	}
	switch s {
	case "1", "true", "yes", "y", "on":
		return true, true
	case "0", "false", "no", "n", "off":
		return false, true
	default:
		return false, false
	}
}

func parseIntDefault(s string, def int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return n
	}
	return def
}

func coerceServiceValue(v string) any {
	if b, ok := parseBool(v); ok {
		return b
	}
	if i, err := strconv.Atoi(v); err == nil {
		return i
	}
	if f, err := strconv.ParseFloat(v, 64); err == nil {
		return f
	}
	return v
}
