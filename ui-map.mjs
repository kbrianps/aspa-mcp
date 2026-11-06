export const APP_ORIGIN = "https://app.aspa.chat";

export const LIST_URL = `${APP_ORIGIN}/atendimento`;

export const ICON_LINE = /^[a-z]+(_[a-z]+)+$/;

export const SNOOZE_LABELS = { "1h": "Em 1 hora", "1d": "Em 1 dia", "1w": "Em 1 semana" };

export const LIST_FILTERS = {
  sem_usuario: "Sem usuário",
  sem_resposta: "Sem resposta",
  em_automacao: "Em automação",
  com_contexto: "Com contexto",
  sessao_ativa: "Sessão ativa",
  sem_sessao_ativa: "Sem sessão ativa",
};

export const LIST_ORDER = { recentes: "Recentes primeiro", antigas: "Antigas primeiro" };
