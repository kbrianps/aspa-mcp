#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import * as aspa from "./aspa.mjs";
import { recordAudit, WRITE_METHODS } from "./audit.mjs";
import { SOCKET_PATH } from "./client.mjs";
import { loadConfig, passesFilters, withinSchedule } from "./config.mjs";
import { enabledChannels, notify } from "./notify.mjs";

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
  openDraft: (args) =>
    aspa.openDraft(args, {
      onClosed: (info) => recordAudit({ method: "draftClosed", args: { contact: info.contact }, status: "ok", result: info, startedAt: Date.now() }),
    }),
};

const ALLOWED_DURING_REVIEW = new Set(["openDraft"]);

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/call") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let payload;
    try {
      const { method, args = {} } = JSON.parse(body);
      const fn = methods[method];
      if (!fn) throw new Error(`Unknown method ${method}`);
      const busy = aspa.interactiveMode();
      if (busy && !ALLOWED_DURING_REVIEW.has(method)) {
        throw new Error(
          busy === "review"
            ? "A janela de revisão do Aspa está aberta. Envie ou feche a janela para continuar."
            : "O login do Aspa está em andamento na janela aberta. Conclua o login para continuar.",
        );
      }
      if (busy && method === "openDraft") throw new Error("Já existe uma janela de revisão aberta. Feche-a antes de abrir outra.");
      console.error(`[call] ${method}`);
      const startedAt = Date.now();
      try {
        const result = await fn(args);
        if (WRITE_METHODS.has(method)) recordAudit({ method, args, status: "ok", result, startedAt });
        payload = { ok: true, result };
      } catch (error) {
        if (WRITE_METHODS.has(method)) recordAudit({ method, args, status: "erro", error: error.message, startedAt });
        throw error;
      }
    } catch (error) {
      console.error(`[call] failed: ${error.message}`);
      payload = { ok: false, error: error.message };
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
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
if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);
server.listen(SOCKET_PATH, () => {
  chmodSync(SOCKET_PATH, 0o600);
  const { sources } = loadConfig();
  const settings = currentNotificationSettings();
  console.error(
    `[daemon] listening on ${SOCKET_PATH}; config: ${sources.join(", ") || "defaults"}; channels: ${enabledChannels(settings.canais).join(", ") || "none"}; watched tabs: ${WATCH ? settings.abas.join(", ") : "off"}`,
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
