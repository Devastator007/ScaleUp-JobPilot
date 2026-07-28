"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function loadPasswordPolicy() {
  const match = app.match(/function passwordPolicyError\(password\) \{[\s\S]*?\n\}/);
  assert.ok(match, "passwordPolicyError must exist");
  return vm.runInNewContext(`(${match[0]})`);
}

test("new passwords require 12 to 128 characters with letters and numbers", () => {
  const validate = loadPasswordPolicy();
  assert.equal(validate("short1"), "Password must be 12 to 128 characters.");
  assert.equal(validate("abcdefghijkl"), "Password must include at least one letter and one number.");
  assert.equal(validate("123456789012"), "Password must include at least one letter and one number.");
  assert.equal(validate("SecurePass123"), "");
  assert.equal(validate("كلمةمرورآمنة١٢٣"), "");
  assert.equal(validate("A1" + "x".repeat(126)), "");
  assert.equal(validate("A1" + "x".repeat(127)), "Password must be 12 to 128 characters.");
});

test("signup and recovery enforce the policy without blocking existing sign-in passwords", () => {
  assert.match(app, /const requiresNewPassword = mode === "signup" \|\| mode === "recovery"/);
  assert.match(app, /input\.setAttribute\("minlength", "12"\)/);
  assert.match(app, /input\.setAttribute\("maxlength", "128"\)/);
  assert.match(app, /input\.removeAttribute\("minlength"\)/);
  assert.match(app, /input\.removeAttribute\("maxlength"\)/);
  assert.doesNotMatch(html, /minlength="6"/);
  assert.doesNotMatch(html, /maxlength="128"/);
});

test("confirmation remains mandatory for every new password", () => {
  assert.match(app, /const needsConfirm = mode === "signup" \|\| mode === "recovery"/);
  assert.match(app, /els\.authConfirmPassword\.required = needsConfirm/);
  assert.match(app, /if \(els\.authPassword\.value !== els\.authConfirmPassword\.value\)/);
});
