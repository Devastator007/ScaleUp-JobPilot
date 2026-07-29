const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("signup success does not falsely guarantee account creation or email delivery", () => {
  assert.doesNotMatch(script, /Account created\. Please check your email/);
  assert.match(script, /data\.user\?\.identities/);
  assert.match(script, /data\.user\.identities\.length === 0/);
  assert.match(script, /An account already exists for this email/);
  assert.match(script, /Registration received\. Check your inbox and spam folder/);
});

test("signed-out users can safely request another confirmation email", () => {
  assert.match(html, /id="resend-confirmation-btn"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(script, /supabaseClient\.auth\.resend\(\{/);
  assert.match(script, /type:\s*"signup"/);
  assert.match(script, /emailRedirectTo:\s*authRedirectUrl\(\)/);
  assert.match(script, /If this address has an unconfirmed account/);
});
