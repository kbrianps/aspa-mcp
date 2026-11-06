import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

export const CONFIG_DIR = process.env.ASPA_CONFIG_DIR || join(homedir(), ".config", "aspa-mcp");
export const TEAM_CONFIG = process.env.ASPA_TEAM_CONFIG || join(CONFIG_DIR, "equipe.yaml");
export const PERSONAL_CONFIG = process.env.ASPA_PERSONAL_CONFIG || join(CONFIG_DIR, "pessoal.yaml");

const DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const TABS = ["meus", "pendentes", "todos"];
const CHANNELS = ["desktop", "slack", "ntfy"];

export const DEFAULTS = {
  empresa: { nome: "", descricao: "" },
  rascunhos: {
    idioma: "pt-BR",
    tom: "Cordial, objetivo e sem jargão técnico.",
    assinatura: "",
    saudacao_por_horario: true,
    tamanho_maximo: "",
    sempre: [],
    nunca: [],
    quando_usar_template: "Quando a janela de 24h do WhatsApp estiver fechada.",
    exemplos: [],
  },
  conhecimento: { pasta: join(CONFIG_DIR, "conhecimento") },
  auditoria: { arquivo: "", incluir_texto: true },
  notificacoes: {
    abas: ["meus"],
    apenas_mensagens_de_cliente: true,
    atendentes: [],
    contatos_incluir: [],
    contatos_ignorar: [],
    nova_conversa: true,
    mostrar_atendente: true,
    canais: ["desktop", "slack", "ntfy"],
    dias: [...DAYS],
    horario: { inicio: "00:00", fim: "23:59" },
    fuso: "America/Sao_Paulo",
    fora_do_horario: "acumular",
    intervalo_minimo_minutos: 0,
    sessao_expirada: true,
  },
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

function merge(base, override) {
  if (!isObject(override)) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined) continue;
    result[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return result;
}

function readYaml(path, errors) {
  if (!existsSync(path)) return null;
  let data;
  try {
    data = parse(readFileSync(path, "utf8")) ?? {};
  } catch (error) {
    errors.push(`${path}: ${error.message.split("\n")[0]}`);
    return null;
  }
  if (!isObject(data)) {
    errors.push(`${path}: o arquivo precisa ter seções como empresa, rascunhos e notificacoes`);
    return {};
  }
  for (const section of Object.keys(DEFAULTS)) {
    if (data[section] !== undefined && data[section] !== null && !isObject(data[section])) {
      errors.push(`${section}: precisa ser uma seção com campos, não um valor solto (${path}); usando o padrão`);
      delete data[section];
    }
  }
  return data;
}

const expandHome = (path) => (typeof path === "string" && path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const BOOLEANS = [
  ["rascunhos", "saudacao_por_horario"],
  ["auditoria", "incluir_texto"],
  ["notificacoes", "apenas_mensagens_de_cliente"],
  ["notificacoes", "nova_conversa"],
  ["notificacoes", "mostrar_atendente"],
  ["notificacoes", "sessao_expirada"],
];
const OPEN_FIELDS = new Set(["empresa"]);

function unknownKeys(value, defaults, prefix, warnings) {
  if (!isObject(value) || !isObject(defaults)) return;
  for (const key of Object.keys(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in defaults)) {
      if (!OPEN_FIELDS.has(prefix)) warnings.push(`${path}: campo desconhecido (erro de digitação?); será ignorado`);
      continue;
    }
    unknownKeys(value[key], defaults[key], path, warnings);
  }
}

function validate(config, errors) {
  for (const [section, defaults] of Object.entries(DEFAULTS)) {
    if (!isObject(config[section])) {
      errors.push(`${section}: precisa ser uma seção com campos, não um valor solto; usando o padrão`);
      config[section] = structuredClone(defaults);
    }
  }
  if (!isObject(config.notificacoes.horario)) {
    errors.push("notificacoes.horario: use inicio e fim no formato HH:MM");
    config.notificacoes.horario = { ...DEFAULTS.notificacoes.horario };
  }
  for (const [section, field] of BOOLEANS) {
    const value = config[section][field];
    if (typeof value !== "boolean") {
      errors.push(`${section}.${field}: use true ou false (sem aspas), não "${value}"`);
      config[section][field] = DEFAULTS[section][field];
    }
  }
  const n = config.notificacoes;
  const filtered = (field, allowed) => {
    const values = asList(n[field]).map((v) => String(v).toLowerCase());
    const invalid = values.filter((v) => !allowed.includes(v));
    if (invalid.length) errors.push(`notificacoes.${field}: valores inválidos ${invalid.join(", ")} (use ${allowed.join(", ")})`);
    return values.filter((v) => allowed.includes(v));
  };
  n.abas = filtered("abas", TABS);
  if (!n.abas.length) n.abas = [...DEFAULTS.notificacoes.abas];
  n.canais = filtered("canais", CHANNELS);
  n.dias = filtered("dias", DAYS);
  for (const edge of ["inicio", "fim"]) {
    if (!validTime(n.horario?.[edge])) {
      errors.push(`notificacoes.horario.${edge}: use o formato HH:MM`);
      n.horario = { ...DEFAULTS.notificacoes.horario, ...n.horario, [edge]: DEFAULTS.notificacoes.horario[edge] };
    }
  }
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: n.fuso });
  } catch {
    errors.push(`notificacoes.fuso: fuso inválido "${n.fuso}"`);
    n.fuso = DEFAULTS.notificacoes.fuso;
  }
  if (!["acumular", "ignorar"].includes(n.fora_do_horario)) {
    errors.push('notificacoes.fora_do_horario: use "acumular" ou "ignorar"');
    n.fora_do_horario = DEFAULTS.notificacoes.fora_do_horario;
  }
  n.intervalo_minimo_minutos = Math.max(0, Number(n.intervalo_minimo_minutos) || 0);
  for (const field of ["atendentes", "contatos_incluir", "contatos_ignorar"]) {
    const values = asList(n[field]).map(String);
    if (values.some((v) => !v.trim())) errors.push(`notificacoes.${field}: tem um nome vazio, que foi ignorado`);
    n[field] = values.filter((v) => v.trim());
  }
  config.rascunhos.sempre = asList(config.rascunhos.sempre);
  config.rascunhos.nunca = asList(config.rascunhos.nunca);
  config.rascunhos.exemplos = asList(config.rascunhos.exemplos);
  if (typeof config.conhecimento.pasta !== "string" || !config.conhecimento.pasta.trim()) {
    errors.push("conhecimento.pasta: informe o caminho de uma pasta");
    config.conhecimento.pasta = DEFAULTS.conhecimento.pasta;
  }
  if (typeof config.auditoria.arquivo !== "string") {
    errors.push("auditoria.arquivo: informe o caminho de um arquivo ou deixe vazio");
    config.auditoria.arquivo = "";
  }
  config.conhecimento.pasta = expandHome(config.conhecimento.pasta);
  config.auditoria.arquivo = expandHome(config.auditoria.arquivo);
  return config;
}

export function loadConfig() {
  const errors = [];
  const team = readYaml(TEAM_CONFIG, errors);
  const personal = readYaml(PERSONAL_CONFIG, errors);
  unknownKeys(team, DEFAULTS, "", errors);
  unknownKeys(personal, DEFAULTS, "", errors);
  const config = validate(merge(merge(structuredClone(DEFAULTS), team), personal), errors);
  const sources = [team && TEAM_CONFIG, personal && PERSONAL_CONFIG].filter(Boolean);
  return { config, sources, errors };
}

function localParts(timeZone, date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const day = DAYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)];
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function withinSchedule(notifications, date = new Date()) {
  const { day, minutes } = localParts(notifications.fuso, date);
  if (!notifications.dias.includes(day)) return false;
  const start = toMinutes(notifications.horario.inicio);
  const end = toMinutes(notifications.horario.fim);
  return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
}

export function greetingFor(timeZone, date = new Date()) {
  const hour = Math.floor(localParts(timeZone, date).minutes / 60);
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export const normalizeName = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export function passesFilters(n, item) {
  const contact = normalizeName(item.contact);
  if (n.contatos_ignorar.some((name) => contact.includes(normalizeName(name)))) return false;
  if (n.contatos_incluir.length && !n.contatos_incluir.some((name) => contact.includes(normalizeName(name)))) return false;
  if (n.atendentes.length) {
    const agent = normalizeName(item.agent);
    const wanted = n.atendentes.map(normalizeName);
    const assigned = item.assigned ?? !!item.agent;
    const words = ` ${agent.replace(/\s+/g, " ")} `;
    const match = assigned
      ? !!item.agent && wanted.some((name) => name !== "sem_atendente" && words.includes(` ${name.replace(/\s+/g, " ")} `))
      : wanted.includes("sem_atendente");
    if (!match) return false;
  }
  return true;
}
