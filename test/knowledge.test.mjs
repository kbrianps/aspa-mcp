import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
const folder = join(root, "conhecimento");
mkdirSync(join(folder, "produtos"), { recursive: true });
write(join(folder, "faq.md"), "# Perguntas\nO prazo de instalação é de 5 dias úteis.\n");
write(join(folder, "produtos", "plano.md"), "# Plano\nPreço: R$ 10\n");
write(join(folder, ".segredo.md"), "segredo\n");
write(join(root, "env"), "ASPA_SLACK_BOT_TOKEN=token-de-teste\n");
symlinkSync(join(root, "env"), join(folder, "link.md"));

const { listDocuments, readDocument, searchDocuments } = await import("../knowledge.mjs");

test("lists documents without hidden files or symlinks", () => {
  const files = listDocuments(folder).map((d) => d.arquivo).sort();
  assert.deepEqual(files, ["faq.md", join("produtos", "plano.md")]);
});

test("searches ignoring accents and case", () => {
  const hits = searchDocuments(folder, "PRAZO instalacao");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].arquivo, "faq.md");
});

test("reads a document by relative path", () => {
  assert.match(readDocument(folder, "produtos/plano.md").texto, /R\$ 10/);
});

test("refuses traversal, hidden files, symlinks and other formats", () => {
  for (const file of ["../env", "/etc/hostname", ".segredo.md", "link.md", "../equipe.yaml", "nada.sh"]) {
    assert.throws(() => readDocument(folder, file), undefined, file);
  }
});
