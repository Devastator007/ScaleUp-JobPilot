const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "account-links.js"), "utf8");

test("loads the customer account linking module and styles", () => {
  assert.match(html, /account-links\.css/);
  assert.match(html, /account-links\.js/);
});

test("supports Google OAuth sign-in and identity linking", () => {
  assert.match(script, /signInWithOAuth/);
  assert.match(script, /linkIdentity/);
  assert.match(script, /provider:\s*["']google["']/);
  assert.match(script, /redirectTo:\s*redirectUrl\(\)/);
});

test("does not request or store job-board passwords", () => {
  assert.match(script, /does not collect or store job-board passwords/i);
  assert.doesNotMatch(script, /linkedin_password|indeed_password|job_board_password/i);
});
