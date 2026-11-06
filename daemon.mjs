#!/usr/bin/env node
import "./node-check.mjs";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import * as aspa from "./aspa.mjs";
import { recordAudit, WRITE_METHODS } from "./audit.mjs";
import { SOCKET_PATH, socketAlive } from "./client.mjs";
import { loadConfig, passesFilters, withinSchedule } from "./config.mjs";
import { isReadOnly } from "./env-file.mjs";
import { AspaError, CODES, toPayload } from "./errors.mjs";
import { enabledChannels, notify } from "./notify.mjs";
import { VERSION } from "./version.mjs";

process.umask(0o077);

const WATCH = process.env.ASPA_WATCH !== "0";
const WATCH_INTERVAL_MS = Number(process.env.ASPA_WATCH_INTERVAL_MS || 20000);

const methods = {
  login: aspa.login,
  listConversations: aspa.listConversations,
  readConversation: aspa.readConversation,
  listTemplates: aspa.listTemplates,
  sendMessage: aspa.sendMessage,
  sendTemplate: aspa.sendTemplate,
  sendAttachment: aspa.sendAttachment,
  transfer: aspa.transfer,
  assume: aspa.assume,
  snooze: aspa.snooze,
  conclude: aspa.conclude,
  reopen: aspa.reopen,
  renameContact: aspa.renameContact,
  downloadAttachments: aspa.downloadAttachments,
  transcribeAudio: aspa.transcribeAudio,
  markUnread: aspa.markUnread,
  searchConversation: aspa.searchConversation,
  replyToMessage: aspa.replyToMessage,
  snoozeUntil: aspa.snoozeUntil,
  statistics: aspa.statistics,
  quickReplies: aspa.quickReplies,
  listConcluded: aspa.listConcluded,
  searchContact: aspa.searchContact,
  createContact: aspa.createContact,
  setPromotionsBlocked: aspa.setPromotionsBlocked,
  sessionStatus: aspa.sessionStatus,
  health: async () => ({ version: VERSION, pid: process.pid, uptime_s: Math.round(process.uptime()), read_only: isReadOnly(), ...aspa.health() }),
  testNotify: async () => {
    const settings = currentNotificationSettings();
    const channels = enabledChannels(settings.canais);
    const errors = await notify({ kind: "test", headline: "Se você está vendo isto, os avisos vão chegar aqui." }, settings.canais);
    return { channels, errors, configured_channels: settings.canais };
  },
  openDraft: (args) =>
    aspa.openDraft(args, {
      onClosed: (info) => recordAudit({ method: "draftClosed", args: { contact: info.contact }, status: "ok", result: info, startedAt: Date.now() }),
    }),
};

const ALLOWED_DURING_REVIEW = new Set(["openDraft", "health"]);
const ALLOWED_IN_READ_ONLY = new Set(["openDraft", "login"]);
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const SEND_METHODS = new Set(["sendMessage", "replyToMessage", "sendTemplate", "sendAttachment"]);
const recentSends = new Map();

function sendKey(method, args) {
  const body = args.text ?? args.path ?? `${args.template}|${(args.variables ?? []).join("|")}`;
  return `${method}|${String(args.contact ?? "").trim().toLowerCase()}|${body}`;
}

function checkDuplicate(method, args) {
  if (!SEND_METHODS.has(method) || args.confirm_duplicate) return null;
  const now = Date.now();
  for (const [key, at] of recentSends) if (now - at > DUPLICATE_WINDOW_MS) recentSends.delete(key);
  const key = sendKey(method, args);
  if (recentSends.has(key)) {
    throw new AspaError(
      CODES.DUPLICATE,
      "Esta mesma mensagem foi enviada (ou está sendo enviada) para este contato há menos de 2 minutos. Confira a conversa antes; se for mesmo para repetir, chame de novo com confirm_duplicate=true.",
    );
  }
  recentSends.set(key, now);
  return key;
}

async function dispatch(method, args, signal) {
  const fn = methods[method];
  if (!fn) throw new AspaError(CODES.INVALID_INPUT, `Método desconhecido: ${method}`);
  if (WRITE_METHODS.has(method) && !ALLOWED_IN_READ_ONLY.has(method) && isReadOnly()) {
    throw new AspaError(CODES.FORBIDDEN, "O aspa-mcp está em modo somente leitura neste computador (ASPA_READ_ONLY=1). Use aspa_open_draft e envie pelo próprio Aspa.");
  }
  const busy = aspa.interactiveMode();
  if (busy && !ALLOWED_DURING_REVIEW.has(method)) {
    throw new AspaError(
      CODES.BUSY,
      busy === "review"
        ? "A janela de revisão do Aspa está aberta. Envie ou feche a janela para continuar."
        : "O login do Aspa está em andamento na janela aberta. Conclua o login para continuar.",
    );
  }
  if (busy && method === "openDraft") throw new AspaError(CODES.BUSY, "Já existe uma janela de revisão aberta. Feche-a antes de abrir outra.");
  const duplicateKey = checkDuplicate(method, args);
  console.error(`[call] ${method}`);
  const startedAt = Date.now();
  let result;
  try {
    result = await aspa.withRequest(signal, () => fn(args));
  } catch (error) {
    if (duplicateKey && error.code !== CODES.NOT_VERIFIED) recentSends.delete(duplicateKey);
    if (WRITE_METHODS.has(method) && error.code !== CODES.CANCELLED) {
      recordAudit({ method, args, status: "erro", error: error.message, code: error.code, startedAt });
    }
    throw error;
  }
  if (WRITE_METHODS.has(method)) recordAudit({ method, args, status: "ok", result, startedAt });
  return result;
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/call") {
    res.writeHead(404).end();
    return;
  }
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let payload;
    try {
      const { method, args = {} } = JSON.parse(body);
      payload = { ok: true, result: await dispatch(method, args, controller.signal) };
    } catch (error) {
      console.error(`[call] failed: ${error.code ?? "INTERNAL"} ${error.message}`);
      payload = { ok: false, ...toPayload(error) };
    }
    if (!res.destroyed) res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
  });
});

let lastConfigErrors = "";
function currentNotificationSettings() {
  const { config, errors } = loadConfig();
  const joined = errors.join(" | ");
  if (joined && joined !== lastConfigErrors) console.error(`[config] ${joined}`);
  lastConfigErrors = joined;
  return config.notificacoes;
}

const lastNotified = new Map();
const pending = new Map();

function handleActivity(item, { isNew = false } = {}) {
  const settings = currentNotificationSettings();
  if (!passesFilters(settings, item)) return;
  const announceNew = isNew && settings.nova_conversa;
  if (settings.apenas_mensagens_de_cliente && !item.unread && !announceNew) return;
  if (!withinSchedule(settings)) {
    if (settings.fora_do_horario === "acumular") pending.set(item.contact, item);
    return;
  }
  const cooldown = settings.intervalo_minimo_minutos * 60000;
  if (cooldown && Date.now() - (lastNotified.get(item.contact) ?? 0) < cooldown) return;
  lastNotified.set(item.contact, Date.now());
  const kind = announceNew ? "new_conversation" : item.unread ? "message" : "activity";
  const headline = { new_conversation: "Nova conversa", message: "Nova mensagem", activity: "Nova atividade" }[kind];
  notify({ kind, contact: item.contact, headline, time: item.time, agent: settings.mostrar_atendente ? (item.agent ?? (item.assigned ? "atendente não identificado" : "sem atendente")) : undefined }, settings.canais);
}

function flushPending() {
  if (!pending.size) return;
  const settings = currentNotificationSettings();
  if (!withinSchedule(settings)) return;
  const contacts = [...pending.keys()];
  pending.clear();
  for (const contact of contacts) lastNotified.set(contact, Date.now());
  notify(
    {
      kind: "digest",
      contacts,
      headline: contacts.length === 1 ? "1 conversa com mensagem nova" : `${contacts.length} conversas com mensagens novas`,
    },
    settings.canais,
  );
}

mkdirSync(dirname(SOCKET_PATH), { recursive: true });
if (existsSync(SOCKET_PATH)) {
  if (await socketAlive()) {
    console.error(`[daemon] another aspa-mcp daemon is already answering on ${SOCKET_PATH}; exiting`);
    process.exit(1);
  }
  unlinkSync(SOCKET_PATH);
}
server.listen(SOCKET_PATH, () => {
  chmodSync(SOCKET_PATH, 0o600);
  const { sources } = loadConfig();
  const settings = currentNotificationSettings();
  console.error(
    `[daemon] v${VERSION} listening on ${SOCKET_PATH}${isReadOnly() ? " (read-only)" : ""}; config: ${sources.join(", ") || "defaults"}; channels: ${enabledChannels(settings.canais).join(", ") || "none"}; watched tabs: ${WATCH ? settings.abas.join(", ") : "off"}`,
  );
});

const timers = [];
if (WATCH) {
  timers.push(
    aspa.startWatcher({
      intervalMs: WATCH_INTERVAL_MS,
      tabs: () => currentNotificationSettings().abas,
      onActivity: handleActivity,
      onSessionLost: () => {
        const settings = currentNotificationSettings();
        if (settings.sessao_expirada) notify({ kind: "session", headline: "Os avisos e as ações estão pausados até você entrar de novo." }, settings.canais);
      },
      onDegraded: ({ reason, diagnosis }) => {
        console.error(`[watch] degraded: ${reason} ${JSON.stringify(diagnosis ?? {})}`);
        notify({ kind: "degraded", headline: `Os avisos do Aspa pararam há mais de 5 minutos: ${reason}. O painel pode ter mudado; veja journalctl --user -u aspa-mcp.` }, currentNotificationSettings().canais);
      },
      onRecovered: () => {
        console.error("[watch] recovered");
        notify({ kind: "recovered", headline: "Os avisos do Aspa voltaram a funcionar." }, currentNotificationSettings().canais);
      },
    }),
  );
  timers.push(setInterval(flushPending, 60000));
}

const stop = async () => {
  for (const timer of timers) clearInterval(timer);
  server.close();
  await aspa.shutdown();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
