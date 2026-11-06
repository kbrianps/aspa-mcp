import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ENV_FILE = process.env.ASPA_ENV_FILE || join(homedir(), ".config", "aspa-mcp", "env");

export function readEnvValues() {
  if (!existsSync(ENV_FILE)) return {};
  const values = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

export function loadEnvFile() {
  for (const [key, value] of Object.entries(readEnvValues())) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

export const isReadOnly = () => process.env.ASPA_READ_ONLY === "1" || readEnvValues().ASPA_READ_ONLY === "1";
