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

test("distinguishes verified email from an unconfirmed address", () => {
  assert.match(script, /Boolean\(user\.email_confirmed_at\)/);
  assert.match(script, /Confirmation required/);
  assert.match(script, /data-resend-confirmation/);
  assert.match(script, /client\.auth\.resend\(\{/);
  assert.match(script, /type:\s*"signup"/);
  assert.match(script, /emailRedirectTo:\s*redirectUrl\(\)/);
  assert.match(script, /aria-live="polite"/);
  assert.doesNotMatch(script, /emailLinked \? "Connected"/);
});

test("does not request or store job-board passwords", () => {
  assert.match(script, /does not collect or store job-board passwords/i);
  assert.doesNotMatch(script, /linkedin_password|indeed_password|job_board_password/i);
});

test("Pages publishes and live-verifies account-linking assets", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
  assert.match(workflow, /cp index\.html styles\.css app\.js config\.js account-links\.js account-links\.css _site\//);
  assert.match(workflow, /account_script_status=.*account-links\.js/);
  assert.match(workflow, /account_styles_status=.*account-links\.css/);
  assert.match(workflow, /grep -q "signInWithOAuth".*jobpilot-account-links\.js/);
  assert.match(workflow, /grep -q "linkIdentity".*jobpilot-account-links\.js/);
  assert.match(workflow, /grep -q "client\.auth\.resend".*jobpilot-account-links\.js/);
  assert.match(workflow, /grep -q "\\\\.connected-accounts-panel".*jobpilot-account-links\.css/);
});
