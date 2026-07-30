"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const manifest = JSON.parse(read("browser-assistant/manifest.json"));
const content = read("browser-assistant/content.js");
const popup = read("browser-assistant/popup.js");
const workflow = read(".github/workflows/pages.yml");

test("Candidate Setup can sync a CV-derived answer pack to the extension", () => {
  assert.match(app, /id="sync-browser-assistant"/);
  assert.match(app, /bridge\.id = "jobpilot-extension-payload"/);
  assert.match(app, /jobpilot-sync-candidate/);
  assert.match(app, /jobpilot-sync-complete/);
  assert.match(app, /jobpilot-candidate-setup/);
  assert.match(app, /resume_summary/);
  assert.match(content, /chrome\.storage\.local\.set\(\{ candidateSetup \}\)/);
  assert.match(content, /localStorage\.getItem\("jobpilot-candidate-setup"\)/);
  assert.match(content, /function isTrustedJobPilotPage\(\)/);
  assert.match(content, /location\.hostname === "devastator007\.github\.io"/);
  assert.match(content, /location\.hostname === "scaleuptech\.org"/);
});

test("assistant inspects visible fields and maps common questions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "storage"]);
  assert.match(content, /querySelectorAll\("input, textarea, select"\)/);
  assert.match(content, /work\.\?authori\[sz\]ation/);
  assert.match(content, /years\?.*\(experience\)/);
  assert.match(content, /cover\.\?letter/);
  assert.match(content, /educationAnswer/);
  assert.match(content, /willing_to_commute/);
  assert.match(content, /willing_to_relocate/);
  assert.match(content, /type === "radio"/);
  assert.match(content, /field\.click\(\)/);
  assert.match(content, /setNativeValue/);
});

test("assistant is review-only and fail-closed on risky actions", () => {
  assert.doesNotMatch(popup, /run\(true\)|submitButton|submit:\s*true/);
  assert.match(popup, /submit:\s*false/);
  assert.match(content, /CAPTCHA/);
  assert.match(content, /Assessment/);
  assert.match(content, /Consent or declaration requires review/);
  assert.match(content, /input\[type='file'\]/);
  assert.doesNotMatch(content, /input\[type=['"]password/);
});

test("Pages packages and verifies the downloadable extension", () => {
  assert.match(workflow, /jobpilot-browser-assistant\.zip/);
  assert.match(workflow, /assistant_status/);
});
