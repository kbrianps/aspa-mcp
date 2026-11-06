import { loadEnvFile } from "./env-file.mjs";

process.umask(0o077);
loadEnvFile({ includeSecrets: false });
