import { execFile } from "node:child_process";

const SLACK_WEBHOOK_URL = process.env.ASPA_SLACK_WEBHOOK_URL;
const SLACK_BOT_TOKEN = process.env.ASPA_SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.ASPA_SLACK_USER_ID;
const NTFY_URL = process.env.ASPA_NTFY_URL;
const NTFY_SHOW_CONTACT = process.env.ASPA_NTFY_SHOW_CONTACT === "1";

export function enabledChannels(channels = ["desktop", "slack", "ntfy"]) {
  return [
    channels.includes("desktop") && "desktop",
    channels.includes("slack") && SLACK_BOT_TOKEN && SLACK_USER_ID && "slack-dm",
    channels.includes("slack") && SLACK_WEBHOOK_URL && "slack-webhook",
    channels.includes("ntfy") && NTFY_URL && "ntfy",
  ].filter(Boolean);
}

async function slackDirectMessage({ text, blocks }) {
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel: SLACK_USER_ID, text, blocks, unfurl_links: false }),
    });
    const data = await response.json().catch(() => ({}));
    return data.ok ? null : `slack-dm: ${data.error ?? `HTTP ${response.status}`}`;
  } catch (error) {
    return `slack-dm: ${error.message}`;
  }
}

function desktop(title, body) {
  return new Promise((resolve) => {
    execFile("notify-send", ["-a", "Aspa", "-i", "mail-message-new", title, body], (error) => resolve(error ? `desktop: ${error.message}` : null));
  });
}

async function post(name, url, options) {
  try {
    const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10000), ...options });
    return response.ok ? null : `${name}: HTTP ${response.status}`;
  } catch (error) {
    return `${name}: ${error.message}`;
  }
}

const ASPA_URL = "https://app.aspa.chat/atendimento";
const KINDS = {
  message: { emoji: "💬", title: "Nova mensagem no Aspa", hint: "Responda pelo Claude Code ou direto no Aspa" },
  activity: { emoji: "🔄", title: "Nova atividade no Aspa", hint: "Responda pelo Claude Code ou direto no Aspa" },
  digest: { emoji: "🕘", title: "Mensagens recebidas fora do horário", hint: "Resumo enviado no início do seu expediente" },
  session: { emoji: "⚠️", title: "Sessão do Aspa expirada", hint: "Peça ao Claude: _faz o login no Aspa_" },
  test: { emoji: "✅", title: "Notificações do aspa-mcp funcionando", hint: "Este é um aviso de teste" },
};

function slackPayload({ kind, contact, contacts, headline, time }) {
  const info = KINDS[kind] ?? KINDS.message;
  const lines = [];
  if (contact) lines.push(`*${contact}*${time ? `   ·   ${time}` : ""}`);
  if (contacts?.length) lines.push(contacts.map((name) => `•  ${name}`).join("\n"));
  if (headline && !["message", "activity"].includes(kind)) lines.push(headline);
  return {
    text: `${info.emoji} ${info.title}${contact ? `: ${contact}` : ""}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: [`${info.emoji}  *${info.title}*`, ...lines].join("\n") },
        accessory: { type: "button", text: { type: "plain_text", text: "Abrir no Aspa", emoji: true }, url: ASPA_URL, action_id: "open_aspa" },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `${info.hint}  ·  aspa-mcp` }] },
    ],
  };
}

export async function notify({ kind = "message", contact, contacts, headline, time }, channels) {
  const active = enabledChannels(channels);
  const info = KINDS[kind] ?? KINDS.message;
  const title = contact ? `Aspa: ${contact}` : `Aspa: ${info.title}`;
  const body = [time ? `${headline} às ${time}` : headline, contacts?.join(", ")].filter(Boolean).join("\n");
  const slack = slackPayload({ kind, contact, contacts, headline, time });
  const tasks = [];
  if (active.includes("desktop")) tasks.push(desktop(title, body));
  if (active.includes("slack-dm")) tasks.push(slackDirectMessage(slack));
  if (active.includes("slack-webhook")) {
    tasks.push(post("slack-webhook", SLACK_WEBHOOK_URL, { headers: { "content-type": "application/json" }, body: JSON.stringify(slack) }));
  }
  if (active.includes("ntfy")) {
    tasks.push(
      post("ntfy", NTFY_URL, {
        headers: { Title: NTFY_SHOW_CONTACT ? encodeURIComponent(title) : "Aspa", Click: "https://app.aspa.chat/atendimento", Tags: "speech_balloon" },
        body: NTFY_SHOW_CONTACT ? body : contact ? `${headline} no Aspa${time ? ` às ${time}` : ""}` : headline,
      }),
    );
  }
  const errors = (await Promise.all(tasks)).filter(Boolean);
  console.error(`[notify] ${new Date().toISOString()} channels=${active.join(",") || "none"}${errors.length ? ` errors=${errors.join("; ")}` : ""}`);
  return errors;
}
