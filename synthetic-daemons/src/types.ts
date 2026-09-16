export interface Limits {
  max_vms: number;
  max_slots: number;
  max_ram_mib: number;
  max_storage_gb: number;
  max_networks: number;
  max_global_networks: number;
  max_local_networks: number;
  max_networks_per_driver: Record<string, number>;
  cancreate_net_local: boolean;
  cancreate_net_global: boolean;
  cancreate_net_dhcp: boolean;
  cancreate_net_nat: boolean;
  cancreate_net_bridge: boolean;
  cancreate_net_isolated: boolean;
  cancreate_net_fully_isolated: boolean;
  cancreate_net_with_static_routes: boolean;
}

export const UNLIMITED_LIMITS: Limits = {
  max_vms: -1,
  max_slots: -1,
  max_ram_mib: -1,
  max_storage_gb: -1,
  max_networks: -1,
  max_global_networks: -1,
  max_local_networks: -1,
  max_networks_per_driver: {},
  cancreate_net_local: true,
  cancreate_net_global: true,
  cancreate_net_dhcp: true,
  cancreate_net_nat: true,
  cancreate_net_bridge: true,
  cancreate_net_isolated: true,
  cancreate_net_fully_isolated: true,
  cancreate_net_with_static_routes: true,
};

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  org_id?: string | null;
  org_name?: string | null;
  suborg_id?: string | null;
  suborg_name?: string | null;
  role?: string | null;
  limits?: Limits | null;
  client_uid?: string | null;
  authz_token?: string | null;
  active_subscriber?: boolean;
  email_verified?: boolean;
}

export interface SubOrgScope {
  org_id: string;
  org_name: string;
  suborg_id: string;
  suborg_name: string;
  role: string;
  selectable: boolean;
}

export interface OrgScope {
  org_id: string;
  org_name: string;
  suborg: string | null;
  member: boolean;
  selectable: boolean;
  reason: string | null;
  preferred: boolean | null;
  role: string | null;
  suborgs: SubOrgScope[];
  is_trial: boolean;
}

export interface ScopesModel {
  username: string;
  scopes: OrgScope[];
}

export interface AccountDetails {
  fiscal_code: string | null;
  vat_code: string | null;
  company_name: string | null;
  full_address: string;
  zip_code: string;
  city: string;
  province: string;
  sdi_code: string | null;
  nationality: string;
  preferences: Record<string, unknown>;
}

export interface SubOrgRecord {
  suborg_id: string;
  suborg_name: string;
  admins: string[];
  members: string[];
  inner_suborgs: SubOrgRecord[];
  limits: Limits;
}

export interface OrgRecord {
  org_id: string;
  org_name: string;
  owner: string;
  admins: string[];
  members: string[];
  suborgs: SubOrgRecord[];
  limits: Limits;
  preferred: boolean;
}

export interface InviteRecord {
  id: string;
  invited_email: string;
  org_id: string;
  org_name: string;
  suborg_name: string | null;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  invited_by_email: string;
  token: string;
}

export interface TargetConfig {
  ips?: string[];
  provider?: string;
  meson_ip?: string;
  meson_credentials?: { username?: string; password?: string };
  host?: string;
  user?: string;
  password?: string;
  verify_ssl?: boolean;
  [key: string]: unknown;
}

export interface OrgTargetRecord {
  target_id: string;
  target_name: string;
  target_type: string;
  target_config: TargetConfig;
}

export interface TargetGrantRecord {
  target_id: string;
  member: string;
  assigned_at: string;
}

export interface ScenarioRecord {
  id: string;
  name: string;
  org_id: string;
  pools: string[];
  users: string[];
  active: boolean;
}

export interface ConnectionsState {
  active_target_ids: string[];
  active_scenario_id: string | null;
  max_connections: number;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_connections: number;
  limits: Record<string, unknown>;
  feature: Record<string, unknown>;
  public: boolean;
  active: boolean;
  level: number;
}

export interface SubscriptionRecord {
  id: string;
  account_id: string;
  email: string;
  organisation_id: string;
  tier_id: string;
  tier_name: string;
  billing_frequency: string;
  status: string;
  is_trial: boolean;
  subscribed_at: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  stripe_subscription_id: string | null;
  max_connections: number;
  current_connections: number;
  pending_tier_id: string | null;
  pending_tier_name: string | null;
}

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

export type VmRecord = Record<string, unknown>;
export type VolumeRecord = Record<string, unknown>;
export type NetworkRecord = Record<string, unknown>;
export type TemplateRecord = Record<string, unknown>;
export type PortForwardRecord = Record<string, unknown>;
export type ServiceInstanceRecord = Record<string, unknown>;
export type BillingTransactionRecord = Record<string, unknown>;

export const DEMO_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const DEMO_SUBORG_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
export const DEMO_CLIENT_UID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER = "demo@synthetic.local";
export const DEMO_TOKEN = "synthetic-authz-token";
export const DEMO_ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
export const TIER_STANDARD_ID = "11111111-1111-4111-8111-111111111111";
export const TIER_PRO_ID = "22222222-2222-4222-8222-222222222222";
export const SUBSCRIPTION_ID = "33333333-3333-4333-8333-333333333333";
export const SCENARIO_LAB_ID = "44444444-4444-4444-8444-444444444444";
