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

test("Jobs contains discovered opportunities without duplicate manual entry", () => {
  assert.match(app, /<h2>Discovered jobs<\/h2>/);
  assert.match(app, /Complete Candidate Setup, then use Find Jobs/);
  assert.doesNotMatch(app, /id="job-form"/);
  assert.doesNotMatch(app, /function saveJob\(/);
  assert.doesNotMatch(app, /data-add-job/);
  assert.doesNotMatch(html, /id="new-job-btn"/);
  assert.doesNotMatch(html, />Add job</);
});

test("discovered Jobs view remains entitlement-gated and JavaScript parses", () => {
  assert.match(app, /const disabled = !active && button\.dataset\.view !== "billing"/);
  new vm.Script(app);
});
