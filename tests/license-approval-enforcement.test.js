"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/002_enforce_license_approval.sql");
const app = read("app.js");

test("browser profile creation cannot activate a paid license", () => {
  assert.match(migration, /if auth\.role\(\) = 'authenticated'/);
  assert.match(migration, /new\.plan := 'trial'/);
  assert.match(migration, /new\.license_status := 'trial'/);
  assert.match(migration, /before insert or update on public\.profiles/);
});

test("authenticated users cannot change existing plan or license values", () => {
  assert.match(migration, /new\.plan := old\.plan/);
  assert.match(migration, /new\.license_status := old\.license_status/);
  assert.match(migration, /service-role admin workflows may approve manual payments/i);
});

test("regression documents the unsafe client payload still neutralized by the database", () => {
  assert.match(app, /license_status:\s*"active"/);
  assert.match(migration, /trg_profiles_enforce_license_approval/);
});
