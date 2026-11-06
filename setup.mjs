import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { isMap, parseDocument } from "yaml";
import { CONFIG_DIR, loadConfig, PERSONAL_CONFIG, TEAM_CONFIG } from "./config.mjs";
import { ENV_FILE } from "./env-file.mjs";
import { listDocuments, searchDocuments } from "./knowledge.mjs";
import { transcriptionEnabled } from "./transcription.mjs";

const FILES = { equipe: TEAM_CONFIG, pessoal: PERSONAL_CONFIG };
const TEMPLATES = new URL("./modelos/", import.meta.url).pathname;
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".csv", ".json", ".yaml", ".yml"]);

function readEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const values = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export function setEnvValue(key, value) {
  mkdirSync(dirname(ENV_FILE), { recursive: true });
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split("\n") : [];
  const pattern = new RegExp(`^#?\\s*${key}=.*$`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(ENV_FILE, `${lines.filter((line, i) => line || i < lines.length - 1).join("\n")}\n`, { mode: 0o600 });
}

function ensureConfigFiles() {
  mkdirSync(join(CONFIG_DIR, "conhecimento"), { recursive: true });
  const created = [];
  for (const [name, target] of Object.entries(FILES)) {
    if (!existsSync(target)) {
      copyFileSync(join(TEMPLATES, `${name}.yaml`), target);
      created.push(target);
    }
  }
  return created;
}

export function setupCheck({ service, session }) {
  const { config, sources, errors } = loadConfig();
  const env = readEnvFile();
  const docs = listDocuments(config.conhecimento.pasta).filter((d) => !/^LEIA-ME/i.test(d.arquivo));
  const sampleDocs = [...new Set(searchDocuments(config.conhecimento.pasta, "EXEMPLO FICTÍCIO", 100).map((h) => h.arquivo))];
  const items = [];
  const add = (id, ok, label, next) => items.push({ id, status: ok ? "ok" : "pendente", item: label, proximo_passo: ok ? undefined : next });

  add("servico", service.running, "Serviço em segundo plano rodando", "No terminal: cd ~/dev/aspa-mcp && npm run install-service (ou systemctl --user restart aspa-mcp).");
  add(
    "login",
    session === "logged_in",
    "Sessão do Aspa ativa",
    session === "unknown" ? "Inicie o serviço primeiro." : "Chame a ferramenta aspa_login e faça login na janela que abrir.",
  );
  add("arquivos", sources.length === 2, "Arquivos equipe.yaml e pessoal.yaml criados", "Chame aspa_update_settings (ela cria os arquivos a partir dos modelos) ou rode npm run init-config.");
  add("erros", errors.length === 0, "Configuração sem erros", `Corrija: ${errors.join("; ")}`);
  add(
    "empresa",
    !/^(nome da empresa|acme monitoramento)?$/i.test(String(config.empresa.nome ?? "").trim()) && !/Uma ou duas frases/i.test(String(config.empresa.descricao ?? "")),
    "Nome e descrição da empresa",
    'Pergunte ao usuário o nome da empresa e uma ou duas frases sobre o que ela faz; grave com aspa_update_settings (arquivo "equipe", campos empresa.nome e empresa.descricao).',
  );
  add(
    "tom",
    !!config.rascunhos.tom && config.rascunhos.exemplos.length > 0,
    "Tom de resposta e pelo menos um exemplo de resposta",
    'Pergunte como a equipe costuma responder (formal ou informal, você ou senhor) e peça 1 ou 2 respostas reais boas; grave em rascunhos.tom e rascunhos.exemplos (arquivo "equipe").',
  );
  add(
    "assinatura",
    !!config.rascunhos.assinatura && !/seu nome|acme/i.test(config.rascunhos.assinatura),
    "Assinatura pessoal",
    'Pergunte como o usuário assina as mensagens; grave em rascunhos.assinatura no arquivo "pessoal".',
  );
  add(
    "conhecimento",
    docs.length > 0 && sampleDocs.length === 0,
    `Documentos da empresa (${docs.length} na pasta${sampleDocs.length ? `, ${sampleDocs.length} de exemplo fictício` : ""})`,
    sampleDocs.length
      ? `Remova ou reescreva os documentos de exemplo fictício: ${sampleDocs.join(", ")}.`
      : "Peça ao usuário as informações principais (planos e preços, prazos, políticas, perguntas frequentes) e salve cada assunto com aspa_save_knowledge. O formato de referência está na pasta exemplos/ do projeto.",
  );
  const slackReady = !!env.ASPA_SLACK_BOT_TOKEN && !!env.ASPA_SLACK_USER_ID;
  add(
    "slack",
    slackReady,
    "Aviso no Slack (token e ID do usuário)",
    !env.ASPA_SLACK_USER_ID
      ? "Peça o ID de membro do Slack (foto → Perfil → ⋮ → Copiar ID do membro, começa com U) e grave com aspa_configure_slack. O token o usuário cola sozinho no arquivo ~/.config/aspa-mcp/env (linha ASPA_SLACK_BOT_TOKEN=), sem mandar no chat."
      : "Falta o token: o usuário cola sozinho no arquivo ~/.config/aspa-mcp/env, linha ASPA_SLACK_BOT_TOKEN=xoxb-... (sem mandar no chat), e reinicia com systemctl --user restart aspa-mcp.",
  );
  add(
    "notificacoes",
    config.notificacoes.canais.length > 0,
    `Notificações (${config.notificacoes.abas.join(", ")}; ${config.notificacoes.dias.join(",")} ${config.notificacoes.horario.inicio}-${config.notificacoes.horario.fim})`,
    "Pergunte quando o usuário quer ser avisado e grave em notificacoes no arquivo pessoal.",
  );
  items.push({
    id: "transcricao",
    status: transcriptionEnabled() ? "ok" : "opcional",
    item: "Transcrição local de áudios",
    proximo_passo: transcriptionEnabled() ? undefined : "Opcional: no terminal, cd ~/dev/aspa-mcp && npm run setup-transcribe (cerca de 1 GB).",
  });

  const pending = items.filter((i) => i.status === "pendente");
  return {
    pronto: pending.length === 0,
    pendentes: pending.length,
    itens: items,
    proximo: pending[0]?.proximo_passo ?? "Tudo configurado. Sugira testar com aspa_test_notifications e listar as conversas.",
    arquivos: { equipe: TEAM_CONFIG, pessoal: PERSONAL_CONFIG, env: ENV_FILE, conhecimento: config.conhecimento.pasta },
  };
}

export function updateSettings({ file, changes }) {
  const target = FILES[file];
  if (!target) throw new Error('file must be "equipe" or "pessoal".');
  if (!changes || typeof changes !== "object" || !Object.keys(changes).length) throw new Error("No changes given.");
  const created = ensureConfigFiles();
  const original = readFileSync(target, "utf8");
  const doc = parseDocument(original);
  const applied = [];
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split(".").filter(Boolean);
    if (!keys.length || !/^(empresa|rascunhos|conhecimento|auditoria|notificacoes)$/.test(keys[0])) {
      throw new Error(`Unknown setting "${path}". Use paths under empresa, rascunhos, conhecimento, auditoria or notificacoes.`);
    }
    for (let depth = 1; depth < keys.length; depth++) {
      const prefix = keys.slice(0, depth);
      if (!isMap(doc.getIn(prefix, true))) doc.setIn(prefix, doc.createNode({}));
    }
    doc.setIn(keys, value);
    applied.push(path);
  }
  const backup = `${target}.bak`;
  writeFileSync(backup, original);
  writeFileSync(target, doc.toString());
  const { errors } = loadConfig();
  if (errors.length) {
    writeFileSync(target, original);
    throw new Error(`Settings not saved, they are invalid: ${errors.join("; ")}`);
  }
  let overridden;
  if (file === "equipe" && existsSync(PERSONAL_CONFIG)) {
    const personal = parseDocument(readFileSync(PERSONAL_CONFIG, "utf8"));
    overridden = applied.filter((path) => personal.getIn(path.split(".")) !== undefined);
  }
  return {
    saved: true,
    file: target,
    changed: applied,
    backup,
    created: created.length ? created : undefined,
    note: overridden?.length ? `These keys are also set in pessoal.yaml, which takes priority for this user: ${overridden.join(", ")}` : undefined,
  };
}

export function saveKnowledge({ path, content, overwrite = false }) {
  const { config } = loadConfig();
  const base = resolve(config.conhecimento.pasta);
  const cleanPath = String(path ?? "").trim();
  if (!cleanPath) throw new Error("path is required, e.g. produtos/plano-basico.md");
  const target = resolve(base, cleanPath);
  if (!target.startsWith(base + sep)) throw new Error("The document must stay inside the knowledge folder.");
  if (!TEXT_EXTENSIONS.has(extname(target).toLowerCase())) throw new Error("Use a text format: .md, .txt, .csv, .json or .yaml.");
  if (/EXEMPLO FICTÍCIO/i.test(content)) throw new Error("The content still has the 'EXEMPLO FICTÍCIO' marker. Write the real content.");
  const exists = existsSync(target);
  if (exists && !overwrite) throw new Error(`${relative(base, target)} already exists. Pass overwrite=true to replace it (a .bak copy is kept).`);
  mkdirSync(dirname(target), { recursive: true });
  if (exists) copyFileSync(target, `${target}.bak`);
  writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`);
  return { saved: true, file: relative(base, target), folder: base, replaced: exists };
}
