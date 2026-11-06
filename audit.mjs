import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { loadConfig } from "./config.mjs";
import { ACTION_LABELS } from "./tools.mjs";

export { WRITE_METHODS } from "./tools.mjs";

export const DEFAULT_AUDIT_FILE = join(homedir(), ".local", "share", "aspa-mcp", "auditoria.jsonl");

function settings() {
  const audit = loadConfig().config.auditoria;
  return { file: audit.arquivo || DEFAULT_AUDIT_FILE, includeText: audit.incluir_texto !== false };
}

function fileFacts(path) {
  try {
    const data = readFileSync(path);
    return { nome: basename(path), caminho: path, tamanho_bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  } catch {
    return { nome: basename(String(path ?? "")), caminho: path };
  }
}

function details(method, args, includeText, status) {
  const text = (value) => (includeText ? value : value ? `[${value.length} caracteres]` : undefined);
  switch (method) {
    case "sendMessage":
      return { texto: text(args.text) };
    case "sendTemplate":
      return { template: args.template, variaveis: includeText ? args.variables : args.variables?.length };
    case "sendAttachment":
      return { arquivo: status === "ok" ? fileFacts(args.path) : { caminho: args.path }, legenda: text(args.caption) };
    case "transfer":
      return { para: args.to, comentario: text(args.comment) };
    case "snooze":
      return { duracao: args.duration };
    case "renameContact":
      return { novo_nome: args.name };
    case "openDraft":
      return { texto: text(args.text) };
    case "replyToMessage":
      return { mensagem_citada: args.messageIndex, texto: text(args.text) };
    case "snoozeUntil":
      return { ate: `${args.date} ${args.time}`, comentario: text(args.comment) };
    case "createContact":
      return { nome: args.name, telefone: includeText ? args.phone : "[oculto]" };
    case "updateSettings":
      return { arquivo: args.file, chaves: Object.keys(args.changes ?? {}), valores: includeText ? args.changes : undefined };
    case "saveKnowledge":
      return { documento: args.path, tamanho: args.content?.length, substituir: !!args.overwrite };
    case "configureSlack":
      return { id_slack: args.user_id };
    case "setPromotionsBlocked":
      return { bloquear: args.blocked };
    default:
      return {};
  }
}

const RESULT_KEYS = new Set([
  "sent",
  "verified",
  "conversation_id",
  "template",
  "file",
  "path",
  "transferred",
  "to",
  "snoozed",
  "duration",
  "until",
  "panel_date",
  "concluded",
  "reopened",
  "renamed",
  "previous",
  "saved",
  "assumed",
  "marked_unread",
  "created",
  "promotions_blocked",
  "changed",
  "opened",
  "window_minutes",
  "sent_by_user",
  "messages_sent",
  "reason",
  "loggedIn",
  "note",
  "updated",
  "from",
  "replaced",
  "backup",
]);

function safeResult(result, includeText) {
  const kept = Object.fromEntries(Object.entries(result).filter(([key]) => RESULT_KEYS.has(key)));
  if (result.replied_to) kept.replied_to = includeText ? result.replied_to : { index: result.replied_to.index };
  if (Array.isArray(result.changed)) kept.changed = result.changed;
  return Object.keys(kept).length ? kept : undefined;
}

export function recordAudit(record) {
  try {
    writeAudit(record);
  } catch (error) {
    console.error(`[audit] could not record ${record?.method}: ${error.message}`);
  }
}

function writeAudit({ method, args = {}, status, result, error, code, startedAt }) {
  let file = DEFAULT_AUDIT_FILE;
  let includeText = true;
  try {
    ({ file, includeText } = settings());
  } catch (settingsError) {
    console.error(`[audit] using default audit file: ${settingsError.message}`);
  }
  const entry = {
    quando: new Date().toISOString(),
    duracao_ms: Date.now() - startedAt,
    usuario: userInfo().username,
    computador: hostname(),
    acao: ACTION_LABELS[method] ?? method,
    contato: result?.contact ?? args.contact ?? (Number.isInteger(args.index) ? `#${args.index}` : undefined),
    detalhes: details(method, args, includeText, status),
    status,
    conferido_no_painel: result ? (result.verified ?? result.sent ?? result.renamed ?? result.reopened ?? result.transferred ?? result.assumed ?? result.opened ?? result.sent_by_user ?? result.marked_unread ?? result.created ?? undefined) : undefined,
    resultado: result ? safeResult(result, includeText) : undefined,
    erro: error,
    codigo_erro: code,
  };
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  rotateMonthly(file);
  appendFileSync(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}

const monthOf = (date) => date.toISOString().slice(0, 7);

function rotatedName(file, month) {
  return file.replace(/(\.jsonl)?$/, (extension) => `-${month}${extension || ".jsonl"}`);
}

function rotateMonthly(file, now = new Date()) {
  if (!existsSync(file)) return;
  const month = monthOf(statSync(file).mtime);
  if (month === monthOf(now)) return;
  const target = rotatedName(file, month);
  if (!existsSync(target)) renameSync(file, target);
}

function auditFiles(file) {
  const folder = dirname(file);
  if (!existsSync(folder)) return [];
  const stem = basename(file).replace(/\.jsonl$/, "");
  const rotated = readdirSync(folder)
    .filter((name) => name.startsWith(`${stem}-`) && name.endsWith(".jsonl") && /^\d{4}-\d{2}$/.test(name.slice(stem.length + 1, -6)))
    .sort()
    .map((name) => join(folder, name));
  return [...rotated, ...(existsSync(file) ? [file] : [])];
}

export function readAudit({ limit = 20, contact, since, action } = {}) {
  const { file } = settings();
  const files = auditFiles(file);
  if (!files.length) return { arquivo: file, total: 0, registros: [] };
  const sinceTime = since ? Date.parse(since) : NaN;
  const needle = contact?.toLowerCase();
  const entries = files
    .flatMap((path) => readFileSync(path, "utf8").split("\n"))
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
  const sizeKb = files.reduce((sum, path) => sum + statSync(path).size, 0) / 1024;
  return { arquivo: file, arquivos: files.length, tamanho_kb: Math.ceil(sizeKb), total: entries.length, registros: entries.slice(-limit).reverse() };
}
