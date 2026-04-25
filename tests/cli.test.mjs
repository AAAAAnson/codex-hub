#!/usr/bin/env node
// Unit tests for lib/cli.js — pure functions only, no filesystem mutation.
//
// Run with: node tests/cli.test.mjs
// Wired into `npm test` via package.json.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_BUILTIN_ITEMS,
  PRESETS,
  DEFAULT_PRESET,
  parseStatusLine,
  setStatusLine,
  resolveDesiredItems,
} from "../lib/cli.js";

test("PRESETS.essential is the default", () => {
  assert.equal(DEFAULT_PRESET, "essential");
  assert.ok(Array.isArray(PRESETS.essential));
  assert.ok(PRESETS.essential.length > 0);
});

test("the four named presets exist", () => {
  for (const name of ["minimal", "essential", "cockpit", "full"]) {
    assert.ok(PRESETS[name], `missing preset "${name}"`);
  }
});

test("presets grow monotonically: minimal ⊂ essential ⊂ cockpit ⊂ full", () => {
  assert.ok(PRESETS.minimal.length < PRESETS.essential.length);
  assert.ok(PRESETS.essential.length < PRESETS.cockpit.length);
  assert.ok(PRESETS.cockpit.length < PRESETS.full.length);
});

test("no preset includes fast-mode (redundant with model-with-reasoning)", () => {
  for (const [name, items] of Object.entries(PRESETS)) {
    assert.ok(!items.includes("fast-mode"), `preset "${name}" should not include fast-mode`);
  }
});

test("every preset uses only built-in items", () => {
  const allowed = new Set(ALL_BUILTIN_ITEMS);
  for (const [name, items] of Object.entries(PRESETS)) {
    for (const item of items) {
      assert.ok(allowed.has(item), `preset "${name}" uses unknown item "${item}"`);
    }
  }
});

test("parseStatusLine returns null when no [tui] section", () => {
  assert.equal(parseStatusLine(""), null);
  assert.equal(parseStatusLine("model = \"gpt-5\"\n"), null);
});

test("parseStatusLine returns null when [tui] has no status_line key", () => {
  assert.equal(parseStatusLine("[tui]\nhide_agent_reasoning = true\n"), null);
});

test("parseStatusLine extracts items in order", () => {
  const content = `model = "gpt-5"

[tui]
status_line = ["context-used", "model-with-reasoning", "current-dir"]
`;
  assert.deepEqual(parseStatusLine(content), [
    "context-used",
    "model-with-reasoning",
    "current-dir",
  ]);
});

test("parseStatusLine ignores status_line in unrelated sections", () => {
  const content = `[other]
status_line = ["fake"]

[tui]
status_line = ["real"]
`;
  assert.deepEqual(parseStatusLine(content), ["real"]);
});

test("setStatusLine appends a [tui] section when none exists", () => {
  const before = `model = "gpt-5"\n`;
  const after = setStatusLine(before, ["context-used", "run-state"]);
  assert.match(after, /\[tui\]\nstatus_line = \["context-used", "run-state"\]/);
});

test("setStatusLine replaces an existing status_line in place", () => {
  const before = `[tui]
status_line = ["model-with-reasoning"]
hide_agent_reasoning = true
`;
  const after = setStatusLine(before, ["context-used", "run-state"]);
  assert.deepEqual(parseStatusLine(after), ["context-used", "run-state"]);
  assert.match(after, /hide_agent_reasoning = true/);
});

test("setStatusLine inserts status_line into an existing empty [tui]", () => {
  const before = `[tui]\nhide_agent_reasoning = true\n`;
  const after = setStatusLine(before, ["context-used"]);
  assert.deepEqual(parseStatusLine(after), ["context-used"]);
  assert.match(after, /hide_agent_reasoning = true/);
});

test("setStatusLine preserves sections after [tui]", () => {
  const before = `[tui]
status_line = ["model-with-reasoning"]

[mcp_servers.foo]
command = "node"
`;
  const after = setStatusLine(before, ["context-used"]);
  assert.match(after, /\[mcp_servers\.foo\]/);
});

test("resolveDesiredItems(--preset full) replaces with preset", () => {
  const got = resolveDesiredItems({ preset: "full" }, []);
  assert.deepEqual(got.items, PRESETS.full);
  assert.equal(got.action, "replace");
});

test("resolveDesiredItems(--preset bogus) throws", () => {
  assert.throws(() => resolveDesiredItems({ preset: "bogus" }, []), /Unknown preset/);
});

test("resolveDesiredItems(--items) replaces with given items", () => {
  const got = resolveDesiredItems(
    { items: ["context-used", "run-state"] },
    ["model-with-reasoning"],
  );
  assert.deepEqual(got.items, ["context-used", "run-state"]);
  assert.equal(got.action, "replace");
});

test("resolveDesiredItems(--items) rejects unknown item names", () => {
  assert.throws(
    () => resolveDesiredItems({ items: ["nope"] }, []),
    /Unknown status_line item/,
  );
});

test("resolveDesiredItems(--add) appends to existing while preserving order", () => {
  const got = resolveDesiredItems(
    { add: ["git-branch"] },
    ["context-used", "model-with-reasoning"],
  );
  assert.deepEqual(got.items, ["context-used", "model-with-reasoning", "git-branch"]);
  assert.equal(got.action, "patch");
});

test("resolveDesiredItems(--add) is idempotent", () => {
  const got = resolveDesiredItems(
    { add: ["context-used"] },
    ["context-used", "model-with-reasoning"],
  );
  assert.deepEqual(got.items, ["context-used", "model-with-reasoning"]);
});

test("resolveDesiredItems(--add) starts from default preset when no existing", () => {
  const got = resolveDesiredItems({ add: ["git-branch"] }, []);
  assert.ok(got.items.includes("git-branch"));
  for (const item of PRESETS[DEFAULT_PRESET]) {
    assert.ok(got.items.includes(item), `preset item ${item} missing`);
  }
});

test("resolveDesiredItems(--remove) removes specified items", () => {
  const got = resolveDesiredItems(
    { remove: ["model-with-reasoning"] },
    ["context-used", "model-with-reasoning", "run-state"],
  );
  assert.deepEqual(got.items, ["context-used", "run-state"]);
});

test("resolveDesiredItems(--add and --remove) compose", () => {
  const got = resolveDesiredItems(
    { add: ["git-branch"], remove: ["model-with-reasoning"] },
    ["context-used", "model-with-reasoning", "run-state"],
  );
  assert.deepEqual(got.items, ["context-used", "run-state", "git-branch"]);
});

test("resolveDesiredItems(--safe-status-line) returns default preset", () => {
  const got = resolveDesiredItems({ safeStatusLine: true }, ["context-used"]);
  assert.deepEqual(got.items, PRESETS[DEFAULT_PRESET]);
});

test("resolveDesiredItems(--native-status-line) returns native HUD items", () => {
  const got = resolveDesiredItems({ safeStatusLine: false }, []);
  assert.ok(got.items.includes("codex-hud"));
});

test("resolveDesiredItems({}) returns null when no flags given", () => {
  const got = resolveDesiredItems({}, ["context-used"]);
  assert.equal(got, null);
});
