import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
const { isReadOnly, readEnvValues } = await import("../env-file.mjs");

test("parses values and strips quotes", () => {
  write(join(root, "env"), "# comment\nA=1\nB = \"dois\"\n#C=3\n");
  assert.deepEqual(readEnvValues(), { A: "1", B: "dois" });
});

test("read-only mode comes from the environment or the env file", () => {
  write(join(root, "env"), "");
  assert.equal(isReadOnly(), false);
  write(join(root, "env"), "ASPA_READ_ONLY=1\n");
  assert.equal(isReadOnly(), true);
  write(join(root, "env"), "");
  process.env.ASPA_READ_ONLY = "1";
  assert.equal(isReadOnly(), true);
  delete process.env.ASPA_READ_ONLY;
});
