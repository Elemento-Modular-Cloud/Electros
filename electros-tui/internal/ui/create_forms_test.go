package ui

import "testing"

func TestBuildRegisterVMBodyAdvanced(t *testing.T) {
	body, err := buildRegisterVMBody(map[string]string{
		"vm_name":    "test-vm",
		"slots":      "4",
		"ramsize_gb": "8",
		"os_family":  "linux",
		"os_flavour": "ubuntu",
		"allow_smt":  "true",
		"require_ecc": "false",
		"volumes_json": `[{"vid":"vol-1","priority":0}]`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if body["vm_name"] != "test-vm" {
		t.Fatalf("vm_name = %v", body["vm_name"])
	}
	if body["slots"] != 4 {
		t.Fatalf("slots = %v", body["slots"])
	}
	if body["ramsize"] != 8 {
		t.Fatalf("ramsize = %v", body["ramsize"])
	}
	if body["allowSMT"] != true {
		t.Fatalf("allowSMT = %v", body["allowSMT"])
	}
	if _, ok := body["volumes"]; !ok {
		t.Fatal("expected volumes parsed from JSON")
	}
}
