"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const migration = read("supabase/migrations/003_enforce_entitlement_expiry.sql");
const readme = read("README.md");

test("browser profile defaults remain unlicensed", () => {
  assert.match(app, /plan:\s*"trial"/);
  assert.match(app, /license_status:\s*"trial"/);
  assert.doesNotMatch(app, /license_status:\s*"active"/);
  assert.doesNotMatch(app, /toLowerCase\(\) === "trial" \? "active"/);
});

test("active access requires approved status and future subscription expiry", () => {
  assert.match(migration, /lower\(status\) in \('active', 'approved'\)/);
  assert.match(migration, /current_period_end is not null/);
  assert.match(migration, /current_period_end > now\(\)/);
  assert.match(app, /expiresAt\.getTime\(\) > Date\.now\(\)/);
  assert.match(app, /return "expired"/);
});

test("customer workspace policies require the entitlement function", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.has_active_jobpilot_access\(\) from public/);
  assert.match(migration, /grant execute on function public\.has_active_jobpilot_access\(\) to authenticated/);
  const policyUses = migration.match(/public\.has_active_jobpilot_access\(\)/g) || [];
  assert.ok(policyUses.length >= 15, `expected entitlement enforcement across workspace policies, found ${policyUses.length}`);
});

test("inactive customers are routed to manual activation instead of the workspace", () => {
  assert.match(app, /if \(!active\) state\.view = "billing"/);
  assert.match(app, /if \(!hasActiveAccess\(\)\)/);
  assert.match(app, /manual InstaPay or bank-transfer verification/);
  assert.match(app, /button\.disabled = disabled/);
});

test("manual payment documentation includes ordered deployment and expiry", () => {
  assert.match(readme, /003_enforce_entitlement_expiry\.sql/);
  assert.match(readme, /InstaPay\/bank-transfer/i);
  assert.match(readme, /future `current_period_end`/);
  assert.doesNotMatch(readme, /Stripe Payment Link|Stripe webhook/i);
});

test("application JavaScript remains syntactically valid", () => {
  assert.doesNotThrow(() => new Function(app));
});
