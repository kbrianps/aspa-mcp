#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { call } from "./client.mjs";
import { greetingFor, loadConfig, PERSONAL_CONFIG, TEAM_CONFIG } from "./config.mjs";
import { listDocuments, readDocument, searchDocuments } from "./knowledge.mjs";

const server = new McpServer(
  { name: "aspa", version: "0.4.0" },
  {
    instructions:
      "Before writing any reply draft for an Aspa conversation, call aspa_get_guidelines and follow its tone, signature, rules and examples. " +
      "For facts about the company, products, prices, deadlines or policies, use aspa_search_knowledge and aspa_read_knowledge; never invent them, ask the customer or the user instead. " +
      "Write tools (send, transfer, snooze, conclude, reopen, rename) act on real customers: call them only after the user approved the exact action.",
  },
);

const asResult = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const asError = (error) => ({ isError: true, content: [{ type: "text", text: error.message }] });
const forward = (method) => async (args) => {
  try {
    return asResult(await call(method, args));
  } catch (error) {
    return asError(error);
  }
};

const target = {
  index: z.number().int().min(0).optional().describe("Index from aspa_list_conversations."),
  contact: z.string().optional().describe("Contact name (exact or unique case-insensitive part). Used instead of index."),
};
const READ = { readOnlyHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };
const APPROVAL =
  " This is a real action visible to the customer or the team. Only call it after the user explicitly approved this exact action in the conversation.";

const tools = [
  [
    "aspa_login",
    "login",
    "Open a visible Chrome window on the Aspa panel so the user logs in themselves (5 minute limit). Credentials are never passed through this tool.",
    {},
    { readOnlyHint: false },
  ],
  [
    "aspa_list_conversations",
    "listConversations",
    "List open Aspa Chat (WhatsApp) support conversations: index, contact, assigned agent, last activity time and unread flag.",
    { tab: z.enum(["todos", "meus", "pendentes"]).optional().describe("Panel filter tab. Defaults to todos.") },
    READ,
  ],
  [
    "aspa_read_conversation",
    "readConversation",
    "Return the messages of one conversation in order (inbound = customer, outbound = our team), the 24h response window and attachment metadata. Opening a conversation may mark it as read.",
    { ...target, loadMoreTimes: z.number().int().min(0).max(10).optional().describe("How many times to load older history.") },
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
    { ...target, text: z.string().min(1).describe("Exact message text in pt-BR.") },
    WRITE,
  ],
  [
    "aspa_send_template",
    "sendTemplate",
    "Send an approved WhatsApp template (works outside the 24h window)." + APPROVAL,
    {
      ...target,
      template: z.string().min(1).describe("Template name from aspa_list_templates."),
      variables: z.array(z.string()).optional().describe("Values for the template variables, in order."),
    },
    WRITE,
  ],
  [
    "aspa_send_attachment",
    "sendAttachment",
    "Send a local file (image, PDF, etc., up to 16 MB) to the customer, with an optional caption." + APPROVAL,
    { ...target, path: z.string().min(1).describe("Absolute path of the local file."), caption: z.string().optional() },
    WRITE,
  ],
  [
    "aspa_transfer",
    "transfer",
    "Transfer (or assign) a conversation to an agent or team. Transferring to yourself assumes it." + APPROVAL,
    { ...target, to: z.string().min(1).describe("Agent or team name as shown in Aspa."), comment: z.string().optional() },
    WRITE,
  ],
  [
    "aspa_snooze",
    "snooze",
    "Snooze (adiar) a conversation for 1 hour, 1 day or 1 week." + APPROVAL,
    { ...target, duration: z.enum(["1h", "1d", "1w"]) },
    WRITE,
  ],
  ["aspa_conclude", "conclude", "Conclude a conversation and report whether it left the open list." + APPROVAL, target, WRITE],
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
    { ...target, name: z.string().min(1) },
    WRITE,
  ],
];

for (const [name, method, description, inputSchema, annotations] of tools) {
  server.registerTool(name, { description, inputSchema, annotations }, forward(method));
}

const local = (fn) => async (args) => {
  try {
    return asResult(await fn(args));
  } catch (error) {
    return asError(error);
  }
};

server.registerTool(
  "aspa_get_guidelines",
  {
    description:
      "Return the team and personal guidelines for reply drafts (company summary, tone, signature, greeting for the current time, length, always/never rules, template policy, examples), the notification settings and the list of company knowledge documents. Call it before writing any draft.",
    inputSchema: {},
    annotations: READ,
  },
  local(() => {
    const { config, sources, errors } = loadConfig();
    const drafts = config.rascunhos;
    return {
      arquivos_de_configuracao: { equipe: TEAM_CONFIG, pessoal: PERSONAL_CONFIG, carregados: sources },
      erros_de_configuracao: errors.length ? errors : undefined,
      empresa: config.empresa,
      rascunhos: { ...drafts, saudacao_sugerida: drafts.saudacao_por_horario ? greetingFor(config.notificacoes.fuso) : undefined },
      notificacoes: config.notificacoes,
      conhecimento: { pasta: config.conhecimento.pasta, documentos: listDocuments(config.conhecimento.pasta) },
    };
  }),
);

server.registerTool(
  "aspa_search_knowledge",
  {
    description:
      "Search the local company knowledge documents (accent and case insensitive; all words must appear on the same line). Returns file, line and a short excerpt. Use it before stating facts about the company in a draft.",
    inputSchema: { query: z.string().min(1).describe("Words to search, in pt-BR."), limit: z.number().int().min(1).max(50).optional() },
    annotations: READ,
  },
  local(({ query, limit }) => {
    const { config } = loadConfig();
    return { pasta: config.conhecimento.pasta, resultados: searchDocuments(config.conhecimento.pasta, query, limit) };
  }),
);

server.registerTool(
  "aspa_read_knowledge",
  {
    description: "Read one company knowledge document by its relative path from aspa_get_guidelines (Markdown, text, CSV, JSON, YAML or PDF).",
    inputSchema: { file: z.string().min(1).describe("Relative path, e.g. produtos/planos.md") },
    annotations: READ,
  },
  local(({ file }) => readDocument(loadConfig().config.conhecimento.pasta, file)),
);

await server.connect(new StdioServerTransport());
