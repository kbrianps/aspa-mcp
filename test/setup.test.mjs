import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
const { saveKnowledge, setEnvValue, updateSettings } = await import("../setup.mjs");

test("updateSettings creates the files and saves a valid change", () => {
  const result = updateSettings({ file: "equipe", changes: { "empresa.nome": "Empresa Teste" } });
  assert.equal(result.saved, true);
  assert.match(readFileSync(join(root, "equipe.yaml"), "utf8"), /Empresa Teste/);
});

test("updateSettings refuses the knowledge folder and audit settings", () => {
  for (const key of ["conhecimento.pasta", "auditoria.arquivo", "auditoria.incluir_texto"]) {
    assert.throws(() => updateSettings({ file: "pessoal", changes: { [key]: "/" } }), (error) => error.code === "FORBIDDEN");
  }
});

test("updateSettings rejects unknown sections", () => {
  assert.throws(() => updateSettings({ file: "equipe", changes: { "outra.coisa": 1 } }), (error) => error.code === "INVALID_INPUT");
});

test("updateSettings rolls back invalid values", () => {
  const before = readFileSync(join(root, "equipe.yaml"), "utf8");
  assert.throws(() => updateSettings({ file: "equipe", changes: { "notificacoes.fuso": "Lua/Base" } }), (error) => error.code === "INVALID_INPUT");
  assert.equal(readFileSync(join(root, "equipe.yaml"), "utf8"), before);
});

test("updateSettings rolls back a scalar section", () => {
  const before = readFileSync(join(root, "equipe.yaml"), "utf8");
  assert.throws(() => updateSettings({ file: "equipe", changes: { notificacoes: "sim" } }));
  assert.equal(readFileSync(join(root, "equipe.yaml"), "utf8"), before);
});

test("saveKnowledge writes inside the folder", () => {
  const result = saveKnowledge({ path: "produtos/plano.md", content: "# Plano\nTexto" });
  assert.equal(result.file, join("produtos", "plano.md"));
  assert.ok(existsSync(join(root, "conhecimento", "produtos", "plano.md")));
});

test("saveKnowledge refuses unsafe paths", () => {
  const cases = ["../fora.md", "/etc/passwd.md", ".oculto.md", "pasta/.oculta/x.md", "env", "script.sh", "../env"];
  for (const path of cases) assert.throws(() => saveKnowledge({ path, content: "x" }), undefined, path);
});

test("saveKnowledge does not follow a symlinked folder out of the knowledge folder", () => {
  mkdirSync(join(root, "fora"), { recursive: true });
  symlinkSync(join(root, "fora"), join(root, "conhecimento", "link"));
  assert.throws(() => saveKnowledge({ path: "link/x.md", content: "x" }), (error) => error.code === "FORBIDDEN");
});

test("saveKnowledge refuses the fictitious example marker and existing files", () => {
  assert.throws(() => saveKnowledge({ path: "a.md", content: "EXEMPLO FICTÍCIO" }));
  assert.throws(() => saveKnowledge({ path: "produtos/plano.md", content: "novo" }), (error) => error.code === "DUPLICATE");
});

test("setEnvValue keeps the env file private", () => {
  write(join(root, "env"), "# comment\n");
  setEnvValue("ASPA_SLACK_USER_ID", "U123");
  assert.match(readFileSync(join(root, "env"), "utf8"), /ASPA_SLACK_USER_ID=U123/);
  assert.equal(statSync(join(root, "env")).mode & 0o777, 0o600);
});
