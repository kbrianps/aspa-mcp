import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
const file = join(root, "auditoria.jsonl");
write(join(root, "equipe.yaml"), `auditoria:\n  arquivo: ${file}\n  incluir_texto: false\n`);
const { readAudit, recordAudit } = await import("../audit.mjs");

test("records an action privately without the message text", () => {
  recordAudit({ method: "sendMessage", args: { contact: "Cliente", text: "segredo" }, status: "ok", result: { sent: true, contact: "Cliente" }, startedAt: Date.now() });
  const line = JSON.parse(readFileSync(file, "utf8").trim());
  assert.equal(line.acao, "enviar_mensagem");
  assert.equal(line.detalhes.texto, "[7 caracteres]");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(readAudit({}).total, 1);
});

test("does not read files of refused attachments", () => {
  recordAudit({ method: "sendAttachment", args: { contact: "X", path: "/etc/hostname" }, status: "erro", error: "proibido", startedAt: Date.now() });
  const line = JSON.parse(readFileSync(file, "utf8").trim().split("\n").at(-1));
  assert.deepEqual(line.detalhes.arquivo, { caminho: "/etc/hostname" });
});

test("never throws, even with a broken config", () => {
  write(join(root, "equipe.yaml"), "auditoria: [");
  assert.doesNotThrow(() => recordAudit({ method: "conclude", args: { contact: "X" }, status: "ok", result: {}, startedAt: Date.now() }));
  assert.doesNotThrow(() => recordAudit(undefined));
});
