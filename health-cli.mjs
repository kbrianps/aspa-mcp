import { call } from "./client.mjs";

try {
  const health = await call("health", {}, 15000);
  const watcher = health.watcher;
  const lastOk = watcher.lastTickOkAt ? new Date(watcher.lastTickOkAt).toLocaleString("pt-BR") : "nunca";
  console.log(`aspa-mcp ${health.version} (PID ${health.pid}, no ar há ${Math.round(health.uptime_s / 60)} min)${health.read_only ? ", somente leitura" : ""}`);
  console.log(`Chrome: ${health.chrome.connected ? `aberto (PID ${health.chrome.pid})` : "fechado"}`);
  console.log(`Fila: ${health.queue} ação(ões) esperando${health.interactive ? `; janela ${health.interactive} aberta` : ""}`);
  console.log(`Avisos: ${watcher.degraded ? "PARADOS" : "funcionando"}; última leitura boa: ${lastOk}${watcher.lastError ? `; último erro: ${watcher.lastError}` : ""}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
