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
  console.log(`${when}  ${e.status === "ok" ? "OK  " : "ERRO"}  ${e.acao.padEnd(16)} ${String(e.contato ?? "").padEnd(24)} ${e.usuario}@${e.computador}`);
  if (extra) console.log(`    ${extra.slice(0, 300)}`);
  if (e.erro) console.log(`    erro: ${e.erro}`);
}
