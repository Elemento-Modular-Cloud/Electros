/**
 * Regenerates portal identity fixtures: auth status, orgs, scopes, account, tiers, subscriptions.
 *
 * Usage: node scripts/generate-portal-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "default");

const DEMO_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEMO_SUBORG_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DEMO_CLIENT_UID = "00000000-0000-4000-8000-000000000001";
const DEMO_USER = "demo@synthetic.local";
const DEMO_TOKEN = "synthetic-authz-token";
const DEMO_ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
const TIER_STANDARD_ID = "11111111-1111-4111-8111-111111111111";
const TIER_PRO_ID = "22222222-2222-4222-8222-222222222222";
const SUBSCRIPTION_ID = "33333333-3333-4333-8333-333333333333";

const UNLIMITED_LIMITS = {
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

const authStatus = {
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
};

const orgs = [
  {
    org_id: DEMO_ORG_ID,
    org_name: "Elemento Demo",
    owner: DEMO_USER,
    admins: [DEMO_USER],
    members: [DEMO_USER, "alice@synthetic.local", "bob@synthetic.local"],
    preferred: true,
    limits: UNLIMITED_LIMITS,
    suborgs: [
      {
        suborg_id: DEMO_SUBORG_ID,
        suborg_name: "Platform team",
        admins: [DEMO_USER],
        members: [DEMO_USER, "alice@synthetic.local"],
        inner_suborgs: [],
        limits: UNLIMITED_LIMITS,
      },
    ],
  },
];

const scopes = {
  username: DEMO_USER,
  scopes: [
    {
      org_id: DEMO_ORG_ID,
      org_name: "Elemento Demo",
      suborg: null,
      member: true,
      selectable: true,
      reason: null,
      preferred: true,
      role: "ORGOWNER",
      is_trial: false,
      suborgs: [
        {
          org_id: DEMO_ORG_ID,
          org_name: "Elemento Demo",
          suborg_id: DEMO_SUBORG_ID,
          suborg_name: "Platform team",
          role: "SUBORGADMIN",
          selectable: true,
        },
      ],
    },
  ],
};

const accountDetails = {
  fiscal_code: "RSSMRA80A01H501U",
  vat_code: "IT12345678901",
  company_name: "Elemento Demo S.r.l.",
  full_address: "Via Cloud 1",
  zip_code: "20100",
  city: "Milan",
  province: "MI",
  sdi_code: "0000000",
  nationality: "IT",
  preferences: { marketing_emails: false, lang: "en" },
};

const invites = [
  {
    id: "66666666-6666-4666-8666-666666666666",
    invited_email: "charlie@synthetic.local",
    org_id: DEMO_ORG_ID,
    org_name: "Elemento Demo",
    suborg_name: null,
    status: "pending",
    created_at: "2026-03-01T09:00:00.000Z",
    invited_by_email: DEMO_USER,
    token: "invite-token-charlie",
  },
];

const tiers = [
  {
    id: TIER_STANDARD_ID,
    name: "standard",
    price_monthly: 49,
    price_yearly: 490,
    currency: "EUR",
    max_connections: 8,
    limits: {},
    feature: {},
    public: true,
    active: true,
    level: 1,
  },
  {
    id: TIER_PRO_ID,
    name: "pro",
    price_monthly: 149,
    price_yearly: 1490,
    currency: "EUR",
    max_connections: 32,
    limits: {},
    feature: {},
    public: true,
    active: true,
    level: 2,
  },
];

const subscriptions = [
  {
    id: SUBSCRIPTION_ID,
    account_id: DEMO_ACCOUNT_ID,
    email: DEMO_USER,
    organisation_id: DEMO_ORG_ID,
    tier_id: TIER_PRO_ID,
    tier_name: "pro",
    billing_frequency: "yearly",
    status: "active",
    is_trial: false,
    subscribed_at: "2026-01-01T00:00:00.000Z",
    current_period_end: "2027-01-01T00:00:00.000Z",
    cancel_at_period_end: false,
    cancelled_at: null,
    stripe_subscription_id: "sub_synth_pro",
    max_connections: 32,
    current_connections: 0,
    pending_tier_id: null,
    pending_tier_name: null,
  },
];

function write(name, data) {
  writeFileSync(join(FIXTURES_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
}

write("auth-status.json", authStatus);
write("orgs.json", orgs);
write("scopes.json", scopes);
write("account-details.json", accountDetails);
write("invites.json", invites);
write("tiers.json", tiers);
write("subscriptions.json", subscriptions);

console.log("Wrote portal identity fixtures (auth, orgs, scopes, account, invites, tiers, subscriptions)");
