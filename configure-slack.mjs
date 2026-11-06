import { stdin, stdout } from "node:process";
import { loadEnvFile } from "./env-file.mjs";
import { setEnvValue } from "./setup.mjs";

function askHidden(question) {
  return new Promise((resolve) => {
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.trim()));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value.trim());
      } else if (char === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
        stdout.write("*".repeat(char.length));
      }
    };
    stdin.on("data", onData);
  });
}

async function slack(method, token, body) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  return response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
}

const idArgument = process.argv.find((arg) => /^[UW][A-Z0-9]{6,}$/.test(arg));
loadEnvFile();
const userId = idArgument || process.env.ASPA_SLACK_USER_ID;

console.log("Configuração do aviso no Slack do aspa-mcp.");
const token = await askHidden("Cole o token do Slack (xoxb-...) e aperte Enter: ");
if (!/^xoxb-[A-Za-z0-9-]{20,}$/.test(token)) {
  console.error("Isso não parece um token de bot do Slack (deve começar com xoxb-). Nada foi salvo.");
  process.exit(1);
}
const auth = await slack("auth.test", token);
if (!auth.ok) {
  console.error(`O Slack recusou o token (${auth.error}). Confira se copiou o Bot User OAuth Token inteiro. Nada foi salvo.`);
  process.exit(1);
}
setEnvValue("ASPA_SLACK_BOT_TOKEN", token);
console.log(`Token válido (app no workspace ${auth.team}). Salvo em ~/.config/aspa-mcp/env.`);

if (!userId) {
  console.log("Falta o seu ID de membro do Slack. Peça ao assistente para salvar (\"meu ID do Slack é U...\") ou rode: npm run slack -- U0123456789");
  process.exit(0);
}
if (idArgument) setEnvValue("ASPA_SLACK_USER_ID", idArgument);
const sent = await slack("chat.postMessage", token, {
  channel: userId,
  text: "✅ Notificações do aspa-mcp funcionando",
  blocks: [
    { type: "section", text: { type: "mrkdwn", text: "✅  *Notificações do aspa-mcp funcionando*\nSe você está vendo isto, os avisos do Aspa vão chegar aqui." } },
    { type: "context", elements: [{ type: "mrkdwn", text: "Teste enviado pelo npm run slack  ·  aspa-mcp" }] },
  ],
});
if (sent.ok) {
  console.log("Pronto! Mandei uma mensagem de teste no seu Slack (em Apps → Aspa Chat).");
} else {
  console.error(`Token salvo, mas o envio de teste falhou (${sent.error}). Se for channel_not_found, confira o seu ID de membro.`);
  process.exit(1);
}
