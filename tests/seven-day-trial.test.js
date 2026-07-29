"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const migration = read("supabase/migrations/007_jobpilot_seven_day_trial.sql");

test("backend grants exactly seven days from immutable auth creation", () => {
  assert.match(migration, /from auth\.users/);
  assert.match(migration, /created_at \+ interval '7 days' > now\(\)/);
  assert.doesNotMatch(migration, /profiles[\s\S]*created_at \+ interval '7 days'/);
});

test("paid access remains approved and future-dated", () => {
  assert.match(migration, /lower\(status\) in \('active', 'approved'\)/);
  assert.match(migration, /current_period_end > now\(\)/);
});

test("only the requested owner email bypasses trial expiry", () => {
  assert.match(migration, /lower\(email\) = 'ahmed_hamdy_mahdy@outlook\.com'/);
  assert.match(app, /const OWNER_EMAIL = "ahmed_hamdy_mahdy@outlook\.com"/);
  assert.match(app, /if \(isOwnerAccount\(\)\) return true/);
});

test("frontend mirrors trial expiry and presents payment activation", () => {
  assert.match(app, /const TRIAL_DURATION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(app, /function trialExpiresAt\(\)/);
  assert.match(app, /Your seven-day JobPilot trial has expired/);
});

test("Candidate Setup includes browser assistant installation notes", () => {
  assert.match(app, /Browser Assistant installation notes/);
  assert.match(app, /chrome:\/\/extensions/);
  assert.match(app, /edge:\/\/extensions/);
  assert.match(app, /Load unpacked/);
  assert.match(app, /Review every answer before submitting/);
});
