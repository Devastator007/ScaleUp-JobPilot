"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("live app uses the authenticated search function instead of unavailable PHP", () => {
  assert.doesNotMatch(app, /jobpilot-search\.php/);
  assert.match(app, /supabaseClient\.functions\.invoke\("search-jobs"/);
  assert.doesNotMatch(html, />Run search</);
});

test("paid workspace provides a complete manual job entry form", () => {
  for (const id of [
    "job-form",
    "job-title",
    "job-company",
    "job-platform",
    "job-status",
    "job-location",
    "job-url",
    "job-notes",
    "job-score",
    "job-form-result"
  ]) {
    assert.match(app, new RegExp(`id="${id}"`));
  }
  assert.match(app, /supabaseClient\.from\("jobs"\)\.insert\(payload\)/);
  assert.match(app, /user_id: state\.user\.id/);
  assert.match(app, /match_score: parseNullableInt/);
  assert.match(app, /aria-live="polite"/);
});

test("manual entry remains entitlement-gated and application JavaScript parses", () => {
  assert.match(app, /function openJobEntry\(\)[\s\S]*if \(!hasActiveAccess\(\)\)/);
  assert.match(app, /els\.newJobBtn\.addEventListener\("click", openJobEntry\)/);
  assert.match(html, />Add job</);
  new vm.Script(app);
});
