import assert from "node:assert/strict";
import { test } from "node:test";
import { sandbox } from "./helpers.mjs";

sandbox();
const aspa = await import("../aspa.mjs");
const { ACTION_LABELS, TOOLS, WRITE_METHODS } = await import("../tools.mjs");

test("every tool points to an exported panel function", () => {
  for (const tool of TOOLS) assert.equal(typeof aspa[tool.method], "function", tool.method);
});

test("every write tool has an audit label and requires approval", () => {
  for (const tool of TOOLS.filter((t) => t.kind === "write")) {
    assert.ok(WRITE_METHODS.has(tool.method), tool.name);
    assert.ok(ACTION_LABELS[tool.method], tool.name);
    assert.match(tool.description, /explicitly approved/, tool.name);
  }
});

test("tool names are unique", () => {
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
});
