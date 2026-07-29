"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/search-jobs/index.ts"), "utf8");
const grants = fs.readFileSync(path.join(root, "supabase/migrations/006_restore_profile_write_grants.sql"), "utf8");

test("Pipeline reports scraped jobs and candidate actions", () => {
  assert.match(app, /metric\("Jobs scraped", scraped\)/);
  assert.match(app, /job\.source_key/);
  assert.match(app, /metric\("Candidate action", candidateActions\)/);
});

test("Candidate Setup offers persistent automatic search intervals", () => {
  assert.match(app, /id="profile-auto-search-interval"/);
  assert.match(app, /auto_search_interval_hours/);
  assert.match(app, /last_search_at/);
  assert.match(app, /function scheduleAutoSearch\(\)/);
  assert.match(app, /setTimeout\(\(\) => startSearch\(\{ automatic: true \}\), delay\)/);
});

test("auto apply prepares outside-portal answers without false submission", () => {
  assert.match(app, /value="auto_apply"/);
  assert.match(app, /Auto apply where supported/);
  assert.match(edge, /\["auto_apply", "auto_prepare"\]\.includes/);
  assert.match(edge, /status:\s*"candidate_action_required"/);
  assert.doesNotMatch(edge, /status:\s*"submitted"/);
});

test("authenticated profile writes have table grants and remain RLS-owned", () => {
  assert.match(grants, /grant select, insert, update on table public\.profiles to authenticated/);
  assert.match(grants, /RLS policies restrict every operation to the owning user/);
});
