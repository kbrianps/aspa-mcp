import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CODES, fail } from "./errors.mjs";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".csv", ".json", ".yaml", ".yml"]);
const MAX_CHARS = 120000;

function walk(folder) {
  const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) || extname(entry.name).toLowerCase() === ".pdf") files.push(path);
  }
  return files;
}

function textOf(path) {
  if (extname(path).toLowerCase() === ".pdf") {
    try {
      return execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    } catch {
      return null;
    }
  }
  return readFileSync(path, "utf8");
}

const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function listDocuments(folder) {
  if (!existsSync(folder)) return [];
  return walk(folder).map((path) => {
    const text = textOf(path) ?? "";
    const title = text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean)
      ?.replace(/^#+\s*/, "")
      .slice(0, 120);
    return { arquivo: relative(folder, path), tamanho_kb: Math.ceil(statSync(path).size / 1024), titulo: title || undefined };
  });
}

export const DOCUMENT_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ".pdf"]);

export function insideFolder(folder, file) {
  const base = realpathSync(resolve(folder));
  const relativePath = String(file ?? "").trim();
  if (!relativePath || isAbsolute(relativePath)) fail(CODES.INVALID_INPUT, "Informe o caminho relativo do documento dentro da pasta de conhecimento.");
  if (relativePath.split(/[\\/]/).some((part) => part.startsWith("."))) {
    fail(CODES.FORBIDDEN, "Caminhos com pastas ou arquivos ocultos (começando com ponto) não são permitidos.");
  }
  if (!DOCUMENT_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
    fail(CODES.FORBIDDEN, "Formato não permitido. Use .md, .txt, .csv, .json, .yaml ou .pdf.");
  }
  return { base, path: resolve(base, relativePath) };
}

const within = (base, path) => path === base || path.startsWith(base + sep);

function safePath(folder, file) {
  if (!existsSync(folder)) fail(CODES.NOT_FOUND, "A pasta de conhecimento não existe.");
  const { base, path } = insideFolder(folder, file);
  if (!existsSync(path)) fail(CODES.NOT_FOUND, `Documento não encontrado: ${file}. Use aspa_get_guidelines para ver a lista.`);
  const real = realpathSync(path);
  if (!within(base, real) || real === base) fail(CODES.FORBIDDEN, "O documento aponta para fora da pasta de conhecimento.");
  if (!statSync(real).isFile()) fail(CODES.INVALID_INPUT, "O caminho não é um arquivo.");
  return real;
}

export function readDocument(folder, file) {
  const path = safePath(folder, file);
  const text = textOf(path);
  if (text === null) return { arquivo: file, caminho: path, aviso: "Não consegui extrair o texto deste PDF. Abra o arquivo pelo caminho com a ferramenta Read." };
  return { arquivo: file, texto: text.slice(0, MAX_CHARS), truncado: text.length > MAX_CHARS || undefined };
}

export function searchDocuments(folder, query, limit = 20) {
  if (!existsSync(folder)) return [];
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const path of walk(folder)) {
    const lines = (textOf(path) ?? "").split("\n");
    lines.forEach((line, i) => {
      const normalized = normalize(line);
      if (results.length < limit && terms.every((term) => normalized.includes(term))) {
        results.push({
          arquivo: relative(folder, path),
          linha: i + 1,
          trecho: lines
            .slice(Math.max(0, i - 2), i + 3)
            .join("\n")
            .trim(),
        });
      }
    });
  }
  return results;
}
