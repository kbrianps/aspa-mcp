import { readAudit } from "./audit.mjs";

const [limitArg, contact] = process.argv.slice(2);
const { arquivo, total, registros } = readAudit({ limit: Number(limitArg) || 20, contact });
console.log(`Arquivo: ${arquivo}  (total: ${total})\n`);
for (const e of registros) {
  const when = new Date(e.quando).toLocaleString("pt-BR");
  const extra = Object.entries(e.detalhes ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");
  const status = e.status !== "ok" ? "ERRO          " : e.conferido_no_painel === false ? "NÃO CONFERIDO " : "OK            ";
  console.log(`${when}  ${status}${e.acao.padEnd(19)} ${String(e.contato ?? "").padEnd(24)} ${e.usuario}@${e.computador}`);
  if (extra) console.log(`    ${extra.slice(0, 300)}`);
  if (e.erro) console.log(`    erro: ${e.erro}`);
}
