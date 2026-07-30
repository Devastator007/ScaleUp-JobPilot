"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "browser-assistant", "manifest.json"), "utf8"));
const popupHtml = fs.readFileSync(path.join(root, "browser-assistant", "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "browser-assistant", "popup.js"), "utf8");
const content = fs.readFileSync(path.join(root, "browser-assistant", "content.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "browser-assistant", "README.md"), "utf8");

test("Browser Assistant does not request access to every HTTPS site", () => {
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
  assert.ok(!manifest.content_scripts.some((entry) => entry.matches.includes("https://*/*")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("linkedin.com/jobs")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("greenhouse.io")));
  assert.ok(manifest.host_permissions.some((entry) => entry.includes("lever.co")));
});

test("Browser Assistant exposes explicit review and safe auto-submit modes", () => {
  assert.match(popupHtml, /value="review"/);
  assert.match(popupHtml, /value="auto"/);
  assert.match(popupHtml, /Auto-submit when safe/i);
  assert.match(popupJs, /selectedMode === "auto"/);
  assert.match(popupJs, /applicationMode/);
  assert.match(content, /shouldSubmit && !blockers\.length && !unresolved\.length/);
  assert.match(content, /candidates\.length === 1/);
  assert.match(readme, /explicit candidate mode selection/i);
});

test("Safety release keeps credential and high-risk exclusions explicit", () => {
  assert.match(readme, /No job-board password is requested or stored/);
  assert.match(readme, /CAPTCHA, assessments, consent, declarations/);
  assert.match(content, /No unambiguous submit button was found/);
  assert.equal(manifest.version, "1.4.0");
});
