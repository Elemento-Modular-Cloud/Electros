import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./config.js";

export interface AuthStatus {
  authenticated: boolean;
  username: string;
  org: string;
}

export interface TargetRecord {
  target_id: string;
  target_type: string;
  target_config: Record<string, unknown>;
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

  private readonly persistState: boolean;

  constructor(config: AppConfig) {
    const { fixturesDir, persistState } = config;
    this.persistState = persistState;

    if (persistState && existsSync(STATE_PATH)) {
      const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<MemoryStore>;
      this.authStatus = (saved.authStatus as AuthStatus) ?? loadFixture(fixturesDir, "auth-status.json");
      this.targets = (saved.targets as TargetsListResponse) ?? loadFixture(fixturesDir, "targets.json");
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
      this.authStatus = loadFixture(fixturesDir, "auth-status.json");
      this.targets = loadFixture(fixturesDir, "targets.json");
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
    this.touch();
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
