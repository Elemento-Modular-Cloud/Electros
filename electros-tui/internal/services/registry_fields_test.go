package services

import (
	"path/filepath"
	"testing"
)

func TestParseCreateFieldsSelectAndBool(t *testing.T) {
	intentsPath := filepath.Join("..", "..", "..", "elemento-gui-new", "electros", "ecd", "supported_intents.json")
	reg, err := LoadRegistry(intentsPath)
	if err != nil {
		t.Fatalf("LoadRegistry: %v", err)
	}
	def := reg.ByPath["paas/managedkubernetes/create"]
	if def == nil {
		t.Fatal("missing managedkubernetes create route")
	}
	var updatePolicy, billing, dhcp *CreateField
	for i := range def.CreateFields {
		switch def.CreateFields[i].Key {
		case "update_policy":
			updatePolicy = &def.CreateFields[i]
		case "billing_frequency":
			billing = &def.CreateFields[i]
		case "nodes_subnet/dhcp":
			dhcp = &def.CreateFields[i]
		}
	}
	if updatePolicy == nil || len(updatePolicy.Options) < 2 {
		t.Fatal("expected select options for update_policy")
	}
	if billing == nil || billing.Default != "month" {
		t.Fatalf("billing default = %q", billing.Default)
	}
	if dhcp == nil || len(dhcp.Options) != 2 {
		t.Fatal("expected yes/no options for boolean dhcp field")
	}
}
