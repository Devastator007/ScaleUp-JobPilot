import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sdkUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/dist/umd/supabase.js";
const sdkIntegrity =
  "sha384-6foGJ1oz/y3anEo0BXRtTgBK1GvpnR0GbJZb0ijG+nBAJ4rYT+VqlD/9e3CSiFIA";

test("pins the Supabase browser SDK to an exact vetted release", () => {
  assert.match(html, /src=["\x27]https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.110\.9\/dist\/umd\/supabase\.js["\x27]/);
  assert.doesNotMatch(html, /@supabase\/supabase-js@(?:2|latest)(?:["\x27/])/);
});

test("protects the cross-origin SDK with subresource integrity", () => {
  assert.match(html, new RegExp(`integrity=["\x27]${sdkIntegrity}["\x27]`));
  assert.match(html, /crossorigin=["\x27]anonymous["\x27]/);
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
