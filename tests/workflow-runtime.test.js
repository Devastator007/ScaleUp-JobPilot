"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const ci = read(".github/workflows/ci.yml");
const pages = read(".github/workflows/pages.yml");
const packageJson = JSON.parse(read("package.json"));

test("GitHub workflow actions use the Node 24 generation", () => {
  const workflows = ci + "\n" + pages;
  assert.doesNotMatch(workflows, /actions\/checkout@v4/);
  assert.doesNotMatch(workflows, /actions\/setup-node@v[1-6](?:\b|\.)/);
  assert.equal((workflows.match(/actions\/checkout@v5/g) || []).length, 2);
  assert.equal((workflows.match(/actions\/setup-node@v7/g) || []).length, 1);
});

test("CI and package metadata require Node 24", () => {
  assert.match(ci, /node-version:\s*"24"/);
  assert.equal(packageJson.engines.node, ">=24");
});

test("Pages deployment safeguards remain enabled", () => {
  assert.match(pages, /contents:\s*read/);
  assert.match(pages, /pages:\s*write/);
  assert.match(pages, /id-token:\s*write/);
  assert.match(pages, /actions\/configure-pages@v5/);
  assert.doesNotMatch(pages, /enablement:\s*true/);
  assert.match(pages, /actions\/upload-pages-artifact@v3/);
  assert.match(pages, /actions\/deploy-pages@v4/);
});

test("Pages deployment performs a fail-closed live verification", () => {
  assert.match(pages, /PAGE_URL:\s*\$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(pages, /curl --silent --show-error --location/);
  assert.match(pages, /status" = "200"/);
  assert.match(pages, /grep -q "ScaleUp JobPilot"/);
  assert.match(pages, /exit 1/);
});
