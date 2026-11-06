import { z } from "zod";

const target = {
  index: z.number().int().min(0).optional().describe("Index from aspa_list_conversations."),
  contact: z.string().optional().describe("Contact name (exact or unique case-insensitive part). Used instead of index."),
};
const writeTarget = {
  contact: z.string().min(1).describe("Contact name exactly as listed. Required for every action that changes a conversation."),
  index: z.number().int().min(0).optional().describe("Index from aspa_list_conversations, only to tell apart contacts with the same name."),
  conversation_id: z
    .string()
    .optional()
    .describe("conversation_id returned by aspa_read_conversation. When given, the action is refused if the open conversation is a different one."),
};
const duplicateOverride = {
  confirm_duplicate: z.boolean().optional().describe("Only true when the user explicitly wants to repeat the same message sent less than 2 minutes ago."),
};
const READ = { readOnlyHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };
const APPROVAL =
  " This is a real action visible to the customer or the team. Only call it after the user explicitly approved this exact action in the conversation.";

const TUPLES = [
  [
    "aspa_login",
    "login",
    "Open a visible Chrome window on the Aspa panel so the user logs in themselves (5 minute limit). Returns as soon as the window is open; tell the user to log in there and then call aspa_setup_check to confirm. Credentials are never passed through this tool.",
    {},
    { readOnlyHint: false },
  ],
  [
    "aspa_list_conversations",
    "listConversations",
    "List open Aspa Chat (WhatsApp) support conversations: index, contact, assigned agent, last activity time and unread flag.",
    {
      tab: z.enum(["todos", "meus", "pendentes"]).optional().describe("Panel filter tab. Defaults to todos."),
      filters: z
        .array(z.enum(["sem_usuario", "sem_resposta", "em_automacao", "com_contexto", "sessao_ativa", "sem_sessao_ativa"]))
        .optional()
        .describe("Panel list filters, applied only for this listing and removed afterwards."),
      order: z.enum(["recentes", "antigas"]).optional().describe("recentes (default) or antigas (oldest first)."),
      limit: z.number().int().min(1).max(200).optional().describe("Maximum conversations to return (default 50)."),
      cursor: z.number().int().min(0).optional().describe("next_cursor from the previous page."),
    },
    READ,
  ],
  [
    "aspa_read_conversation",
    "readConversation",
    "Return the messages of one conversation in order (inbound = customer, outbound = our team), the 24h response window and attachment metadata. Unread conversations are marked unread again after reading (keepUnread defaults to true). Returns conversation_id: pass it to write tools.",
    {
      ...target,
      loadMoreTimes: z.number().int().min(0).max(10).optional().describe("How many times to load older history."),
      keepUnread: z.boolean().optional().describe("Default true: an unread conversation stays unread after reading. Pass false to mark it as read."),
    },
    READ,
  ],
  [
    "aspa_download_attachments",
    "downloadAttachments",
    "Download attachments (images, documents, audio, video) of a conversation to a local folder and return the file paths, so they can be opened with the Read tool. Audio is not transcribed.",
    {
      ...target,
      loadMoreTimes: z.number().int().min(0).max(10).optional(),
      messageIndexes: z.array(z.number().int().min(0)).optional().describe("Item indexes from aspa_read_conversation. Omit for all."),
    },
    READ,
  ],
  [
    "aspa_transcribe_audio",
    "transcribeAudio",
    "Transcribe customer audio messages locally with Whisper (pt-BR). Optional feature: if it is not installed, the error explains how to enable it. Audio never leaves the machine.",
    {
      ...target,
      loadMoreTimes: z.number().int().min(0).max(10).optional(),
      messageIndexes: z.array(z.number().int().min(0)).optional().describe("Item indexes from aspa_read_conversation. Omit for all audio."),
    },
    READ,
  ],
  [
    "aspa_search_conversation",
    "searchConversation",
    "Search words inside one conversation (accent and case insensitive), loading older history first.",
    { ...target, query: z.string().min(1), loadMoreTimes: z.number().int().min(0).max(10).optional() },
    READ,
  ],
  ["aspa_statistics", "statistics", "Aspa dashboard: conversations today, active, concluded, without reply, snoozed, and per-agent counts.", {}, READ],
  ["aspa_quick_replies", "quickReplies", "List the team's quick replies (Respostas Rápidas) registered in Aspa, to reuse their wording in drafts.", {}, READ],
  [
    "aspa_list_concluded",
    "listConcluded",
    "List concluded conversations (last week by default), with optional name search and pagination.",
    { query: z.string().optional(), pageNumber: z.number().int().min(1).max(50).optional() },
    READ,
  ],
  [
    "aspa_search_contact",
    "searchContact",
    "Search Aspa contacts by name or phone, including contacts without an open conversation.",
    { query: z.string().min(1) },
    READ,
  ],
  [
    "aspa_list_templates",
    "listTemplates",
    "List approved WhatsApp message templates (name and preview) available for a conversation.",
    target,
    READ,
  ],
  [
    "aspa_send_message",
    "sendMessage",
    "Send a free-text WhatsApp message to the customer. Only works inside the 24h response window." + APPROVAL,
    { ...writeTarget, text: z.string().min(1).describe("Exact message text in pt-BR."), ...duplicateOverride },
    WRITE,
  ],
  [
    "aspa_send_template",
    "sendTemplate",
    "Send an approved WhatsApp template (works outside the 24h window)." + APPROVAL,
    {
      ...writeTarget,
      template: z.string().min(1).describe("Template name from aspa_list_templates."),
      variables: z.array(z.string()).optional().describe("Values for the template variables, in order."),
      ...duplicateOverride,
    },
    WRITE,
  ],
  [
    "aspa_send_attachment",
    "sendAttachment",
    "Send a local file (image, PDF, etc., up to 16 MB) to the customer, with an optional caption." + APPROVAL,
    {
      ...writeTarget,
      path: z.string().min(1).describe("Absolute path of a file in the user's home folder (not hidden folders), /tmp or a downloaded attachment."),
      caption: z.string().optional(),
      ...duplicateOverride,
    },
    WRITE,
  ],
  [
    "aspa_transfer",
    "transfer",
    "Transfer (or assign) a conversation to an agent or team. Transferring to yourself assumes it." + APPROVAL,
    { ...writeTarget, to: z.string().min(1).describe("Agent or team name as shown in Aspa."), comment: z.string().optional() },
    WRITE,
  ],
  [
    "aspa_open_draft",
    "openDraft",
    "Open a visible Aspa window on the conversation with the reply box pre-filled with the draft, so the user reviews, edits and sends it themselves in the official panel. Returns as soon as the window is open; the user closes it when done (default limit 20 minutes). While it is open, other Aspa actions and notifications are paused. Whether the user sent it is recorded in the audit log. Use this instead of aspa_send_message when the user wants to review in Aspa.",
    { ...writeTarget, text: z.string().min(1).describe("Draft text in pt-BR."), timeoutMinutes: z.number().int().min(1).max(60).optional() },
    { readOnlyHint: false, openWorldHint: true },
  ],
  [
    "aspa_reply_to_message",
    "replyToMessage",
    "Reply quoting a specific message (WhatsApp reply). messageIndex comes from aspa_read_conversation." + APPROVAL,
    {
      ...writeTarget,
      messageIndex: z.number().int().min(0),
      quoted_text: z.string().min(3).describe("A short excerpt of the message being quoted, copied from aspa_read_conversation, to make sure the right message is quoted."),
      text: z.string().min(1).describe("Exact reply text in pt-BR."),
      loadMoreTimes: z.number().int().min(0).max(10).optional(),
      ...duplicateOverride,
    },
    WRITE,
  ],
  [
    "aspa_mark_unread",
    "markUnread",
    "Mark a conversation as unread in the Aspa panel." + APPROVAL,
    writeTarget,
    WRITE,
  ],
  [
    "aspa_snooze_until",
    "snoozeUntil",
    "Snooze a conversation until a specific date and time (Brasília time, 15-minute steps), with an optional internal comment." + APPROVAL,
    {
      ...writeTarget,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").describe("YYYY-MM-DD"),
      time: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Use HH:MM in 15-minute steps.").describe("HH:MM, minutes 00/15/30/45"),
      comment: z.string().optional(),
    },
    WRITE,
  ],
  [
    "aspa_create_contact",
    "createContact",
    "Create a new contact in Aspa (name and phone with country and area code, e.g. 5541999999999)." + APPROVAL,
    {
      name: z.string().min(1),
      phone: z
        .string()
        .regex(/^\+?[\d\s().-]{10,20}$/, "Use the full number with country and area code, e.g. 5541999999999.")
        .describe("Full number with country and area code, e.g. 5541999999999."),
    },
    WRITE,
  ],
  [
    "aspa_block_promotions",
    "setPromotionsBlocked",
    "Turn 'Bloquear Promoções' on or off for a contact." + APPROVAL,
    { ...writeTarget, blocked: z.boolean() },
    WRITE,
  ],
  [
    "aspa_assume",
    "assume",
    "Assume (take) a conversation by clicking 'Assumir' in the Aspa panel: works for conversations without an agent and for conversations assigned to another agent. Required before replying to a conversation that is not yours." + APPROVAL,
    writeTarget,
    WRITE,
  ],
  [
    "aspa_snooze",
    "snooze",
    "Snooze (adiar) a conversation for 1 hour, 1 day or 1 week." + APPROVAL,
    { ...writeTarget, duration: z.enum(["1h", "1d", "1w"]) },
    WRITE,
  ],
  ["aspa_conclude", "conclude", "Conclude a conversation and report whether it left the open list." + APPROVAL, writeTarget, WRITE],
  [
    "aspa_reopen",
    "reopen",
    "Reopen a concluded conversation from 'Atendimentos Concluídos' (experimental)." + APPROVAL,
    { contact: z.string().min(1) },
    WRITE,
  ],
  [
    "aspa_rename_contact",
    "renameContact",
    "Rename the contact of a conversation in Aspa." + APPROVAL,
    { ...writeTarget, name: z.string().min(1) },
    WRITE,
  ],
];

const AUDIT_LABELS = {
  sendMessage: "enviar_mensagem",
  sendTemplate: "enviar_template",
  sendAttachment: "enviar_anexo",
  transfer: "transferir",
  assume: "assumir",
  snooze: "adiar",
  snoozeUntil: "adiar_ate",
  conclude: "concluir",
  reopen: "reabrir",
  renameContact: "renomear_contato",
  openDraft: "abrir_rascunho",
  markUnread: "marcar_nao_lida",
  replyToMessage: "responder_citando",
  createContact: "criar_contato",
  setPromotionsBlocked: "bloquear_promocoes",
};

const kindOf = (name, annotations) =>
  name === "aspa_login" ? "session" : name === "aspa_open_draft" ? "review" : annotations.readOnlyHint ? "read" : "write";

export const TOOLS = TUPLES.map(([name, method, description, inputSchema, annotations]) => ({
  name,
  method,
  description,
  inputSchema,
  annotations,
  kind: kindOf(name, annotations),
  audit: AUDIT_LABELS[method],
}));

export const TITLES = {
  aspa_login: "Entrar no Aspa",
  aspa_list_conversations: "Listar conversas",
  aspa_read_conversation: "Ler conversa",
  aspa_download_attachments: "Baixar anexos",
  aspa_transcribe_audio: "Transcrever áudios",
  aspa_search_conversation: "Buscar na conversa",
  aspa_statistics: "Estatísticas",
  aspa_quick_replies: "Respostas rápidas",
  aspa_list_concluded: "Conversas concluídas",
  aspa_search_contact: "Buscar contato",
  aspa_list_templates: "Listar templates",
  aspa_send_message: "Enviar mensagem",
  aspa_send_template: "Enviar template",
  aspa_send_attachment: "Enviar anexo",
  aspa_transfer: "Transferir conversa",
  aspa_open_draft: "Abrir rascunho no Aspa",
  aspa_reply_to_message: "Responder citando",
  aspa_mark_unread: "Marcar como não lida",
  aspa_snooze_until: "Adiar até data",
  aspa_create_contact: "Criar contato",
  aspa_block_promotions: "Bloquear promoções",
  aspa_assume: "Assumir conversa",
  aspa_snooze: "Adiar conversa",
  aspa_conclude: "Concluir conversa",
  aspa_reopen: "Reabrir conversa",
  aspa_rename_contact: "Renomear contato",
  aspa_get_guidelines: "Diretrizes de resposta",
  aspa_setup_check: "Checklist de configuração",
  aspa_update: "Atualizar o aspa-mcp",
  aspa_update_settings: "Alterar configuração",
  aspa_save_knowledge: "Salvar documento",
  aspa_configure_slack: "Configurar Slack",
  aspa_test_notifications: "Testar avisos",
  aspa_audit_log: "Registro de auditoria",
  aspa_search_knowledge: "Buscar nos documentos",
  aspa_read_knowledge: "Ler documento",
};

const IDEMPOTENT = new Set(["markUnread", "setPromotionsBlocked", "renameContact", "assume"]);
for (const tool of TOOLS) {
  tool.title = TITLES[tool.name];
  tool.annotations = { ...tool.annotations, title: tool.title, ...(IDEMPOTENT.has(tool.method) ? { idempotentHint: true } : {}) };
}

export const READ_ONLY_KINDS = new Set(["read", "session", "review"]);
export const WRITE_METHODS = new Set(TOOLS.filter((tool) => tool.audit).map((tool) => tool.method));

export const LOCAL_AUDIT_LABELS = {
  draftClosed: "rascunho_fechado",
  login: "login",
  updateSettings: "alterar_configuracao",
  saveKnowledge: "salvar_documento",
  configureSlack: "configurar_slack",
  update: "atualizar",
};

export const ACTION_LABELS = { ...AUDIT_LABELS, ...LOCAL_AUDIT_LABELS };
