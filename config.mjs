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
  notificacoes: {
    abas: ["meus"],
    apenas_mensagens_de_cliente: true,
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
    result[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return result;
}

function readYaml(path, errors) {
  if (!existsSync(path)) return null;
  try {
    return parse(readFileSync(path, "utf8")) ?? {};
  } catch (error) {
    errors.push(`${path}: ${error.message.split("\n")[0]}`);
    return null;
  }
}

const expandHome = (path) => (typeof path === "string" && path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function validate(config, errors) {
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
  config.rascunhos.sempre = asList(config.rascunhos.sempre);
  config.rascunhos.nunca = asList(config.rascunhos.nunca);
  config.rascunhos.exemplos = asList(config.rascunhos.exemplos);
  config.conhecimento.pasta = expandHome(config.conhecimento.pasta);
  return config;
}

export function loadConfig() {
  const errors = [];
  const team = readYaml(TEAM_CONFIG, errors);
  const personal = readYaml(PERSONAL_CONFIG, errors);
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
