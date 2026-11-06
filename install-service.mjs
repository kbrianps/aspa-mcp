import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_FILE } from "./env-file.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const unitDir = join(homedir(), ".config", "systemd", "user");
const unitPath = join(unitDir, "aspa-mcp.service");
const passthrough = ["DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "ASPA_CHROME_PATH", "ASPA_PROFILE_DIR", "ASPA_WATCH", "ASPA_WATCH_INTERVAL_MS"]
  .filter((name) => process.env[name])
  .map((name) => `Environment=${name}=${process.env[name]}`)
  .join("\n");

const unit = `[Unit]
Description=Aspa Chat MCP daemon (headless Aspa session, watcher and notifications)
After=graphical-session.target

[Service]
ExecStart=${process.execPath} ${join(root, "daemon.mjs")}
WorkingDirectory=${root}
Restart=on-failure
RestartSec=15
EnvironmentFile=-${ENV_FILE}
${passthrough}

[Install]
WantedBy=default.target
`;

mkdirSync(unitDir, { recursive: true });
writeFileSync(unitPath, unit);
if (!existsSync(ENV_FILE)) {
  mkdirSync(dirname(ENV_FILE), { recursive: true });
  writeFileSync(
    ENV_FILE,
    "# Secrets for aspa-mcp notification channels. Restart the service after editing.\n# Preferences (channels, tabs, schedule) live in equipe.yaml and pessoal.yaml.\n# ASPA_SLACK_BOT_TOKEN=\n# ASPA_SLACK_USER_ID=\n# ASPA_SLACK_WEBHOOK_URL=\n# ASPA_NTFY_URL=https://ntfy.sh/<long-random-topic>\n# ASPA_NTFY_SHOW_CONTACT=0\n",
    { mode: 0o600 },
  );
  console.log(`Created ${ENV_FILE}`);
}
execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "inherit" });
execFileSync("systemctl", ["--user", "enable", "--now", "aspa-mcp.service"], { stdio: "inherit" });
console.log(`Installed ${unitPath}`);
console.log("Logs: journalctl --user -u aspa-mcp -f");
