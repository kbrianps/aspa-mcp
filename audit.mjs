import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { loadConfig } from "./config.mjs";

export const WRITE_METHODS = new Set([
  "sendMessage",
  "sendTemplate",
  "sendAttachment",
  "transfer",
  "snooze",
  "conclude",
  "reopen",
  "renameContact",
]);

const ACTION_LABELS = {
  sendMessage: "enviar_mensagem",
  sendTemplate: "enviar_template",
  sendAttachment: "enviar_anexo",
  transfer: "transferir",
  snooze: "adiar",
  conclude: "concluir",
  reopen: "reabrir",
  renameContact: "renomear_contato",
};

export const DEFAULT_AUDIT_FILE = join(homedir(), ".local", "share", "aspa-mcp", "auditoria.jsonl");

function settings() {
  const audit = loadConfig().config.auditoria;
  return { file: audit.arquivo || DEFAULT_AUDIT_FILE, includeText: audit.incluir_texto !== false };
}

function fileFacts(path) {
  try {
    const data = readFileSync(path);
    return { nome: basename(path), tamanho_bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  } catch {
    return { nome: basename(path) };
  }
}

function details(method, args, includeText) {
  const text = (value) => (includeText ? value : value ? `[${value.length} caracteres]` : undefined);
  switch (method) {
    case "sendMessage":
      return { texto: text(args.text) };
    case "sendTemplate":
      return { template: args.template, variaveis: includeText ? args.variables : args.variables?.length };
    case "sendAttachment":
      return { arquivo: fileFacts(args.path), legenda: text(args.caption) };
    case "transfer":
      return { para: args.to, comentario: text(args.comment) };
    case "snooze":
      return { duracao: args.duration };
    case "renameContact":
      return { novo_nome: args.name };
    default:
      return {};
  }
}

export function recordAudit({ method, args, status, result, error, startedAt }) {
  const { file, includeText } = settings();
  const entry = {
    quando: new Date().toISOString(),
    duracao_ms: Date.now() - startedAt,
    usuario: userInfo().username,
    computador: hostname(),
    acao: ACTION_LABELS[method] ?? method,
    contato: result?.contact ?? args.contact ?? (Number.isInteger(args.index) ? `#${args.index}` : undefined),
    detalhes: details(method, args, includeText),
    status,
    conferido_no_painel: result ? (result.verified ?? result.sent ?? result.renamed ?? result.reopened ?? result.transferred ?? undefined) : undefined,
    resultado: result ? { ...result, contact: undefined } : undefined,
    erro: error,
  };
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  } catch (writeError) {
    console.error(`[audit] could not write ${file}: ${writeError.message}`);
  }
}

export function readAudit({ limit = 20, contact, since, action } = {}) {
  const { file } = settings();
  if (!existsSync(file)) return { arquivo: file, total: 0, registros: [] };
  const sinceTime = since ? Date.parse(since) : NaN;
  const needle = contact?.toLowerCase();
  const entries = readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((e) => !needle || String(e.contato ?? "").toLowerCase().includes(needle))
    .filter((e) => !action || e.acao === action)
    .filter((e) => Number.isNaN(sinceTime) || Date.parse(e.quando) >= sinceTime);
  return { arquivo: file, tamanho_kb: Math.ceil(statSync(file).size / 1024), total: entries.length, registros: entries.slice(-limit).reverse() };
}
