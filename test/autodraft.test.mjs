import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox } from "./helpers.mjs";

const root = sandbox();
process.env.HOME = root;
const { AUTO_DRAFT_TOOLS, buildCommand, createAutoDrafter, parseDraft, readDrafts } = await import("../autodraft.mjs");

const settings = { ativo: true, cliente: "claude", modelo: "", contatos: [], espera_segundos: 0.05, maximo_por_hora: 2 };
const output = "RESUMO:\nO cliente pediu o passo a passo.\nRASCUNHO:\nOlá! Segue o passo a passo.";

test("parses summary and draft", () => {
  assert.deepEqual(parseDraft(output), { summary: "O cliente pediu o passo a passo.", draft: "Olá! Segue o passo a passo." });
  assert.equal(parseDraft("RESUMO:\nSó agradeceu.\nRASCUNHO:\nSEM_RESPOSTA").draft, null);
  assert.equal(parseDraft("texto solto"), null);
});

test("runs the assistant without built-in tools and only with Aspa read tools", () => {
  const { command, args } = buildCommand(settings, "Maria", "/tmp/mcp.json");
  assert.equal(command, "claude");
  assert.equal(args[args.indexOf("--tools") + 1], "");
  assert.ok(args.includes("--strict-mcp-config"));
  assert.equal(args[args.indexOf("--permission-mode") + 1], "dontAsk");
  const allowed = args[args.indexOf("--allowedTools") + 1].split(",");
  assert.deepEqual(allowed, AUTO_DRAFT_TOOLS);
  assert.ok(allowed.every((tool) => !/send|transfer|snooze|conclude|reopen|rename|assume|mark_unread|create|block|update|save|configure/.test(tool)));
  assert.match(args[args.indexOf("-p") + 1], /"Maria"/);
});

test("waits for the customer to stop typing, saves the draft and respects the hourly limit", async () => {
  const runs = [];
  const drafts = [];
  const errors = [];
  const drafter = createAutoDrafter({
    settings: () => settings,
    run: async ({ args }) => {
      runs.push(args);
      return output;
    },
    onDraft: (entry) => drafts.push(entry),
    onError: (contact, error) => errors.push(error.message),
  });
  drafter.schedule("Maria");
  drafter.schedule("Maria");
  drafter.schedule("Maria");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(runs.length, 1);
  assert.equal(drafts[0].contato, "Maria");
  assert.equal(readDrafts({ contact: "mar" })[0].rascunho, "Olá! Segue o passo a passo.");
  assert.ok(existsSync(join(root, ".local", "share", "aspa-mcp", "autodraft-mcp.json")));
  drafter.schedule("João");
  await new Promise((r) => setTimeout(r, 200));
  drafter.schedule("Ana");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(runs.length, 2);
  assert.match(errors[0], /limite de 2/);
});
