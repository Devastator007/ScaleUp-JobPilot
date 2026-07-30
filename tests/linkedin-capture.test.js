const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const popup = fs.readFileSync(path.join(root, "browser-assistant", "popup.js"), "utf8");
const content = fs.readFileSync(path.join(root, "browser-assistant", "content.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "browser-assistant", "manifest.json"), "utf8"));

test("Browser Assistant captures only visible LinkedIn job cards on explicit request", () => {
  assert.match(popup, /jobpilot:capture-linkedin/);
  assert.match(content, /function captureLinkedInJobs/);
  assert.ok(content.includes("a[href*='/jobs/view/']"));
  assert.match(content, /source_key: `linkedin:\$\{id\}`/);
  assert.doesNotMatch(content + popup, /linkedin_password|document\.cookie|fetch\([^)]*linkedin/i);
});

test("JobPilot imports captured jobs as deduplicated outside-portal actions", () => {
  assert.match(app, /jobpilot-linkedin-import/);
  assert.match(app, /onConflict: "user_id,source_key"/);
  assert.match(app, /action_status: "candidate_action_required"/);
  assert.match(app, /application_route: "outside_portal"/);
  assert.equal(manifest.version, "1.2.0");
});
