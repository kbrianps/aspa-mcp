import { call } from "./client.mjs";

const contact = process.argv.slice(2).join(" ") || undefined;
try {
  const result = await call("doctor", { contact }, 120000);
  for (const check of result.checks) console.log(`${check.ok ? "ok  " : "FALHOU"}  ${check.id}${check.detail ? `: ${check.detail}` : ""}`);
  console.log(result.ok ? "\nO painel do Aspa está como o aspa-mcp espera." : "\nAlgo mudou no painel do Aspa. Veja os itens com FALHOU.");
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
