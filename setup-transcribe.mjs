import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ownedByMe, WHISPER_DIR, WHISPER_MODELS, WHISPER_PYTHON, WHISPER_READY } from "./transcription.mjs";

const model = process.env.ASPA_WHISPER_MODEL || "small";
mkdirSync(WHISPER_MODELS, { recursive: true, mode: 0o700 });
if (!ownedByMe(WHISPER_DIR)) {
  console.error(`A pasta ${WHISPER_DIR} não pertence ao seu usuário. Escolha outra com ASPA_WHISPER_DIR.`);
  process.exit(1);
}
if (!existsSync(WHISPER_PYTHON)) {
  console.log(`Creating virtualenv in ${join(WHISPER_DIR, "venv")}`);
  execFileSync("python3", ["-m", "venv", join(WHISPER_DIR, "venv")], { stdio: "inherit" });
}
console.log("Installing faster-whisper");
execFileSync(WHISPER_PYTHON, ["-m", "pip", "install", "-q", "--upgrade", "faster-whisper==1.2.1", "av<16"], { stdio: "inherit" });
console.log(`Downloading Whisper model "${model}" to ${WHISPER_MODELS}`);
execFileSync(WHISPER_PYTHON, [new URL("./transcribe.py", import.meta.url).pathname, "--download-only"], {
  stdio: "inherit",
  env: { ...process.env, ASPA_WHISPER_MODEL: model, ASPA_WHISPER_MODELS: WHISPER_MODELS },
});
writeFileSync(WHISPER_READY, JSON.stringify({ model }));
console.log("Local transcription enabled. Restart the daemon: systemctl --user restart aspa-mcp");
