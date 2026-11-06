import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

sandbox();
const { checkAttachmentPath, conversationIdFrom, isActivity, pickConversation, sameContact } = await import("../aspa.mjs");

const items = [
  { index: 0, contact: "Maria Silva" },
  { index: 1, contact: "João Souza" },
  { index: 2, contact: "Maria Silva" },
  { index: 3, contact: "Mariana" },
];

test("picks by exact name, ignoring accents and case", () => {
  assert.equal(pickConversation(items, { contact: "joao souza" }).index, 1);
});

test("refuses ambiguous names unless the index tells them apart", () => {
  assert.throws(() => pickConversation(items, { contact: "Maria Silva" }), (error) => error.code === "AMBIGUOUS");
  assert.equal(pickConversation(items, { contact: "Maria Silva", index: 2 }).index, 2);
  assert.throws(() => pickConversation(items, { contact: "Maria Silva", index: 1 }), (error) => error.code === "AMBIGUOUS");
});

test("exact name wins over partial matches", () => {
  assert.equal(pickConversation([{ index: 0, contact: "Ana" }, { index: 1, contact: "Ana Paula" }], { contact: "Ana" }).index, 0);
});

test("compares the header with the expected contact", () => {
  assert.equal(sameContact("Maria  Silva", "maria silva"), true);
  assert.equal(sameContact("João Souza", "Maria Silva"), false);
  assert.equal(sameContact("", "Maria"), false);
});

test("extracts the conversation id from the panel URL", () => {
  assert.equal(conversationIdFrom("https://app.aspa.chat/atendimento/abc123"), "abc123");
  assert.equal(conversationIdFrom("https://app.aspa.chat/atendimento"), null);
});

test("detects activity without bursts at midnight", () => {
  assert.equal(isActivity(undefined, { time: "10:00" }), true);
  assert.equal(isActivity({ time: "10:00", unread: false }, { time: "10:05", unread: false }), true);
  assert.equal(isActivity({ time: "23:59", unread: false }, { time: "Ontem", unread: false }), false);
  assert.equal(isActivity({ time: "Ontem", unread: false }, { time: "Ontem", unread: true }), true);
});

test("attachments only from allowed folders", () => {
  const scratch = join(homedir(), ".config", "aspa-mcp-test-hidden");
  mkdirSync(scratch, { recursive: true });
  write(join(scratch, "x.txt"), "x");
  assert.throws(() => checkAttachmentPath(join(scratch, "x.txt")), (error) => error.code === "FORBIDDEN");
  assert.throws(() => checkAttachmentPath("/etc/hostname"), (error) => error.code === "FORBIDDEN");
  assert.throws(() => checkAttachmentPath("relativo.txt"), (error) => error.code === "INVALID_INPUT");
  const ok = join("/tmp", `aspa-mcp-test-${process.pid}.txt`);
  write(ok, "ok");
  assert.equal(checkAttachmentPath(ok), ok);
  rmSync(scratch, { recursive: true, force: true });
  rmSync(ok, { force: true });
});
