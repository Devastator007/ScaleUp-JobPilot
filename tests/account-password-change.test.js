"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function loadPasswordPolicy() {
  const match = app.match(/function passwordPolicyError\(password\) \{[\s\S]*?\n\}/);
  assert.ok(match, "passwordPolicyError must exist");
  return vm.runInNewContext(`(${match[0]})`);
}

test("Account renders confirmed accessible password controls", () => {
  assert.match(app, /id="account-password-form"/);
  assert.match(app, /id="account-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/);
  assert.match(app, /id="account-confirm-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/);
  assert.match(app, /data-password-toggle="account-new-password"/);
  assert.match(app, /data-password-toggle="account-confirm-password"/);
  assert.match(app, /id="account-password-message" class="form-message" aria-live="polite"/);
});

test("Account password change enforces policy and confirmation before Supabase update", () => {
  const validate = loadPasswordPolicy();
  assert.equal(validate("SecurePass123"), "");
  assert.equal(validate("كلمةمرورآمنة١٢٣"), "");
  assert.notEqual(validate("weakpass"), "");
  assert.match(app, /const policyError = passwordPolicyError\(password\.value\)/);
  assert.match(app, /if \(password\.value !== confirmation\.value\)/);
  assert.match(app, /supabaseClient\.auth\.updateUser\(\{ password: password\.value \}\)/);
});

test("Dynamic account controls are bound without altering existing sign-in behavior", () => {
  assert.match(app, /accountPasswordForm\.addEventListener\("submit", changeAccountPassword\)/);
  assert.match(app, /#account-password-form \[data-password-toggle\]/);
  assert.match(app, /supabaseClient\.auth\.signInWithPassword/);
  assert.match(app, /message\.textContent = "Password changed successfully\."/);
});
