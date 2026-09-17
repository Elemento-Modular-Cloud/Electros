import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./config.js";
import {
  DEMO_CLIENT_UID,
  DEMO_ORG_ID,
  DEMO_TOKEN,
  DEMO_USER,
  TIER_STANDARD_ID,
  UNLIMITED_LIMITS,
  type AccountDetails,
  type AuthStatus,
  type BillingTransactionRecord,
  type ConnectionsState,
  type InviteRecord,
  type LicenseRecord,
  type LicensesListResponse,
  type Limits,
  type NetworkRecord,
  type OrgRecord,
  type OrgTargetRecord,
  type PortForwardRecord,
  type ScenarioRecord,
  type ScopesModel,
  type ServiceInstanceRecord,
  type SubOrgRecord,
  type SubscriptionRecord,
  type SubscriptionTier,
  type TargetConfig,
  type TargetGrantRecord,
  type TemplateRecord,
  type VmRecord,
  type VolumeRecord,
} from "./types.js";

const STATE_PATH = "/tmp/synthetic-daemons-state.json";

function loadFixture<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

function tryLoad<T>(dir: string, name: string, fallback: T): T {
  try {
    return loadFixture<T>(dir, name);
  } catch {
    return fallback;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryStore {
  authStatus: AuthStatus;
  orgs: OrgRecord[];
  invites: InviteRecord[];
  memberLimits: Record<string, Limits>;
  accountDetails: AccountDetails | null;
  scopes: ScopesModel;
  orgTargets: OrgTargetRecord[];
  targetGrants: TargetGrantRecord[];
  scenarios: ScenarioRecord[];
  connections: ConnectionsState;
  targetSettings: Record<string, unknown>;
  waitingCerts: Record<string, { host: string; trusted: boolean }>;
  tiers: SubscriptionTier[];
  subscriptions: SubscriptionRecord[];
  vms: VmRecord[];
  volumes: VolumeRecord[];
  networks: NetworkRecord[];
  templates: TemplateRecord[];
  hostStatus: Record<string, unknown>;
  portForwards: PortForwardRecord[];
  portTunnels: Record<string, unknown>[];
  portTunnelServices: Record<string, unknown>[];
  backups: Record<string, unknown>[];
  services: ServiceInstanceRecord[];
  billingTransactions: BillingTransactionRecord[];
  licenses: LicensesListResponse;
  verificationCodes: Record<string, string>;
  users: Record<string, { password: string; email_verified: boolean }>;

  private readonly persistState: boolean;

  constructor(config: AppConfig) {
    const { fixturesDir, persistState } = config;
    this.persistState = persistState;

    const saved = persistState && existsSync(STATE_PATH)
      ? JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<MemoryStore>
      : {};

    this.authStatus = (saved.authStatus as AuthStatus) ?? tryLoad(fixturesDir, "auth-status.json", {
      authenticated: true,
      username: DEMO_USER,
      org_id: DEMO_ORG_ID,
      org_name: "Elemento Demo",
      suborg_id: null,
      suborg_name: null,
      role: "ORGOWNER",
      limits: UNLIMITED_LIMITS,
      client_uid: DEMO_CLIENT_UID,
      authz_token: DEMO_TOKEN,
      active_subscriber: true,
      email_verified: true,
    });
    this.orgs = (saved.orgs as OrgRecord[]) ?? tryLoad(fixturesDir, "orgs.json", []);
    this.invites = (saved.invites as InviteRecord[]) ?? tryLoad(fixturesDir, "invites.json", []);
    this.memberLimits = (saved.memberLimits as Record<string, Limits>) ?? {};
    this.accountDetails = (saved.accountDetails as AccountDetails | null)
      ?? tryLoad(fixturesDir, "account-details.json", null);
    this.scopes = (saved.scopes as ScopesModel) ?? tryLoad(fixturesDir, "scopes.json", {
      username: this.authStatus.username ?? DEMO_USER,
      scopes: [],
    });
    this.orgTargets = (saved.orgTargets as OrgTargetRecord[]) ?? tryLoad(fixturesDir, "org-targets.json", []);
    this.targetGrants = (saved.targetGrants as TargetGrantRecord[]) ?? tryLoad(fixturesDir, "target-grants.json", []);
    this.scenarios = (saved.scenarios as ScenarioRecord[]) ?? tryLoad(fixturesDir, "scenarios.json", []);
    this.connections = (saved.connections as ConnectionsState) ?? tryLoad(fixturesDir, "connections.json", {
      active_target_ids: this.orgTargets.map((t) => t.target_id),
      active_scenario_id: this.scenarios.find((s) => s.active)?.id ?? null,
      max_connections: 32,
    });
    this.targetSettings = (saved.targetSettings as Record<string, unknown>) ?? {};
    this.waitingCerts = (saved.waitingCerts as Record<string, { host: string; trusted: boolean }>) ?? {};
    this.tiers = (saved.tiers as SubscriptionTier[]) ?? tryLoad(fixturesDir, "tiers.json", []);
    this.subscriptions = (saved.subscriptions as SubscriptionRecord[])
      ?? tryLoad(fixturesDir, "subscriptions.json", []);
    this.vms = (saved.vms as VmRecord[]) ?? tryLoad(fixturesDir, "vms.json", []);
    this.volumes = (saved.volumes as VolumeRecord[]) ?? tryLoad(fixturesDir, "volumes.json", []);
    this.networks = (saved.networks as NetworkRecord[]) ?? tryLoad(fixturesDir, "networks.json", []);
    this.templates = (saved.templates as TemplateRecord[]) ?? tryLoad(fixturesDir, "templates.json", []);
    this.hostStatus = (saved.hostStatus as Record<string, unknown>)
      ?? tryLoad(fixturesDir, "host-status.json", {});
    this.portForwards = (saved.portForwards as PortForwardRecord[])
      ?? tryLoad(fixturesDir, "portforwards.json", []);
      this.portTunnels = (saved.portTunnels as Record<string, unknown>[]) ?? [];
    this.portTunnelServices = (saved.portTunnelServices as Record<string, unknown>[]) ?? [];
    this.backups = (saved.backups as Record<string, unknown>[]) ?? [];
    this.services = (saved.services as ServiceInstanceRecord[]) ?? tryLoad(fixturesDir, "services.json", []);
        this.billingTransactions = (saved.billingTransactions as BillingTransactionRecord[])
      ?? tryLoad(fixturesDir, "billing-transactions.json", []);
    this.licenses = (saved.licenses as LicensesListResponse) ?? tryLoad(fixturesDir, "licenses.json", {
      licenses: [],
    });
    this.verificationCodes = (saved.verificationCodes as Record<string, string>) ?? {};
    this.users = (saved.users as Record<string, { password: string; email_verified: boolean }>) ?? {
      [DEMO_USER]: { password: "demo", email_verified: true },
    };
  }

  private snapshot(): void {
    if (!this.persistState) {
      return;
    }
    writeFileSync(STATE_PATH, JSON.stringify({
        authStatus: this.authStatus,
      orgs: this.orgs,
      invites: this.invites,
      memberLimits: this.memberLimits,
      accountDetails: this.accountDetails,
      scopes: this.scopes,
      orgTargets: this.orgTargets,
      targetGrants: this.targetGrants,
      scenarios: this.scenarios,
      connections: this.connections,
      targetSettings: this.targetSettings,
      waitingCerts: this.waitingCerts,
      tiers: this.tiers,
      subscriptions: this.subscriptions,
        vms: this.vms,
        volumes: this.volumes,
        networks: this.networks,
        templates: this.templates,
        hostStatus: this.hostStatus,
        portForwards: this.portForwards,
        portTunnels: this.portTunnels,
      portTunnelServices: this.portTunnelServices,
      backups: this.backups,
        services: this.services,
        billingTransactions: this.billingTransactions,
        licenses: this.licenses,
      verificationCodes: this.verificationCodes,
      users: this.users,
    }, null, 2));
  }

  touch(): void {
    this.snapshot();
  }

  get activeTargets(): OrgTargetRecord[] {
    return this.connections.active_target_ids
      .map((id) => this.findOrgTarget(id))
      .filter((t): t is OrgTargetRecord => t !== undefined);
  }

  statusPayload(): AuthStatus {
    if (!this.authStatus.authenticated) {
      return { authenticated: false };
    }
    return { ...this.authStatus };
  }

  login(username: string, _password: string, orgId?: string, suborg?: string): AuthStatus {
    const user = username || DEMO_USER;
    if (!this.users[user]) {
      this.users[user] = { password: _password || "demo", email_verified: true };
    }
    const org = this.findOrg(orgId) ?? this.orgs[0];
    const sub = suborg ? this.findSuborg(org?.org_id ?? "", suborg) : null;
    this.authStatus = {
      authenticated: true,
      username: user,
      org_id: org?.org_id ?? null,
      org_name: org?.org_name ?? null,
      suborg_id: sub?.suborg_id ?? null,
      suborg_name: sub?.suborg_name ?? null,
      role: sub ? "SUBORGADMIN" : (org?.owner === user ? "ORGOWNER" : "ORGADMIN"),
      limits: clone(sub?.limits ?? org?.limits ?? UNLIMITED_LIMITS),
      client_uid: DEMO_CLIENT_UID,
      authz_token: DEMO_TOKEN,
      active_subscriber: this.currentSubscription() !== null,
      email_verified: this.users[user]?.email_verified ?? true,
    };
    this.rebuildScopes();
    this.touch();
    return this.statusPayload();
  }

  logout(): void {
    this.authStatus = { authenticated: false };
    this.touch();
  }

  relogin(orgId: string, suborg?: string): AuthStatus {
    return this.login(this.authStatus.username ?? DEMO_USER, "demo", orgId, suborg);
  }

  rebuildScopes(): void {
    const username = this.authStatus.username ?? DEMO_USER;
    this.scopes = {
      username,
      scopes: this.orgs.map((org) => ({
        org_id: org.org_id,
        org_name: org.org_name,
        suborg: null,
        member: org.members.includes(username) || org.owner === username || org.admins.includes(username),
        selectable: true,
        reason: null,
        preferred: org.preferred,
        role: org.owner === username ? "ORGOWNER" : "ORGADMIN",
        is_trial: false,
        suborgs: org.suborgs.map((s) => ({
          org_id: org.org_id,
          org_name: org.org_name,
          suborg_id: s.suborg_id,
          suborg_name: s.suborg_name,
          role: "SUBORGADMIN",
          selectable: true,
        })),
      })),
    };
  }

  findOrg(orgId?: string | null): OrgRecord | undefined {
    if (!orgId) {
      return this.orgs.find((o) => o.org_id === this.authStatus.org_id) ?? this.orgs[0];
    }
    return this.orgs.find((o) => o.org_id === orgId);
  }

  findSuborg(orgId: string, suborg: string): SubOrgRecord | undefined {
    const org = this.findOrg(orgId);
    return org?.suborgs.find((s) => s.suborg_id === suborg || s.suborg_name === suborg);
  }

  currentOrg(): OrgRecord {
    const org = this.findOrg(this.authStatus.org_id);
    if (!org) {
      throw new Error("No organisation in session");
    }
    return org;
  }

  membershipTree(orgId: string, suborg?: string): {
    org_id?: string;
    org_name?: string;
    admins: string[];
    members: string[];
    suborgs?: SubOrgRecord[];
    suborg_id?: string;
    suborg_name?: string;
    inner_suborgs?: SubOrgRecord[];
  } {
    const org = this.findOrg(orgId);
    if (!org) {
      throw new Error("Organisation not found");
    }
    if (!suborg) {
      return {
        org_id: org.org_id,
        org_name: org.org_name,
        admins: org.admins,
        members: org.members,
        suborgs: org.suborgs,
      };
    }
    const found = this.findSuborg(orgId, suborg);
    if (!found) {
      throw new Error("Sub-organisation not found");
    }
    return found;
  }

  createOrg(name: string, limits?: Partial<Limits>): OrgRecord {
    const org: OrgRecord = {
      org_id: randomUUID(),
      org_name: name,
      owner: this.authStatus.username ?? DEMO_USER,
      admins: [this.authStatus.username ?? DEMO_USER],
      members: [this.authStatus.username ?? DEMO_USER],
      suborgs: [],
      limits: { ...UNLIMITED_LIMITS, ...limits },
      preferred: this.orgs.length === 0,
    };
    this.orgs.push(org);
    this.rebuildScopes();
    this.touch();
    return org;
  }

  createSuborg(orgId: string, name: string): SubOrgRecord {
    const org = this.findOrg(orgId);
    if (!org) {
      throw new Error("Organisation not found");
    }
    const sub: SubOrgRecord = {
      suborg_id: randomUUID(),
      suborg_name: name,
      admins: [this.authStatus.username ?? DEMO_USER],
      members: [this.authStatus.username ?? DEMO_USER],
      inner_suborgs: [],
      limits: clone(org.limits),
    };
    org.suborgs.push(sub);
    this.rebuildScopes();
    this.touch();
    return sub;
  }

  deleteSuborg(orgId: string, suborg: string): void {
    const org = this.findOrg(orgId);
    if (!org) {
      return;
    }
    org.suborgs = org.suborgs.filter((s) => s.suborg_id !== suborg && s.suborg_name !== suborg);
    this.touch();
  }

  addMember(orgId: string, username: string, suborg?: string): void {
    const org = this.findOrg(orgId);
    if (!org) {
      return;
    }
    if (suborg) {
      const sub = this.findSuborg(orgId, suborg);
      if (sub && !sub.members.includes(username)) {
        sub.members.push(username);
      }
    } else if (!org.members.includes(username)) {
      org.members.push(username);
    }
    this.touch();
  }

  removeMember(orgId: string, username: string, suborg?: string): void {
    const org = this.findOrg(orgId);
    if (!org) {
      return;
    }
    if (suborg) {
      const sub = this.findSuborg(orgId, suborg);
      if (sub) {
        sub.members = sub.members.filter((m) => m !== username);
        sub.admins = sub.admins.filter((m) => m !== username);
      }
    } else {
      org.members = org.members.filter((m) => m !== username);
      org.admins = org.admins.filter((m) => m !== username);
    }
    this.touch();
  }

  addAdmin(orgId: string, username: string, suborg?: string): void {
    const org = this.findOrg(orgId);
    if (!org) {
      return;
    }
    if (suborg) {
      const sub = this.findSuborg(orgId, suborg);
      if (sub && !sub.admins.includes(username)) {
        sub.admins.push(username);
      }
    } else if (!org.admins.includes(username)) {
      org.admins.push(username);
    }
    this.addMember(orgId, username, suborg);
  }

  removeAdmin(orgId: string, username: string, suborg?: string): void {
    const org = this.findOrg(orgId);
    if (!org) {
      return;
    }
    if (suborg) {
      const sub = this.findSuborg(orgId, suborg);
      if (sub) {
        sub.admins = sub.admins.filter((m) => m !== username);
      }
    } else {
      org.admins = org.admins.filter((m) => m !== username);
    }
    this.touch();
  }

  getLimits(orgId: string, suborg?: string, member?: string): Limits {
    if (member) {
      const key = `${orgId}:${suborg ?? ""}:${member}`;
      return this.memberLimits[key] ?? clone(UNLIMITED_LIMITS);
    }
    if (suborg) {
      return clone(this.findSuborg(orgId, suborg)?.limits ?? UNLIMITED_LIMITS);
    }
    return clone(this.findOrg(orgId)?.limits ?? UNLIMITED_LIMITS);
  }

  setLimits(orgId: string, limits: Limits, suborg?: string, member?: string): void {
    if (member) {
      this.memberLimits[`${orgId}:${suborg ?? ""}:${member}`] = limits;
    } else if (suborg) {
      const sub = this.findSuborg(orgId, suborg);
      if (sub) {
        sub.limits = limits;
      }
    } else {
      const org = this.findOrg(orgId);
      if (org) {
        org.limits = limits;
      }
    }
    this.touch();
  }

  createInvite(orgId: string, email: string, suborgName?: string | null): InviteRecord {
    const org = this.findOrg(orgId);
    const invite: InviteRecord = {
      id: randomUUID(),
      invited_email: email,
      org_id: orgId,
      org_name: org?.org_name ?? "unknown",
      suborg_name: suborgName ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
      invited_by_email: this.authStatus.username ?? DEMO_USER,
      token: randomUUID(),
    };
    this.invites.push(invite);
    this.touch();
    return invite;
  }

  acceptInvite(token: string, register?: { user_name?: string; password?: string }): InviteRecord | undefined {
    const invite = this.invites.find((i) => i.token === token || i.id === token);
    if (!invite) {
      return undefined;
    }
    invite.status = "accepted";
    if (register?.password) {
      this.users[invite.invited_email] = { password: register.password, email_verified: true };
    }
    this.addMember(invite.org_id, invite.invited_email, invite.suborg_name ?? undefined);
    this.touch();
    return invite;
  }

  setPreferredOrg(orgId: string): void {
    for (const org of this.orgs) {
      org.preferred = org.org_id === orgId;
    }
    this.rebuildScopes();
    this.touch();
  }

  upsertAccountDetails(details: Partial<AccountDetails>): AccountDetails {
    this.accountDetails = {
      fiscal_code: details.fiscal_code ?? this.accountDetails?.fiscal_code ?? null,
      vat_code: details.vat_code ?? this.accountDetails?.vat_code ?? null,
      company_name: details.company_name ?? this.accountDetails?.company_name ?? null,
      full_address: details.full_address ?? this.accountDetails?.full_address ?? "",
      zip_code: details.zip_code ?? this.accountDetails?.zip_code ?? "",
      city: details.city ?? this.accountDetails?.city ?? "",
      province: details.province ?? this.accountDetails?.province ?? "",
      sdi_code: details.sdi_code ?? this.accountDetails?.sdi_code ?? null,
      nationality: details.nationality ?? this.accountDetails?.nationality ?? "IT",
      preferences: {
        ...(this.accountDetails?.preferences ?? {}),
        ...(details.preferences ?? {}),
      },
    };
    this.touch();
    return this.accountDetails;
  }

  registerUser(email: string, password: string, orgName?: string): void {
    this.users[email] = { password, email_verified: false };
    if (orgName) {
      const previous = this.authStatus.username;
      this.authStatus.username = email;
      this.createOrg(orgName);
      this.authStatus.username = previous;
    }
    this.touch();
  }

  requestEmailVerification(username: string): string {
    const code = "123456";
    this.verificationCodes[username] = code;
    this.touch();
    return code;
  }

  confirmEmail(username: string, code: string): boolean {
    if (this.verificationCodes[username] !== code && code !== "123456") {
      return false;
    }
    if (this.users[username]) {
      this.users[username].email_verified = true;
    }
    if (this.authStatus.username === username) {
      this.authStatus.email_verified = true;
    }
    this.touch();
    return true;
  }

  currentSubscription(orgId?: string, email?: string): SubscriptionRecord | null {
    const org = orgId ?? this.authStatus.org_id;
    const user = email ?? this.authStatus.username;
    return this.subscriptions.find((s) =>
      s.organisation_id === org && (!user || s.email === user) && s.status === "active"
    ) ?? this.subscriptions.find((s) => s.organisation_id === org && s.status === "active") ?? null;
  }

  orgSubscriptions(orgId?: string, includeInactive = false): SubscriptionRecord[] {
    const org = orgId ?? this.authStatus.org_id;
    return this.subscriptions.filter((s) =>
      s.organisation_id === org && (includeInactive || s.status === "active")
    );
  }

  subscribe(tierName: string, billingFrequency: string, orgId?: string, email?: string): SubscriptionRecord {
    const tier = this.tiers.find((t) => t.name === tierName || t.id === tierName) ?? this.tiers[0];
    const org = this.findOrg(orgId) ?? this.currentOrg();
    const record: SubscriptionRecord = {
      id: randomUUID(),
      account_id: DEMO_CLIENT_UID,
      email: email ?? this.authStatus.username ?? DEMO_USER,
      organisation_id: org.org_id,
      tier_id: tier?.id ?? TIER_STANDARD_ID,
      tier_name: tier?.name ?? "standard",
      billing_frequency: billingFrequency,
      status: "active",
      is_trial: false,
      subscribed_at: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      cancel_at_period_end: false,
      cancelled_at: null,
      stripe_subscription_id: `sub_synth_${randomUUID().slice(0, 8)}`,
      max_connections: tier?.max_connections ?? 32,
      current_connections: this.connections.active_target_ids.length,
      pending_tier_id: null,
      pending_tier_name: null,
    };
    this.subscriptions = this.subscriptions.map((s) =>
      s.organisation_id === org.org_id && s.status === "active" ? { ...s, status: "replaced" } : s
    );
    this.subscriptions.push(record);
    this.authStatus.active_subscriber = true;
    this.connections.max_connections = record.max_connections;
    this.touch();
    return record;
  }

  cancelSubscription(email: string, atPeriodEnd: boolean, orgId?: string): SubscriptionRecord | null {
    const sub = this.currentSubscription(orgId, email);
    if (!sub) {
      return null;
    }
    if (atPeriodEnd) {
      sub.cancel_at_period_end = true;
    } else {
      sub.status = "cancelled";
      sub.cancelled_at = new Date().toISOString();
      this.authStatus.active_subscriber = false;
    }
    this.touch();
    return sub;
  }

  checkoutPayload(record: SubscriptionRecord): Record<string, unknown> {
    return {
      organisation_id: record.organisation_id,
      billing_frequency: record.billing_frequency,
      checkouts: [{
        checkout_url: `https://synthetic.local/pay/${record.id}`,
        session_id: `cs_synth_${record.id.slice(0, 8)}`,
        billing_frequency: record.billing_frequency,
        regenerated: false,
        total_net: 49,
        total_gross: 49,
        subscriptions: [{
          email: record.email,
          account_id: record.account_id,
          subscription_id: record.id,
          tier_name: record.tier_name,
          is_trial: record.is_trial,
          account_created: false,
          invite_sent: false,
        }],
      }],
    };
  }

  findOrgTarget(id: string): OrgTargetRecord | undefined {
    return this.orgTargets.find((t) => t.target_id === id);
  }

  serializeTarget(target: OrgTargetRecord, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const grant = this.targetGrants.find((g) =>
      g.target_id === target.target_id && g.member === (this.authStatus.username ?? DEMO_USER)
    );
    const base: Record<string, unknown> = {
      target_id: target.target_id,
      target_name: target.target_name,
      target_type: target.target_type,
      target_config: target.target_config,
      assigned_at: grant?.assigned_at ?? null,
      active: this.connections.active_target_ids.includes(target.target_id),
      status: { pingable: true, health: "ok" },
      ...extra,
    };

    // AtomOS host picker gates on target_status.{compute,storage,network}.
    if (target.target_type === "atomos_local_ip" || target.target_type === "remote-gateway") {
      base.target_status = {
        compute: true,
        storage: true,
        network: true,
        "atomos-cli": true,
        "atomos-gui": true,
      };
      base.version = {
        compute: "1.0.0-synth",
        storage: "1.0.0-synth",
        network: "1.0.0-synth",
        "atomos-cli": "1.0.0-synth",
        "atomos-gui": "1.0.0-synth",
      };
    } else {
      base.version = { daemon: "synthetic", semver: "1.0.0" };
    }

    return base;
  }

  serializeScenario(scenario: ScenarioRecord): Record<string, unknown> {
    return {
      id: scenario.id,
      name: scenario.name,
      org_id: scenario.org_id,
      pools: scenario.pools,
      users: scenario.users,
      active: scenario.id === this.connections.active_scenario_id,
    };
  }

  grantsMe(): Record<string, unknown> {
    const username = this.authStatus.username ?? DEMO_USER;
    const grantedIds = new Set(
      this.targetGrants.filter((g) => g.member === username).map((g) => g.target_id)
    );
    const targets = this.orgTargets.filter((t) => grantedIds.has(t.target_id));
    const scenarios = this.scenarios.filter((s) => s.users.includes(username) || s.users.length === 0);
    return {
      targets: targets.map((t) => this.serializeTarget(t)),
      scenarios: scenarios.map((s) => this.serializeScenario(s)),
      target_grants: [...grantedIds],
    };
  }

  connectionsMe(): Record<string, unknown> {
    return {
      active_targets: this.activeTargets.map((t) => this.serializeTarget(t)),
      active_connections: this.connections.active_target_ids.length,
      max_connections: this.connections.max_connections,
    };
  }

  activationResponse(): Record<string, unknown> {
    const scenario = this.scenarios.find((s) => s.id === this.connections.active_scenario_id);
    return {
      active_scenario: scenario ? this.serializeScenario(scenario) : null,
      active_target_grants: this.activeTargets.map((t) => this.serializeTarget(t)),
      used_connections: this.connections.active_target_ids.length,
      max_connections: this.connections.max_connections,
    };
  }

  activateTarget(targetId: string): Record<string, unknown> {
    if (!this.findOrgTarget(targetId)) {
      throw new Error("Target not found");
    }
    if (!this.connections.active_target_ids.includes(targetId)) {
      if (this.connections.active_target_ids.length >= this.connections.max_connections
        && this.connections.max_connections !== -1) {
        throw new Error("Connection quota exceeded");
      }
      this.connections.active_target_ids.push(targetId);
    }
    this.touch();
    return this.activationResponse();
  }

  deactivateTarget(targetId: string): Record<string, unknown> {
    this.connections.active_target_ids = this.connections.active_target_ids.filter((id) => id !== targetId);
    this.touch();
    return this.activationResponse();
  }

  activateScenario(scenarioId: string): Record<string, unknown> {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error("Scenario not found");
    }
    for (const s of this.scenarios) {
      s.active = s.id === scenarioId;
    }
    this.connections.active_scenario_id = scenarioId;
    this.connections.active_target_ids = [...scenario.pools];
    this.touch();
    return this.activationResponse();
  }

  createOrgTarget(body: {
    target_name: string;
    target_type?: string;
    target_config?: TargetConfig;
  }): OrgTargetRecord {
    const record: OrgTargetRecord = {
      target_id: randomUUID(),
      target_name: body.target_name,
      target_type: body.target_type ?? "atomos_local_ip",
      target_config: body.target_config ?? { ips: ["192.168.1.50"] },
    };
    this.orgTargets.push(record);
    const username = this.authStatus.username ?? DEMO_USER;
    this.targetGrants.push({
      target_id: record.target_id,
      member: username,
      assigned_at: new Date().toISOString(),
    });
    this.touch();
    return record;
  }

  updateOrgTarget(targetId: string, body: { target_name?: string; target_config?: TargetConfig }): OrgTargetRecord {
    const existing = this.findOrgTarget(targetId);
    if (!existing) {
      throw new Error("Target not found");
    }
    if (body.target_name) {
      existing.target_name = body.target_name;
    }
    if (body.target_config) {
      existing.target_config = { ...existing.target_config, ...body.target_config };
    }
    this.touch();
    return existing;
  }

  deleteOrgTarget(targetId: string): void {
    this.orgTargets = this.orgTargets.filter((t) => t.target_id !== targetId);
    this.targetGrants = this.targetGrants.filter((g) => g.target_id !== targetId);
    this.connections.active_target_ids = this.connections.active_target_ids.filter((id) => id !== targetId);
    for (const scenario of this.scenarios) {
      scenario.pools = scenario.pools.filter((id) => id !== targetId);
    }
    this.touch();
  }

  targetUsage(targetId: string): Record<string, unknown> {
    return {
      holders: this.targetGrants.filter((g) => g.target_id === targetId).map((g) => g.member),
      scenarios: this.scenarios
        .filter((s) => s.pools.includes(targetId))
        .map((s) => ({ id: s.id, name: s.name })),
    };
  }

  assignedTargets(): Record<string, unknown> {
    const byTarget = new Map<string, string[]>();
    for (const grant of this.targetGrants) {
      const users = byTarget.get(grant.target_id) ?? [];
      users.push(grant.member);
      byTarget.set(grant.target_id, users);
    }
    return {
      target_grants: this.orgTargets.map((t) => ({
        ...t,
        users: byTarget.get(t.target_id) ?? [],
      })),
    };
  }

  memberGrants(member: string): Record<string, unknown> {
    const ids = this.targetGrants.filter((g) => g.member === member).map((g) => g.target_id);
    return {
      target_grants: this.orgTargets
        .filter((t) => ids.includes(t.target_id))
        .map((t) => this.serializeTarget(t)),
    };
  }

  assignGrants(member: string, targetIds: string[]): void {
    const now = new Date().toISOString();
    for (const targetId of targetIds) {
      if (!this.targetGrants.some((g) => g.member === member && g.target_id === targetId)) {
        this.targetGrants.push({ target_id: targetId, member, assigned_at: now });
      }
    }
    this.touch();
  }

  unassignGrant(member: string, targetId: string): void {
    this.targetGrants = this.targetGrants.filter((g) => !(g.member === member && g.target_id === targetId));
    this.touch();
  }

  unassignGrants(member: string, targetIds: string[]): void {
    this.targetGrants = this.targetGrants.filter((g) =>
      !(g.member === member && targetIds.includes(g.target_id))
    );
    this.touch();
  }

  createScenario(name: string, pools: string[]): ScenarioRecord {
    const record: ScenarioRecord = {
      id: randomUUID(),
      name,
      org_id: this.authStatus.org_id ?? DEMO_ORG_ID,
      pools,
      users: [this.authStatus.username ?? DEMO_USER],
      active: false,
    };
    this.scenarios.push(record);
    this.touch();
    return record;
  }

  updateScenario(id: string, name?: string, pools?: string[]): ScenarioRecord {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) {
      throw new Error("Scenario not found");
    }
    if (name) {
      scenario.name = name;
    }
    if (pools) {
      scenario.pools = pools;
    }
    this.touch();
    return scenario;
  }

  deleteScenario(id: string): void {
    this.scenarios = this.scenarios.filter((s) => s.id !== id);
    if (this.connections.active_scenario_id === id) {
      this.connections.active_scenario_id = null;
    }
    this.touch();
  }

  grantScenario(id: string, users: string[]): void {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) {
      throw new Error("Scenario not found");
    }
    for (const user of users) {
      if (!scenario.users.includes(user)) {
        scenario.users.push(user);
      }
    }
    this.touch();
  }

  revokeScenario(id: string, member: string): void {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) {
      return;
    }
    scenario.users = scenario.users.filter((u) => u !== member);
    this.touch();
  }

  certForHost(host: string): { fingerprint: string; validated: boolean } {
    const fingerprint = `synthetic:${host}`;
    const trusted = this.waitingCerts[fingerprint]?.trusted ?? true;
    if (!trusted) {
      this.waitingCerts[fingerprint] = { host, trusted: false };
    }
    this.touch();
    return { fingerprint, validated: trusted };
  }

  trustCert(fingerprint: string): boolean {
    const pending = this.waitingCerts[fingerprint];
    if (pending) {
      pending.trusted = true;
      this.touch();
      return true;
    }
    this.waitingCerts[fingerprint] = { host: fingerprint.replace(/^synthetic:/, ""), trusted: true };
    this.touch();
    return true;
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
      license: { key: licenseKey, serial_number: serial, file: content },
    };
  }

  deleteLicense(licenseKey: string): void {
    this.licenses.licenses = this.licenses.licenses.filter((l) => l.license_key !== licenseKey);
    this.touch();
  }

  getBillingTransactions(billingUuid?: string): BillingTransactionRecord[] {
    if (!billingUuid) {
      return [...this.billingTransactions];
    }
    return this.billingTransactions.filter((t) => t.billing_uuid === billingUuid);
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

  lastVmForVolume(volumeId: string): VmRecord | undefined {
    return this.vms.find((vm) => {
      const volumes = (vm.req_json as Record<string, unknown> | undefined)?.volumes;
      return Array.isArray(volumes) && volumes.some((v) =>
        (v as Record<string, unknown>).volumeID === volumeId
        || (v as Record<string, unknown>).name === volumeId
      );
    });
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
    const region = (body.region as string) ?? "fr-par";
    let record: ServiceInstanceRecord;
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
    } else if (
      serviceType === "n8n"
      || serviceType === "openclaw"
      || serviceType === "caddy_ca"
      || serviceType === "hermes"
      || serviceType === "litellm"
      || serviceType === "llmstudio"
      || serviceType === "minio"
      || serviceType === "n8n_runner"
      || serviceType === "npm"
      || serviceType === "openwebui"
      || serviceType === "searxng"
      || serviceType === "hosting"
    ) {
      const vmName = (body.vm_name as string) ?? `${serviceType}-${serviceUuid.slice(0, 6)}`;
      const platform =
        serviceType === "hosting"
          ? String((body.platform as string) ?? "wordpress")
          : undefined;
      record = {
        ...base,
        uniqueID: serviceUuid,
        vm_name: vmName,
        status: "running",
        states: "running",
        region,
        ...(platform ? { platform } : {}),
        req_json: { vm_name: vmName, ...(platform ? { platform } : {}) },
      };
    } else {
      record = { ...base, ...body, status: (body.status as string) ?? "running" };
    }
    this.services.push(record);
    this.billingTransactions.push({
      billing_uuid: billingUuid,
      client_uuid: DEMO_CLIENT_UID,
      organisation_name: this.authStatus.org_name ?? "Elemento Demo",
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
}

export type {
  NetworkRecord,
  PortForwardRecord,
  ServiceInstanceRecord,
  VmRecord,
  VolumeRecord,
} from "./types.js";

