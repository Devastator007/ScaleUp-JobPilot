const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("Candidate Setup provides persistent, accessible save feedback", () => {
  assert.match(app, /id="profile-save-button"/);
  assert.match(app, /id="profile-save-message" class="form-message" role="status" aria-live="polite"/);
  assert.match(app, /saveButton\.disabled = true/);
  assert.match(app, /Candidate setup saved successfully\./);
  assert.match(app, /Could not save Candidate Setup:/);
});

test("Candidate Setup treats an empty RLS update as a save failure", () => {
  assert.match(app, /\.maybeSingle\(\)/);
  assert.match(app, /if \(!data\) throw new Error/);
});
