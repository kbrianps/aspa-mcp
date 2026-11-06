import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const WHISPER_DIR = process.env.ASPA_WHISPER_DIR || "/var/tmp/aspa-mcp/whisper";
export const WHISPER_PYTHON = join(WHISPER_DIR, "venv", "bin", "python");
export const WHISPER_MODELS = join(WHISPER_DIR, "models");
export const WHISPER_READY = join(WHISPER_DIR, "ready.json");
const SCRIPT = new URL("./transcribe.py", import.meta.url).pathname;

export function transcriptionEnabled() {
  return existsSync(WHISPER_READY) && existsSync(WHISPER_PYTHON);
}

export function transcribeFiles(paths) {
  if (!transcriptionEnabled()) {
    return Promise.reject(new Error("Local transcription is not enabled. Run `npm run setup-transcribe` in the aspa-mcp folder (optional, ~1 GB)."));
  }
  const { model } = JSON.parse(readFileSync(WHISPER_READY, "utf8"));
  return new Promise((resolve, reject) => {
    execFile(
      WHISPER_PYTHON,
      [SCRIPT, ...paths],
      { env: { ...process.env, ASPA_WHISPER_MODEL: process.env.ASPA_WHISPER_MODEL || model, ASPA_WHISPER_MODELS: WHISPER_MODELS }, timeout: 15 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`Transcription failed: ${(stderr || error.message).trim().split("\n").at(-1)}`));
        try {
          resolve(JSON.parse(stdout.trim().split("\n").at(-1)));
        } catch {
          reject(new Error("Transcription returned invalid output."));
        }
      },
    );
  });
}
