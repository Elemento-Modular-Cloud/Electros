import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./config.js";

export interface AuthStatus {
  authenticated: boolean;
  username: string;
  org: string;
  org_id: string;
  org_name: string;
  suborg_id: string | null;
  suborg_name: string | null;
  role: "ORGOWNER" | "ORGADMIN" | "USER";
  active_subscriber: boolean;
  email_verified: boolean;
  authz_token?: string;
  limits?: Record<string, unknown>;
}

export interface TargetRecord {
  target_id: string;
  target_name: string;
  target_type: string;
  target_config: Record<string, unknown>;
  active?: boolean;
  trusted?: "trusted" | "not_trusted" | "expired" | "na";
  ping_status?: Record<string, unknown>;
}

export interface TargetsListResponse {
  data: TargetRecord[];
}

export type VmRecord = Record<string, unknown>;
export type VolumeRecord = Record<string, unknown>;
export type NetworkRecord = Record<string, unknown>;
export type TemplateRecord = Record<string, unknown>;
export type PortForwardRecord = Record<string, unknown>;
export type ServiceInstanceRecord = Record<string, unknown>;
export type BillingTransactionRecord = Record<string, unknown>;

export interface LicenseRecord {
  license_key: string;
  expire?: number;
  is_armed: boolean;
  hmac: string;
  duration: number;
  reseller_entity?: string;
  support_json: Record<string, unknown>;
}

export interface LicensesListResponse {
  licenses: LicenseRecord[];
}

const STATE_PATH = "/tmp/synthetic-daemons-state.json";

function loadFixture<T>(dir: string, name: string): T {
  const path = join(dir, name);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Ensure GUI CloudTargetFromJson always receives target_name (+ sensible defaults). */
function normalizeTarget(raw: Partial<TargetRecord> & { target_id?: string }): TargetRecord {
  const targetId = raw.target_id ?? raw.target_name ?? `target-${Date.now()}`;
  return {
    target_id: targetId,
    target_name: raw.target_name ?? targetId,
    target_type: raw.target_type ?? "atomos_local_ip",
    target_config: raw.target_config ?? {},
    active: raw.active ?? true,
    trusted: raw.trusted ?? "trusted",
    ping_status: raw.ping_status,
  };
}

function normalizeTargetsList(list: TargetsListResponse | { data?: Partial<TargetRecord>[] }): TargetsListResponse {
  return { data: (list.data ?? []).map((t) => normalizeTarget(t)) };
}

export class MemoryStore {
  authStatus: AuthStatus;
  targets: TargetsListResponse;
  vms: VmRecord[];
  volumes: VolumeRecord[];
  networks: NetworkRecord[];
  templates: TemplateRecord[];
  hostStatus: Record<string, unknown>;
  portForwards: PortForwardRecord[];
  portTunnels: Record<string, unknown>[];
  services: ServiceInstanceRecord[];
  billingTransactions: BillingTransactionRecord[];
  licenses: LicensesListResponse;
  /** Demo scenarios shown on Active Connections (matches target-client SingleScenarioResponse). */
  scenarios: Array<{
    id: string;
    name: string;
    org_id: string;
    active: boolean;
    pools: string[];
    users: string[];
  }> = [
    {
      id: "scenario-lab",
      name: "Lab Stack",
      org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      active: false,
      pools: ["atomos-lab", "proxmox-hv", "esxi-hv"],
      users: [],
    },
    {
      id: "scenario-public-cloud",
      name: "Public Cloud Demo",
      org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      active: false,
      pools: ["google-demo-public", "azure-demo-public", "ovh-demo-public"],
      users: [],
    },
  ];

  private readonly persistState: boolean;

  private normalizeAuthStatus(raw: Partial<AuthStatus> | AuthStatus): AuthStatus {
    return {
      authenticated: Boolean(raw.authenticated),
      username: raw.username ?? "demo@synthetic.local",
      org: raw.org_name ?? raw.org ?? "Elemento Demo",
      org_id: raw.org_id ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      org_name: raw.org_name ?? raw.org ?? "Elemento Demo",
      suborg_id: raw.suborg_id ?? null,
      suborg_name: raw.suborg_name ?? null,
      role: raw.role ?? "ORGOWNER",
      active_subscriber: raw.active_subscriber ?? true,
      email_verified: raw.email_verified ?? true,
      authz_token: raw.authz_token ?? "synthetic-authz-token",
      limits: raw.limits,
    };
  }

  constructor(config: AppConfig) {
    const { fixturesDir, persistState } = config;
    this.persistState = persistState;

    if (persistState && existsSync(STATE_PATH)) {
      const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<MemoryStore>;
      this.authStatus = this.normalizeAuthStatus(
        (saved.authStatus as AuthStatus) ?? loadFixture(fixturesDir, "auth-status.json")
      );
      this.targets = normalizeTargetsList(
        (saved.targets as TargetsListResponse) ?? loadFixture(fixturesDir, "targets.json")
      );
      this.vms = (saved.vms as VmRecord[]) ?? loadFixture(fixturesDir, "vms.json");
      this.volumes = (saved.volumes as VolumeRecord[]) ?? loadFixture(fixturesDir, "volumes.json");
      this.networks = (saved.networks as NetworkRecord[]) ?? loadFixture(fixturesDir, "networks.json");
      this.templates = (saved.templates as TemplateRecord[]) ?? loadFixture(fixturesDir, "templates.json");
      this.hostStatus = (saved.hostStatus as Record<string, unknown>) ?? loadFixture(fixturesDir, "host-status.json");
      this.portForwards = (saved.portForwards as PortForwardRecord[]) ?? [];
      this.portTunnels = (saved.portTunnels as Record<string, unknown>[]) ?? [];
      this.services = (saved.services as ServiceInstanceRecord[]) ?? loadFixture(fixturesDir, "services.json");
      try {
        this.billingTransactions = (saved.billingTransactions as BillingTransactionRecord[])
          ?? loadFixture(fixturesDir, "billing-transactions.json");
      } catch {
        this.billingTransactions = [];
      }
      this.licenses = (saved.licenses as LicensesListResponse)
        ?? loadFixture(fixturesDir, "licenses.json");
    } else {
      this.authStatus = this.normalizeAuthStatus(loadFixture(fixturesDir, "auth-status.json"));
      this.targets = normalizeTargetsList(loadFixture(fixturesDir, "targets.json"));
      this.vms = loadFixture(fixturesDir, "vms.json");
      this.volumes = loadFixture(fixturesDir, "volumes.json");
      this.networks = loadFixture(fixturesDir, "networks.json");
      this.templates = loadFixture(fixturesDir, "templates.json");
      this.hostStatus = loadFixture(fixturesDir, "host-status.json");
      try {
        this.portForwards = loadFixture(fixturesDir, "portforwards.json");
      } catch {
        this.portForwards = [];
      }
      this.portTunnels = [];
      this.services = loadFixture(fixturesDir, "services.json");
      try {
        this.billingTransactions = loadFixture(fixturesDir, "billing-transactions.json");
      } catch {
        this.billingTransactions = [];
      }
      this.licenses = loadFixture(fixturesDir, "licenses.json");
    }
  }

  private snapshot(): void {
    if (!this.persistState) {
      return;
    }
    writeFileSync(
      STATE_PATH,
      JSON.stringify({
        authStatus: this.authStatus,
        targets: this.targets,
        vms: this.vms,
        volumes: this.volumes,
        networks: this.networks,
        templates: this.templates,
        hostStatus: this.hostStatus,
        portForwards: this.portForwards,
        portTunnels: this.portTunnels,
        services: this.services,
        billingTransactions: this.billingTransactions,
        licenses: this.licenses,
      }, null, 2)
    );
  }

  touch(): void {
    this.snapshot();
  }

  setAuthenticated(authenticated: boolean, username?: string): void {
    this.authStatus.authenticated = authenticated;
    if (username) {
      this.authStatus.username = username;
    }
    if (authenticated) {
      this.authStatus.active_subscriber = true;
      this.authStatus.email_verified = true;
      this.authStatus.role = this.authStatus.role || "ORGOWNER";
      if (!this.authStatus.org_id) {
        this.authStatus.org_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        this.authStatus.org_name = this.authStatus.org_name || "Elemento Demo";
        this.authStatus.org = this.authStatus.org_name;
      }
    }
    this.touch();
  }

  statusPayload(): Record<string, unknown> {
    const s = this.authStatus;
    return {
      authenticated: s.authenticated,
      username: s.username,
      org: s.org_name ?? s.org ?? "",
      org_id: s.org_id ?? "",
      org_name: s.org_name ?? s.org ?? "",
      suborg_id: s.suborg_id ?? null,
      suborg_name: s.suborg_name ?? null,
      role: s.role ?? "ORGOWNER",
      active_subscriber: s.active_subscriber ?? true,
      email_verified: s.email_verified ?? true,
      authz_token: s.authz_token ?? "synthetic-authz-token",
      limits: s.limits ?? {
        max_vms: -1,
        max_slots: -1,
        max_ram_mib: -1,
        max_storage_gb: -1,
        max_networks: -1,
        max_global_networks: -1,
        max_local_networks: -1,
        max_networks_with_driver: {},
        cancreate_net_local: true,
        cancreate_net_global: true,
        cancreate_net_dhcp: true,
        cancreate_net_nat: true,
        cancreate_net_bridge: true,
        cancreate_net_isolated: true,
        cancreate_net_fully_isolated: true,
        cancreate_net_with_static_routes: true,
      },
    };
  }

  scopesPayload(): Record<string, unknown> {
    const orgId = this.authStatus.org_id || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const orgName = this.authStatus.org_name || this.authStatus.org || "Elemento Demo";
    return {
      username: this.authStatus.username,
      scopes: [
        {
          org_id: orgId,
          org_name: orgName,
          suborg_id: null,
          suborg_name: null,
          selectable: true,
          role: this.authStatus.role ?? "ORGOWNER",
          is_trial: false,
          member: true,
          preferred: true,
          suborgs: [],
        },
      ],
    };
  }

  accountDetailsPayload(): Record<string, unknown> {
    return {
      fiscal_code: "SYNTHETIC",
      vat_code: "IT00000000000",
      company_name: this.authStatus.org_name || "Elemento Demo",
      full_address: "Via Sintetica 1",
      zip_code: "20100",
      city: "Milano",
      province: "MI",
      sdi_code: "XXXXXXX",
      nationality: "IT",
      username: this.authStatus.username,
      email: `${this.authStatus.username}@synthetic.local`,
    };
  }

  findTarget(id: string): TargetRecord | undefined {
    return this.targets.data.find((t) => t.target_id === id);
  }

  buildPingResult(targetId: string): Record<string, unknown> {
    const target = this.findTarget(targetId);
    const targetType = target?.target_type ?? "atomos_local_ip";
    const ips = (target?.target_config?.ips as string[] | undefined) ?? ["192.168.1.10"];
    const requiresTrust = targetType.includes("atomos");

    return {
      target_id: targetId,
      target_type: targetType,
      pingable: true,
      trust_established: requiresTrust ? true : null,
      health: "ok",
      servers: ips.map((ip) => ({ ip, pingable: true, ping_time_ms: 12 })),
    };
  }

  get activeTargets(): TargetRecord[] {
    return this.targets.data.filter((t) => t.active !== false);
  }

  private get activeConnectionCount(): number {
    return this.activeTargets.length;
  }

  private get activeScenarioId(): string | null {
    const active = this.scenarios.find((s) => s.active);
    return active?.id ?? null;
  }

  setTargetActive(targetId: string, active: boolean): boolean {
    const target = this.findTarget(targetId);
    if (!target) {
      return false;
    }
    target.active = active;
    this.touch();
    return true;
  }

  activateScenario(scenarioId: string): boolean {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      return false;
    }
    for (const s of this.scenarios) {
      s.active = s.id === scenarioId;
    }
    // Scenario pools become active connections; other targets stay as-is.
    for (const id of scenario.pools) {
      this.setTargetActive(id, true);
    }
    this.touch();
    return true;
  }

  connectionsMe(): Record<string, unknown> {
    return {
      active_targets: this.activeTargets,
      active_scenario: this.activeScenarioId,
      active_connections: this.activeConnectionCount,
      // Real tiers use a positive quota; -1 reads as "of -1" in the GUI.
      max_connections: 25,
    };
  }

  connectionsStatus(): Record<string, unknown> {
    return {
      active_scenario: this.activeScenarioId,
      active_connections: this.activeConnectionCount,
      max_connections: 25,
    };
  }

  grantsMe(): Record<string, unknown> {
    return {
      targets: this.targets.data,
      scenarios: this.scenarios,
      // All org targets remain available as spare grants; `active` drives the checkbox.
      target_grants: this.targets.data.map((t) => t.target_id),
    };
  }

  createOrgTarget(body: {
    target_name: string;
    target_type?: string;
    target_config?: Record<string, unknown>;
  }): TargetRecord {
    const name = body.target_name || `target-${Date.now()}`;
    const record: TargetRecord = {
      target_id: name,
      target_name: name,
      target_type: body.target_type ?? "atomos_local_ip",
      target_config: body.target_config ?? { ips: ["192.168.1.50"] },
      active: true,
      trusted: "trusted",
    };
    this.addTarget(record);
    return record;
  }

  lastVmForVolume(volumeUuid: string): Record<string, unknown> | null {
    for (const vm of this.vms) {
      const volumes = (vm.req_json as Record<string, unknown> | undefined)?.volumes;
      if (Array.isArray(volumes) && volumes.some((v) => {
        if (typeof v === "string") return v === volumeUuid;
        if (v && typeof v === "object") {
          const rec = v as Record<string, unknown>;
          return rec.volumeID === volumeUuid || rec.volume_id === volumeUuid || rec.name === volumeUuid;
        }
        return false;
      })) {
        return vm;
      }
    }
    return null;
  }

  removeVm(localIndex: string): void {
    this.vms = this.vms.filter((vm) => {
      const id = (vm.uniqueID as string) ?? (vm.req_json as Record<string, unknown>)?.vm_name;
      return id !== localIndex;
    });
    this.touch();
  }

  addVm(vm: VmRecord): void {
    this.vms.push(vm);
    this.touch();
  }

  setVmState(localIndex: string, state: string): void {
    for (const vm of this.vms) {
      const req = vm.req_json as Record<string, unknown> | undefined;
      if (vm.uniqueID === localIndex || req?.vm_name === localIndex) {
        if (req) {
          req.states = state;
        }
      }
    }
    this.touch();
  }

  addTarget(record: TargetRecord): void {
    this.targets.data.push(record);
    this.touch();
  }

  removeTarget(id: string): void {
    this.targets.data = this.targets.data.filter((t) => t.target_id !== id);
    this.touch();
  }

  addVolume(volume: VolumeRecord): void {
    this.volumes.push(volume);
    this.touch();
  }

  removeVolume(volumeId: string): void {
    this.volumes = this.volumes.filter((v) => v.volumeID !== volumeId && v.name !== volumeId);
    this.touch();
  }

  findNetwork(networkUid: string): NetworkRecord | undefined {
    return this.networks.find((n) => n.network_uid === networkUid);
  }

  addNetwork(network: NetworkRecord): void {
    const uid = network.network_uid as string;
    if (uid && this.findNetwork(uid)) {
      const idx = this.networks.findIndex((n) => n.network_uid === uid);
      this.networks[idx] = network;
    } else {
      this.networks.push(network);
    }
    this.touch();
  }

  removeNetwork(networkUid: string): void {
    this.networks = this.networks.filter((n) => n.network_uid !== networkUid);
    this.touch();
  }

  addPortForward(pf: PortForwardRecord): void {
    const uid = pf.forward_uid as string;
    if (uid) {
      this.portForwards = this.portForwards.filter((p) => p.forward_uid !== uid);
    }
    this.portForwards.push(pf);
    this.touch();
  }

  removePortForward(forwardUid: string): void {
    this.portForwards = this.portForwards.filter((p) => p.forward_uid !== forwardUid);
    this.touch();
  }

  listRunningServices(serviceType: string): ServiceInstanceRecord[] {
    return this.services.filter((s) => s.service_type === serviceType);
  }

  findService(serviceType: string, serviceUuid: string): ServiceInstanceRecord | undefined {
    return this.services.find(
      (s) => s.service_type === serviceType && s.service_uuid === serviceUuid
    );
  }

  createServiceInstance(
    serviceType: string,
    serviceUuid: string,
    billingUuid: string,
    body: Record<string, unknown>
  ): ServiceInstanceRecord {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    const base: ServiceInstanceRecord = {
      service_type: serviceType,
      service_uuid: serviceUuid,
      billing_uuid: billingUuid,
    };

    let record: ServiceInstanceRecord;

    const region = (body.region as string) ?? "fr-par";

    if (serviceType === "kaas") {
      record = {
        ...base,
        cluster_name: (body.name as string) ?? `cluster-${serviceUuid.slice(0, 6)}`,
        status: "running",
        version: (body.kubernetes_version as string) ?? "1.34",
        network_cidr: (body["nodes_subnet/network"] as string) ?? "10.50.0.0/16",
        location: region,
      };
    } else if (serviceType === "objectstorage") {
      const sizeTb = Number(body.purchasedTB ?? 1);
      record = {
        ...base,
        name: (body.name as string) ?? `bucket-${serviceUuid.slice(0, 6)}`,
        endpoint: `https://s3.${region}.synthetic.local`,
        region,
        active_storage: Math.round(sizeTb * 1024 ** 4),
      };
    } else if (serviceType === "dbaas") {
      const diskGb = Number(body.disk_size ?? 50);
      record = {
        ...base,
        name: (body.name as string) ?? `db-${serviceUuid.slice(0, 6)}`,
        region,
        engine: (body.engine as string) ?? "postgres",
        backup_time: Math.floor(Date.now() / 1000),
        disk_size: Math.round(diskGb * 1024 ** 3),
        nodes_number: String(body.nodes_number ?? 1),
      };
    } else if (serviceType === "n8n" || serviceType === "openclaw") {
      record = {
        ...base,
        vm_name: (body.vm_name as string) ?? `${serviceType}-${serviceUuid.slice(0, 6)}`,
        status: "running",
        region,
      };
    } else {
      record = { ...base, ...body, status: (body.status as string) ?? "running" };
    }

    this.services.push(record);
    this.billingTransactions.push({
      billing_uuid: billingUuid,
      client_uuid: "synthetic-client-001",
      organisation_name: "demo",
      status: "running",
      interval: "month",
      start_timestamp: new Date().toISOString(),
      end_timestamp: oneYear.toISOString(),
      price: 49.0,
    });
    this.touch();
    return record;
  }

  removeService(serviceType: string, serviceUuid: string): void {
    const item = this.findService(serviceType, serviceUuid);
    if (item?.billing_uuid) {
      for (const tx of this.billingTransactions) {
        if (tx.billing_uuid === item.billing_uuid) {
          tx.status = "to_delete";
        }
      }
    }
    this.services = this.services.filter(
      (s) => !(s.service_type === serviceType && s.service_uuid === serviceUuid)
    );
    this.touch();
  }

  getBillingTransactions(billingUuid?: string): BillingTransactionRecord[] {
    if (!billingUuid) {
      return [...this.billingTransactions];
    }
    return this.billingTransactions.filter((t) => t.billing_uuid === billingUuid);
  }

  findLicense(licenseKey: string): LicenseRecord | undefined {
    return this.licenses.licenses.find((l) => l.license_key === licenseKey);
  }

  getArmedLicense(): LicenseRecord | null {
    return this.licenses.licenses.find((l) => l.is_armed) ?? null;
  }

  armLicense(licenseKey: string): Record<string, unknown> {
    const license = this.findLicense(licenseKey);
    if (!license) {
      throw new Error(`Unknown license key: ${licenseKey}`);
    }

    for (const entry of this.licenses.licenses) {
      entry.is_armed = entry.license_key === licenseKey;
    }
    this.touch();

    const serial = `SN-SYNTH-${licenseKey.replace(/-/g, "").slice(-12)}`;
    const content = [
      "# Synthetic AtomOS license (development only)",
      `license_key=${licenseKey}`,
      `serial_number=${serial}`,
      `duration_days=${license.duration}`,
      `hmac=${license.hmac}`,
      `issued=${new Date().toISOString()}`,
    ].join("\n");

    return {
      message: "License armed successfully",
      license: {
        key: licenseKey,
        serial_number: serial,
        file: content,
      },
    };
  }
}
