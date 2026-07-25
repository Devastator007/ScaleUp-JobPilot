"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");

test("password fields expose accessible visibility controls", () => {
  assert.equal((html.match(/data-password-toggle=/g) || []).length, 2);
  assert.match(html, /data-password-toggle="auth-password"[^>]+aria-controls="auth-password"/);
  assert.match(html, /data-password-toggle="auth-confirm-password"[^>]+aria-controls="auth-confirm-password"/);
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 2);
  assert.match(html, /id="auth-password"[^>]+autocomplete="current-password"/);
  assert.match(html, /id="auth-confirm-password"[^>]+autocomplete="new-password"/);
});

test("visibility controls update input and assistive state", () => {
  assert.match(app, /function togglePasswordVisibility\(button\)/);
  assert.match(app, /input\.type = visible \? "text" : "password"/);
  assert.match(app, /button\.setAttribute\("aria-pressed", String\(visible\)\)/);
  assert.match(app, /function resetPasswordVisibility\(\)/);
  assert.match(app, /els\.authPasswordWrap\.classList\.toggle\("hidden", !needsPassword\)/);
  assert.doesNotMatch(app, /els\.authPassword\.parentElement\.classList\.toggle/);
});

test("password toggle styling preserves focus visibility", () => {
  assert.match(css, /\.password-field\s*\{[\s\S]*position: relative/);
  assert.match(css, /\.password-toggle:focus-visible\s*\{[\s\S]*outline:/);
});
