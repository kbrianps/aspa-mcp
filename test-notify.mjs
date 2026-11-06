import { loadEnvFile } from "./env-file.mjs";

loadEnvFile();
const { loadConfig } = await import("./config.mjs");
const { enabledChannels, notify } = await import("./notify.mjs");
const { config, errors: configErrors } = loadConfig();
const channels = config.notificacoes.canais;
if (configErrors.length) console.log(`config errors: ${configErrors.join("; ")}`);
console.log("channels:", enabledChannels(channels).join(", ") || "none");
const errors = await notify({ contact: "Teste", headline: "Notificação de teste do aspa-mcp", time: new Date().toTimeString().slice(0, 5) }, channels);
console.log(errors.length ? `errors: ${errors.join("; ")}` : "sent to all channels");
