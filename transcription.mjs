import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CODES, fail } from "./errors.mjs";

const LEGACY_DIR = "/var/tmp/aspa-mcp/whisper";
const DATA_HOME = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
export const WHISPER_DIR =
  process.env.ASPA_WHISPER_DIR || (existsSync(join(LEGACY_DIR, "ready.json")) ? LEGACY_DIR : join(DATA_HOME, "aspa-mcp", "whisper"));
export const WHISPER_PYTHON = join(WHISPER_DIR, "venv", "bin", "python");
export const WHISPER_MODELS = join(WHISPER_DIR, "models");
export const WHISPER_READY = join(WHISPER_DIR, "ready.json");
const SCRIPT = new URL("./transcribe.py", import.meta.url).pathname;

export function ownedByMe(path) {
  try {
    return statSync(path).uid === process.getuid();
  } catch {
    return false;
  }
}

export function transcriptionEnabled() {
  return existsSync(WHISPER_READY) && existsSync(WHISPER_PYTHON);
}

export function childEnv(extra) {
  const keep = ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "ASPA_WHISPER_DEVICE", "ASPA_WHISPER_LANGUAGE"];
  return { ...Object.fromEntries(keep.filter((key) => process.env[key]).map((key) => [key, process.env[key]])), ...extra };
}

let slot = Promise.resolve();

function runTranscription(paths) {
  if (!transcriptionEnabled()) {
    fail(CODES.FORBIDDEN, "A transcrição local não está ativada. Rode `npm run setup-transcribe` na pasta do aspa-mcp (opcional, cerca de 1 GB).");
  }
  if (!ownedByMe(WHISPER_DIR)) fail(CODES.FORBIDDEN, `A pasta ${WHISPER_DIR} não pertence ao seu usuário; por segurança, não vou rodar a transcrição dela.`);
  const { model } = JSON.parse(readFileSync(WHISPER_READY, "utf8"));
  return new Promise((resolve, reject) => {
    execFile(
      WHISPER_PYTHON,
      [SCRIPT, ...paths],
      {
        env: childEnv({ ASPA_WHISPER_MODEL: process.env.ASPA_WHISPER_MODEL || model, ASPA_WHISPER_MODELS: WHISPER_MODELS }),
        timeout: 15 * 60 * 1000,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`A transcrição falhou: ${(stderr || error.message).trim().split("\n").at(-1)}`));
        try {
          resolve(JSON.parse(stdout.trim().split("\n").at(-1)));
        } catch {
          reject(new Error("A transcrição devolveu uma saída inválida."));
        }
      },
    );
  });
}

export function transcribeFiles(paths) {
  const run = slot.then(
    () => runTranscription(paths),
    () => runTranscription(paths),
  );
  slot = run.catch(() => {});
  return run;
}
