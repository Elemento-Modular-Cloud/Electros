/**
 * Regenerates fixtures/default/licenses.json for Settings → Licenses.
 *
 * Usage: node scripts/generate-licenses-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "fixtures", "default", "licenses.json");

const COUNT = 15;
const RESELLERS = ["Elemento Direct", "Acme Cloud Reseller", "Meson Partner EU", null];
const TIERS = ["standard", "professional", "enterprise"];

function padKey(n) {
  const a = String(n).padStart(4, "0");
  const b = String(1000 + n).padStart(4, "0");
  const c = String(2000 + n).padStart(4, "0");
  return `SYNTH-${a}-ELEC-${b}-${c}`;
}

function unixDaysFromNow(days) {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

/** @type {Record<string, unknown>[]} */
const licenses = [];

for (let i = 0; i < COUNT; i++) {
  const n = i + 1;
  let expire;
  let isArmed = false;
  const duration = [30, 90, 180, 365, 730, 1095][i % 6];

  if (i % 5 === 0) {
    isArmed = true;
    expire = unixDaysFromNow(180 + (i % 4) * 30);
  } else if (i % 5 === 1) {
    expire = unixDaysFromNow(-(10 + i));
  } else if (i % 5 === 2) {
    expire = unixDaysFromNow(7 + (i % 14));
  } else if (i % 5 === 3) {
    expire = unixDaysFromNow(400 + i * 20);
  } else {
    expire = undefined;
  }

  const reseller = RESELLERS[i % RESELLERS.length];
  const entry = {
    license_key: padKey(n),
    is_armed: isArmed,
    hmac: `synthetic-hmac-${n.toString(16).padStart(32, "0").slice(0, 32)}`,
    duration,
    support_json: {
      tier: TIERS[i % TIERS.length],
      email: "support@synthetic.local",
      docs: "https://docs.elemento.cloud/licenses",
    },
  };

  if (expire !== undefined) {
    entry.expire = expire;
  }
  if (reseller) {
    entry.reseller_entity = reseller;
  }

  licenses.push(entry);
}

writeFileSync(OUT, `${JSON.stringify({ licenses }, null, 2)}\n`);
console.log(`Wrote ${licenses.length} licenses to ${OUT}`);
console.log(
  "Breakdown:",
  licenses.filter((l) => l.is_armed).length,
  "armed,",
  licenses.filter((l) => l.expire !== undefined && l.expire < Math.floor(Date.now() / 1000)).length,
  "expired (by expire),",
  licenses.filter((l) => !l.is_armed && l.expire === undefined).length,
  "inactive (no expire)"
);
