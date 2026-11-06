#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import * as aspa from "./aspa.mjs";
import { SOCKET_PATH } from "./client.mjs";
import { loadConfig, withinSchedule } from "./config.mjs";
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
  snooze: aspa.snooze,
  conclude: aspa.conclude,
  reopen: aspa.reopen,
  renameContact: aspa.renameContact,
  downloadAttachments: aspa.downloadAttachments,
  transcribeAudio: aspa.transcribeAudio,
};

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
      const { method, args } = JSON.parse(body);
      const fn = methods[method];
      if (!fn) throw new Error(`Unknown method ${method}`);
      console.error(`[call] ${method}`);
      payload = { ok: true, result: await fn(args ?? {}) };
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

function handleActivity(item) {
  const settings = currentNotificationSettings();
  if (settings.apenas_mensagens_de_cliente && !item.unread) return;
  if (!withinSchedule(settings)) {
    if (settings.fora_do_horario === "acumular") pending.set(item.contact, item);
    return;
  }
  const cooldown = settings.intervalo_minimo_minutos * 60000;
  if (cooldown && Date.now() - (lastNotified.get(item.contact) ?? 0) < cooldown) return;
  lastNotified.set(item.contact, Date.now());
  notify({ contact: item.contact, headline: item.unread ? "Nova mensagem" : "Nova atividade", time: item.time }, settings.canais);
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
      contact: contacts.length === 1 ? contacts[0] : undefined,
      headline:
        contacts.length === 1
          ? "Mensagem recebida fora do horário"
          : `${contacts.length} conversas com mensagens fora do horário: ${contacts.join(", ")}`,
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
        if (settings.sessao_expirada) notify({ headline: "Sessão do Aspa expirada. Peça ao Claude para rodar aspa_login." }, settings.canais);
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
