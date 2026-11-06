import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { sandbox, write } from "./helpers.mjs";

const root = sandbox();
const { loadConfig, passesFilters, withinSchedule, DEFAULTS } = await import("../config.mjs");

test("missing files fall back to defaults", () => {
  const { config, sources, errors } = loadConfig();
  assert.deepEqual(sources, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(config.notificacoes.abas, DEFAULTS.notificacoes.abas);
});

test("a scalar section does not crash and reports an error", () => {
  write(join(root, "equipe.yaml"), "notificacoes: sim\nrascunhos: 3\n");
  const { config, errors } = loadConfig();
  assert.ok(errors.some((e) => e.startsWith("notificacoes:")));
  assert.ok(errors.some((e) => e.startsWith("rascunhos:")));
  assert.deepEqual(config.notificacoes.canais, DEFAULTS.notificacoes.canais);
});

test("invalid values are reported and replaced", () => {
  write(join(root, "equipe.yaml"), "notificacoes:\n  abas: [meus, xyz]\n  horario: { inicio: '25:00', fim: '18:00' }\n  fuso: Lua/Base\n");
  const { config, errors } = loadConfig();
  assert.ok(errors.some((e) => e.includes("xyz")));
  assert.ok(errors.some((e) => e.includes("horario.inicio")));
  assert.ok(errors.some((e) => e.includes("fuso")));
  assert.deepEqual(config.notificacoes.abas, ["meus"]);
  assert.equal(config.notificacoes.horario.inicio, "00:00");
  assert.equal(config.notificacoes.fuso, "America/Sao_Paulo");
});

test("personal settings override team settings and null is ignored", () => {
  write(join(root, "equipe.yaml"), "rascunhos:\n  assinatura: Equipe\n  tom: Formal\n");
  write(join(root, "pessoal.yaml"), "rascunhos:\n  assinatura: Ana\n  tom: null\n");
  const { config } = loadConfig();
  assert.equal(config.rascunhos.assinatura, "Ana");
  assert.equal(config.rascunhos.tom, "Formal");
});

test("schedule supports overnight ranges", () => {
  const settings = { fuso: "UTC", dias: ["seg"], horario: { inicio: "22:00", fim: "06:00" } };
  assert.equal(withinSchedule(settings, new Date("2026-11-02T23:30:00Z")), true);
  assert.equal(withinSchedule(settings, new Date("2026-11-02T05:00:00Z")), true);
  assert.equal(withinSchedule(settings, new Date("2026-11-02T12:00:00Z")), false);
  assert.equal(withinSchedule(settings, new Date("2026-11-03T23:30:00Z")), false);
});

test("notification filters by contact and agent", () => {
  const base = { contatos_ignorar: [], contatos_incluir: [], atendentes: [] };
  assert.equal(passesFilters({ ...base, contatos_ignorar: ["teste"] }, { contact: "Teste Ácme" }), false);
  assert.equal(passesFilters({ ...base, contatos_incluir: ["acme"] }, { contact: "Cliente Ácme" }), true);
  assert.equal(passesFilters({ ...base, atendentes: ["sem_atendente"] }, { contact: "X", assigned: false }), true);
  assert.equal(passesFilters({ ...base, atendentes: ["sem_atendente"] }, { contact: "X", assigned: true, agent: null }), false);
  assert.equal(passesFilters({ ...base, atendentes: ["ana"] }, { contact: "X", assigned: true, agent: "Ana Souza" }), true);
  assert.equal(passesFilters({ ...base, atendentes: ["ana"] }, { contact: "X", assigned: null, agent: null }), true);
});

test("booleans must be real booleans", () => {
  write(join(root, "equipe.yaml"), "auditoria:\n  incluir_texto: não\n");
  write(join(root, "pessoal.yaml"), "");
  const { config, errors } = loadConfig();
  assert.ok(errors.some((e) => e.startsWith("auditoria.incluir_texto")));
  assert.equal(config.auditoria.incluir_texto, true);
});

test("unknown keys are reported", () => {
  write(join(root, "equipe.yaml"), "notificacoes:\n  abaz: [meus]\nempresa:\n  site: x\n");
  const { errors } = loadConfig();
  assert.ok(errors.some((e) => e.startsWith("notificacoes.abaz")));
  assert.ok(!errors.some((e) => e.startsWith("empresa.site")));
});

test("empty contact filters are ignored instead of matching everyone", () => {
  write(join(root, "equipe.yaml"), "notificacoes:\n  contatos_ignorar: ['']\n");
  const { config, errors } = loadConfig();
  assert.deepEqual(config.notificacoes.contatos_ignorar, []);
  assert.ok(errors.some((e) => e.includes("contatos_ignorar")));
  assert.equal(passesFilters(config.notificacoes, { contact: "Qualquer" }), true);
});

test("agent filter matches whole words", () => {
  const base = { contatos_ignorar: [], contatos_incluir: [], atendentes: ["ana"] };
  assert.equal(passesFilters(base, { contact: "X", assigned: true, agent: "Ana Souza" }), true);
  assert.equal(passesFilters(base, { contact: "X", assigned: true, agent: "Mariana Lima" }), false);
});

test("templates and examples load without errors", async () => {
  const { readdirSync, copyFileSync } = await import("node:fs");
  for (const folder of ["modelos", "exemplos"]) {
    const dir = join(import.meta.dirname, "..", folder);
    if (!readdirSync(dir).includes("equipe.yaml")) continue;
    copyFileSync(join(dir, "equipe.yaml"), join(root, "equipe.yaml"));
    copyFileSync(join(dir, "pessoal.yaml"), join(root, "pessoal.yaml"));
    const { errors } = loadConfig();
    assert.deepEqual(errors, [], folder);
  }
});
