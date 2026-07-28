const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const sdkUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/dist/umd/supabase.js";
const sdkIntegrity =
  "sha384-6foGJ1oz/y3anEo0BXRtTgBK1GvpnR0GbJZb0ijG+nBAJ4rYT+VqlD/9e3CSiFIA";

test("pins the Supabase browser SDK to an exact vetted release", () => {
  assert.ok(html.includes(`src="${sdkUrl}"`));
  assert.doesNotMatch(html, /@supabase\/supabase-js@(?:2|latest)(?:["\x27/])/);
});

test("protects the cross-origin SDK with subresource integrity", () => {
  assert.ok(html.includes(`integrity="${sdkIntegrity}"`));
  assert.ok(html.includes('crossorigin="anonymous"'));
  const digest = Buffer.from(sdkIntegrity.slice("sha384-".length), "base64");
  assert.equal(digest.length, 48, "SHA-384 integrity value must decode to 48 bytes");
});

test("loads the authenticated SDK before application configuration", () => {
  const sdkPosition = html.indexOf(sdkUrl);
  const configPosition = html.indexOf('src="./config.js"');
  const appPosition = html.indexOf('src="./app.js"');

  assert.ok(sdkPosition >= 0);
  assert.ok(sdkPosition < configPosition);
  assert.ok(configPosition < appPosition);
});
