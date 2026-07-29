"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/004_unify_candidate_search_workflow.sql"), "utf8");
const searchFunction = fs.readFileSync(path.join(root, "supabase/functions/search-jobs/index.ts"), "utf8");

test("Candidate Setup is the single source of search and application criteria", () => {
  assert.match(html, />Find Jobs</);
  assert.doesNotMatch(html, />Search Plans</);
  assert.match(app, /job_preferences:/);
  assert.match(app, /application_answers:/);
  assert.match(app, /name="profile-platform"/);
  assert.doesNotMatch(app, /<h2>Create search\/apply setup<\/h2>/);
});

test("search uses an authenticated Edge Function and deduplicated source jobs", () => {
  assert.match(app, /functions\.invoke\("search-jobs"/);
  assert.match(searchFunction, /auth\.getUser\(token\)/);
  assert.match(searchFunction, /verify|Unauthorized/);
  assert.match(searchFunction, /source_key/);
  assert.match(migration, /unique index[\s\S]*idx_jobs_user_source_key/i);
});

test("outside portals require candidate action and never claim automatic submission", () => {
  assert.match(app, /Candidate action required/);
  assert.match(app, /Open outside portal/);
  assert.match(searchFunction, /action_status:\s*"candidate_action_required"/);
  assert.match(searchFunction, /application_route:\s*"outside_portal"/);
  assert.match(searchFunction, /Answers prepared from Candidate Setup/);
  assert.doesNotMatch(searchFunction, /status:\s*"submitted"/);
});

test("application preparation never stores third-party portal credentials", () => {
  assert.doesNotMatch(app + searchFunction + migration, /linkedin_password|indeed_password|portal_password/i);
  assert.match(migration, /application_answers jsonb/);
  assert.match(migration, /answer_pack jsonb/);
});
