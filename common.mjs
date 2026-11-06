import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const isPlaceholderCompany = (name) => /^(nome da empresa|acme( .*)?)?$/i.test(String(name ?? "").trim());

export const isPlaceholderSignature = (signature) => /seu nome|acme/i.test(String(signature ?? ""));

const root = dirname(fileURLToPath(import.meta.url));
export const ROOT = root;
export const ROOT_DISPLAY = root.startsWith(`${homedir()}/`) ? `~/${root.slice(homedir().length + 1)}` : root;
export const IN_ROOT = `cd "${ROOT_DISPLAY.startsWith("~/") ? `$HOME/${ROOT_DISPLAY.slice(2)}` : ROOT_DISPLAY}"`;
