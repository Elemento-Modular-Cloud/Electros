/**
 * Regenerates IaaS fixtures: vms, volumes, networks, portforwards, templates, host-status.
 *
 * Usage: node scripts/generate-iaas-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "default");
const COUNT = 18;

/** Must match `targets.json` atomos_local_ip / hypervisor host IPs for VM list hypervisor chips. */
const ATOMOS_HOSTS = [
  { ip: "192.168.1.10", serverurl: "https://192.168.1.10" },
  { ip: "10.0.0.5", serverurl: "https://10.0.0.5" },
];
const PROXMOX_HOST = {
  ip: "192.168.1.20",
  serverurl: "https://192.168.1.20:8006",
  target_type: "hypervisor_proxmox",
};
const ESXI_HOST = {
  ip: "192.168.1.30",
  serverurl: "https://192.168.1.30",
  target_type: "hypervisor_esxi",
};
const SERVERS = [
  ATOMOS_HOSTS[0].ip,
  ATOMOS_HOSTS[1].ip,
  PROXMOX_HOST.ip,
  ESXI_HOST.ip,
];
const VM_STATES = ["running", "running", "running", "shut off", "paused", "shut off"];
const OS_FAMILIES = ["linux", "linux", "linux", "windows"];
const LINUX_FLAVOURS = ["ubuntu", "debian", "rocky", "fedora", "alpine", "centos"];
const WINDOWS_FLAVOURS = ["windows", "windows-server"];
const FIRMWARE = ["bios", "uefi"];
const GPU_MODELS = [
  { vendor: "NVIDIA", model: "A100" },
  { vendor: "NVIDIA", model: "L4" },
  { vendor: "NVIDIA", model: "T4" },
  { vendor: "AMD", model: "MI300" },
];
const VOLUME_FORMATS = ["qcow2", "qcow2", "raw", "vmdk"];
const VOLUME_BUSES = ["virtio", "virtio", "scsi", "ide"];
const PROTOCOLS = ["tcp", "tcp", "udp"];
const TARGET_PORTS = [22, 80, 443, 3306, 5432, 6379, 8080, 9000];

function pad3(n) {
  return String(n).padStart(3, "0");
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function vmUuid(i) {
  const hex = (i + 1).toString(16).padStart(12, "0");
  return `a0000000-0000-4000-8000-${hex}`;
}

/** Resolve host so VmModel / VolumeModel host tagchips match My Clouds targets. */
function resolveIaasHost(i) {
  if (i % 15 === 9) {
    return PROXMOX_HOST;
  }
  if (i % 15 === 14) {
    return ESXI_HOST;
  }
  const atomos = pick(ATOMOS_HOSTS, i);
  return { ...atomos, target_type: "atomos_local_ip" };
}

/** @type {Record<string, unknown>[]} */
const vms = [];
/** @type {Record<string, unknown>[]} */
const volumes = [];
/** @type {Record<string, unknown>[]} */
const networks = [];
/** @type {Record<string, unknown>[]} */
const portforwards = [];
/** @type {Record<string, unknown>[]} */
const templates = [];

for (let i = 0; i < COUNT; i++) {
  const n = pad3(i + 1);
  const id = vmUuid(i);
  const host = resolveIaasHost(i);
  const osFamily = pick(OS_FAMILIES, i);
  const osFlavour =
    osFamily === "windows" ? pick(WINDOWS_FLAVOURS, i) : pick(LINUX_FLAVOURS, i);
  const slots = [1, 2, 4, 8, 16][i % 5];
  const ramsize = [2, 4, 8, 16, 32, 64][i % 6];
  const hasGpu = i % 7 === 0;
  const vmName = `${osFlavour}-vm-${n}`;

  vms.push({
    uniqueID: id,
    serverurl: host.serverurl,
    target_type: host.target_type,
    _hostIp: host.ip,
    req_json: {
      vm_name: vmName,
      allowSMT: i % 3 === 0,
      arch: i % 20 === 0 ? "aarch64" : "x86_64",
      creation_date: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      flags: [],
      netdevs: [],
      os_family: osFamily,
      os_flavour: osFlavour,
      firmware: pick(FIRMWARE, i),
      overprovision: (i % 3) + 1,
      qemu_agent: i % 4 !== 0,
      ramsize,
      reqECC: i % 15 === 0,
      slots,
      autostart: i % 5 !== 0,
      states: pick(VM_STATES, i),
      networks: [],
      pcidevs: hasGpu
        ? [{ ...pick(GPU_MODELS, i), quantity: 1 + (i % 2) }]
        : [],
      volumes: [],
    },
  });
}

for (let i = 0; i < COUNT; i++) {
  const n = pad3(i + 1);
  const sizeGb = [10, 20, 50, 100, 250, 500][i % 6];
  const size = sizeGb * 1024 ** 3;
  const host = resolveIaasHost(i);
  volumes.push({
    alg: pick(["no", "lzo", "zlib"], i),
    bootable: i % 5 === 0,
    bus: pick(VOLUME_BUSES, i),
    cache: null,
    ceph: i % 12 === 0,
    clonable: i % 3 !== 0,
    cloudinit: i % 8 === 0,
    creatorID: "synthetic",
    exported: i % 11 === 0,
    format: pick(VOLUME_FORMATS, i),
    iscsi_name: i % 9 === 0 ? `iqn.2025.synthetic.vol-${n}` : "",
    lastUpdated: `2025-05-${String((i % 28) + 1).padStart(2, "0")} 12:00:00.000`,
    name: `disk-${n}`,
    nservers: 1 + (i % 3),
    own: i % 4 !== 0,
    private: i % 3 === 0,
    readonly: i % 13 === 0,
    server: host.ip,
    servers: [host.ip, ...(i % 3 === 0 ? [resolveIaasHost(i + 1).ip] : [])].filter(
      (v, idx, a) => a.indexOf(v) === idx
    ),
    serverurl: host.serverurl,
    shareable: i % 6 === 0,
    size,
    sizeOnDisk: Math.round(size * (0.3 + (i % 5) * 0.1)),
    volumeID: `vol-synth-${n}`,
    read_MB_bw: 100 + (i % 10) * 25,
    write_MB_bw: 80 + (i % 10) * 20,
    read_iops: 2000 + i * 100,
    write_iops: 1800 + i * 90,
    hw_device: null,
    fs: i % 7 === 0 ? "ext4" : null,
    kind: null,
    priority: i % 4,
    target_type: host.target_type,
  });
}

// Attach volumes to ~half of VMs (1–2 disks each); disk host must match VM host
for (let i = 0; i < COUNT; i++) {
  if (i % 2 !== 0) continue;
  const vm = vms[i];
  const host = resolveIaasHost(i);
  const volA = {
    ...volumes[i],
    server: host.ip,
    servers: [host.ip],
    serverurl: host.serverurl,
    target_type: host.target_type,
  };
  const volB = {
    ...volumes[(i + 7) % COUNT],
    server: host.ip,
    servers: [host.ip],
    serverurl: host.serverurl,
    target_type: host.target_type,
  };
  vm.req_json.volumes = [volA, ...(i % 4 === 0 ? [volB] : [])];
}

for (const vm of vms) {
  delete vm._hostIp;
}

const NETWORK_KINDS = ["libvirt-bridge", "libvirt-nat", "tailscale", "shared"];

for (let i = 0; i < COUNT; i++) {
  const n = pad3(i + 1);
  const kind = pick(NETWORK_KINDS, i);
  const server = pick(SERVERS, i);
  const uid = `net-synth-${n}`;
  const name = `net-${kind.split("-")[0]}-${n}`;

  if (kind === "libvirt-bridge") {
    networks.push({
      servers: [server],
      network_name: name,
      type: "libvirt",
      mode: "bridge",
      private: i % 2 === 0,
      network_uid: uid,
      creator_uid: "synthetic",
      device_name: `br-${n}`,
      libvirt_network: name,
      ip: { address: "", dhcp: null, net_bits: null },
    });
  } else if (kind === "libvirt-nat") {
    const octet = 100 + (i % 100);
    const vmRef = vms[i % COUNT];
    networks.push({
      servers: [server],
      network_name: name,
      type: "libvirt",
      mode: "nat",
      private: true,
      network_uid: uid,
      creator_uid: "synthetic",
      device_name: `virbr-${n}`,
      libvirt_network: name,
      ip: {
        address: `192.168.${octet}.1/24`,
        net_bits: 24,
        dhcp: {
          start: `192.168.${octet}.100`,
          end: `192.168.${octet}.200`,
          hosts: [
            {
              mac: `52:54:00:${n.slice(0, 2)}:${n.slice(1, 3)}:01`,
              address: `192.168.${octet}.101`,
              name: vmRef.req_json.vm_name,
            },
          ],
        },
      },
      routes: [
        {
          address: "0.0.0.0/0",
          gateway: `192.168.${octet}.1`,
          prefix: "0",
        },
      ],
    });
  } else if (kind === "tailscale") {
    networks.push({
      servers: [server, pick(SERVERS, i + 1)],
      network_name: name,
      type: "tailscale",
      mode: null,
      private: true,
      network_uid: uid,
      creator_uid: "synthetic",
      device_name: `ts-${n}`,
      libvirt_network: "",
      ip: {
        address: `100.${64 + (i % 32)}.${i % 256}.1/16`,
        net_bits: 16,
        dhcp: null,
      },
      headscale: {
        address: `https://headscale-${n}.synthetic.local`,
        headscale_user: `user-${n}`,
        api_key: `key-${n}`,
      },
    });
  } else {
    const octet = 10 + (i % 200);
    networks.push({
      servers: [server],
      network_name: name,
      type: "shared",
      mode: pick(["open", "isolated", "open"], i),
      private: i % 3 === 0,
      network_uid: uid,
      creator_uid: "synthetic",
      device_name: "",
      libvirt_network: "",
      ip: {
        address: `10.${octet}.0.1/24`,
        net_bits: 24,
        dhcp: {
          start: `10.${octet}.0.50`,
          end: `10.${octet}.0.150`,
          hosts: [],
        },
      },
    });
  }
}

for (let i = 0; i < COUNT; i++) {
  const n = pad3(i + 1);
  const vm = vms[i % COUNT];
  const vmName = vm.req_json.vm_name;
  portforwards.push({
    serverurl: pick(SERVERS, i),
    protocol: pick(PROTOCOLS, i),
    port: 20000 + i,
    target: vmName,
    target_vm_uid: vm.uniqueID,
    target_port: pick(TARGET_PORTS, i),
    tailscale: i % 5 === 0,
    force: i % 11 === 0,
    forward_uid: `pf-synth-${n}`,
  });
}

for (let i = 0; i < COUNT; i++) {
  const n = pad3(i + 1);
  const slots = [1, 2, 4, 8, 16, 32][i % 6];
  const ramsize = [2, 4, 8, 16, 32, 64, 128][i % 7];
  const hasGpu = i % 5 === 0;
  templates.push({
    cpu: {
      allowSMT: i % 2 === 0,
      flags: i % 9 === 0 ? ["vmx"] : [],
      overprovision: (i % 3) + 1,
      slots,
    },
    ram: {
      ramsize,
      reqECC: i % 10 === 0,
    },
    info: {
      name: `template-${n}`,
      description: `${slots} vCPU, ${ramsize} GiB — ${pick(["general", "compute", "memory", "gpu"], i)}`,
    },
    pci: hasGpu ? [{ ...pick(GPU_MODELS, i), quantity: 1 }] : [],
  });
}

const runningVms = vms.filter((v) => v.req_json.states === "running");
const totalRamMib = vms.reduce((s, v) => s + v.req_json.ramsize * 1024, 0);
const usedRamMib = runningVms.reduce((s, v) => s + v.req_json.ramsize * 1024, 0);
const totalStorageGb = volumes.reduce((s, v) => s + v.size / 1024 ** 3, 0);

const hostStatus = {
  allocated_cores_count: runningVms.length,
  allocated_slots_count: vms.reduce((s, v) => s + v.req_json.slots, 0),
  bridge_interfaces: networks
    .filter((n) => n.type === "libvirt" && n.mode === "bridge")
    .map((n) => n.device_name)
    .slice(0, 12),
  client_id_count: 3,
  core_allocation_percentage: Math.min(95, Math.round((runningVms.length / COUNT) * 100)),
  core_provisioning: Array.from({ length: 4 }, (_, coreId) => ({
    available_slots: 8 - coreId,
    core_id: coreId,
    max_overprovision: 2,
    provisioned_vms: runningVms
      .filter((_, idx) => idx % 4 === coreId)
      .map((v) => v.req_json.vm_name)
      .slice(0, 8),
    provisioned_vms_count: runningVms.filter((_, idx) => idx % 4 === coreId).length,
  })),
  direct_interfaces: [],
  dom_displays: {
    ports: Array.from({ length: Math.min(10, runningVms.length) }, (_, i) => 5900 + i),
    protocols: ["vnc", "spice"],
  },
  nic_count: networks.length,
  os_families: {
    linux: {
      count: vms.filter((v) => v.req_json.os_family === "linux").length,
      flavours: LINUX_FLAVOURS.map((name) => ({
        name,
        count: vms.filter((v) => v.req_json.os_flavour === name).length,
      })).filter((f) => f.count > 0),
    },
    windows: {
      count: vms.filter((v) => v.req_json.os_family === "windows").length,
      flavours: WINDOWS_FLAVOURS.map((name) => ({
        name,
        count: vms.filter((v) => v.req_json.os_flavour === name).length,
      })).filter((f) => f.count > 0),
    },
  },
  slot_allocation_percentage: Math.min(
    99,
    Math.round((vms.reduce((s, v) => s + v.req_json.slots, 0) / 128) * 100)
  ),
  storage_count: volumes.length,
  storages: volumes.slice(0, 20).map((vol, idx) => ({
    bus: vol.bus,
    format: vol.format,
    sizeGB: String(Math.round(vol.size / 1024 ** 3)),
    vm_uuids: vms
      .filter((vm) =>
        (vm.req_json.volumes ?? []).some((v) => v.volumeID === vol.volumeID)
      )
      .map((vm) => vm.uniqueID),
    volume_id: vol.volumeID,
  })),
  total_allocated_ram_mib: totalRamMib,
  total_allocated_storage_size_gb: Math.round(totalStorageGb),
  total_cores_count: 32,
  total_slots_count: 128,
  total_used_ram_mib: usedRamMib,
  vm_count: vms.length,
};

function writeJson(name, data) {
  const path = join(FIXTURES_DIR, name);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}

writeJson("vms.json", vms);
writeJson("volumes.json", volumes);
writeJson("networks.json", networks);
writeJson("portforwards.json", portforwards);
writeJson("templates.json", templates);
writeJson("host-status.json", hostStatus);

console.log(`Wrote ${COUNT} VMs, volumes, networks, port-forwards, templates`);
console.log(`Wrote host-status.json (vm_count=${hostStatus.vm_count})`);
