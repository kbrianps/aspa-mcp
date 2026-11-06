import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".csv", ".json", ".yaml", ".yml"]);
const MAX_CHARS = 120000;

function walk(folder) {
  const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
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

function safePath(folder, file) {
  const base = resolve(folder);
  const path = resolve(base, file);
  if (path !== base && !path.startsWith(base + sep)) throw new Error("Arquivo fora da pasta de conhecimento.");
  if (!existsSync(path)) throw new Error(`Documento não encontrado: ${file}. Use aspa_get_guidelines para ver a lista.`);
  return path;
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
