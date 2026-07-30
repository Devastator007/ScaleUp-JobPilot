"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "browser-assistant", "manifest.json"), "utf8"));
const popupHtml = fs.readFileSync(path.join(root, "browser-assistant", "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "browser-assistant", "popup.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "browser-assistant", "README.md"), "utf8");

test("Browser Assistant no longer requests access to every HTTPS site", () => {
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
  assert.ok(!manifest.content_scripts.some((entry) => entry.matches.includes("https://*/*")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("linkedin.com/jobs")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("greenhouse.io")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("lever.co")));
});

test("Browser Assistant is review-only and cannot request final submission", () => {
  assert.doesNotMatch(popupHtml, /id="submit"|Fill and submit/i);
  assert.doesNotMatch(popupJs, /run\(true\)|submitButton|submit:\s*true/);
  assert.match(popupJs, /submit:\s*false/);
  assert.match(readme, /never clicks the final application-submission button/i);
});

test("Safety release keeps credential and high-risk field exclusions explicit", () => {
  assert.match(readme, /No job-board password is requested or stored/);
  assert.match(readme, /CAPTCHA, assessments, consent, declarations/);
  assert.equal(manifest.version, "1.3.0");
});
