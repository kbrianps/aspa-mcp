import assert from "node:assert/strict";
import { existsSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
process.env.ASPA_CACHE_DIR = join(root, "cache");
const { childEnv } = await import("../transcription.mjs");
const { pruneAttachments } = await import("../aspa.mjs");

test("child processes do not receive secrets", () => {
  process.env.ASPA_SLACK_BOT_TOKEN = "segredo";
  const env = childEnv({ EXTRA: "1" });
  assert.equal(env.ASPA_SLACK_BOT_TOKEN, undefined);
  assert.equal(env.EXTRA, "1");
  assert.equal(env.PATH, process.env.PATH);
  delete process.env.ASPA_SLACK_BOT_TOKEN;
});

test("old attachments are removed and recent ones kept", () => {
  const folder = join(root, "cache", "attachments", "Cliente");
  mkdirSync(folder, { recursive: true });
  write(join(folder, "velho.jpg"), "x");
  write(join(folder, "novo.jpg"), "y");
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  utimesSync(join(folder, "velho.jpg"), old, old);
  assert.equal(pruneAttachments(7), 1);
  assert.equal(existsSync(join(folder, "velho.jpg")), false);
  assert.equal(existsSync(join(folder, "novo.jpg")), true);
});

test("Chrome gets a minimal environment with the configured time zone", async () => {
  process.env.ASPA_SLACK_BOT_TOKEN = "segredo";
  const { chromeEnv } = await import("../browser.mjs");
  const env = chromeEnv();
  assert.equal(env.ASPA_SLACK_BOT_TOKEN, undefined);
  assert.equal(env.TZ, "America/Sao_Paulo");
  delete process.env.ASPA_SLACK_BOT_TOKEN;
});
