# Configuration: tone, rules and documents

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../configuracao.md)

Everything is configured in plain files under `~/.config/aspa-mcp/`:

| File | Who edits it | What it is for |
| --- | --- | --- |
| `equipe.yaml` | the team (same for everyone) | About the company, tone, default signature, rules, examples, documents, default notifications |
| `pessoal.yaml` | each agent | Your signature, your hours and your notification channels. **Takes precedence** over the team file |
| `conhecimento/` | the team | Documents that teach the assistant about the company |

**Changes take effect immediately**, with no restart needed.

### Templates and a ready-made example

The repository includes two folders so you don't have to start from scratch:

| Folder | What it is | How to use it |
| --- | --- | --- |
| [`modelos/`](../../modelos/) | **Blank**, commented files | `npm run init-config` copies them to `~/.config/aspa-mcp/`. You just fill them in |
| [`exemplos/`](../../exemplos/) | A **complete, filled-in** configuration for a fictional company (Acme Internet) | Open it to see what a real `equipe.yaml`, `pessoal.yaml` and knowledge folder look like. Copy the **format**, not the content |

```
exemplos/
├── equipe.yaml                      company, tone, rules, 4 sample replies, notifications
├── pessoal.yaml                     signature and commented notification combinations
└── conhecimento/
    ├── empresa.md                   who we are, channels, hours, SLA, internal teams
    ├── faq.md                       frequently asked questions with approved answers
    ├── politicas.md                 cancellation, refunds, technical visits, LGPD
    ├── respostas-modelo.md          approved phrases to open, ask for data, hand off and close
    ├── produtos/
    │   ├── plano-essencial.md       price, limits, what is and is not included
    │   └── plano-profissional.md
    └── procedimentos/
        ├── internet-lenta.md        questions, steps, when to escalate, what not to do
        └── acesso-ao-app.md
```

Suggested steps:

1. Run `npm run init-config` (creates the blank files).
2. Open `exemplos/equipe.yaml` next to your `~/.config/aspa-mcp/equipe.yaml` and fill yours in following the same format.
3. For each document in `exemplos/conhecimento/` that makes sense for you, create the real equivalent in `~/.config/aspa-mcp/conhecimento/`.
4. Ask the assistant: *"Show the Aspa guidelines"*. If any **warning** shows up, there is still a template or example value to replace.

> **Do not copy the example documents without editing them.** They contain made-up prices, deadlines and policies, marked with "EXEMPLO FICTÍCIO" (fictional example). If they stay in your knowledge folder, the guidelines tell the assistant not to use that data with customers.

```sh
nano ~/.config/aspa-mcp/equipe.yaml
nano ~/.config/aspa-mcp/pessoal.yaml
```

> Since the repository is public, do **not** put these files in it. Share `equipe.yaml` and the documents with the team through a private channel.

### About the company and the tone of drafts

```yaml
empresa:
  nome: "Company name"
  descricao: >
    What the company does, for whom, and what its main product is.

rascunhos:
  idioma: en
  tom: "Friendly, to the point and free of technical jargon. Address the customer informally."
  assinatura: "Support Team"
  saudacao_por_horario: true        # Bom dia / Boa tarde / Boa noite (good morning / afternoon / evening)
  tamanho_maximo: "up to 6 lines"
  sempre:
    - "Confirm you understood the problem before proposing a solution."
  nunca:
    - "Promise deadlines or prices that are not in the documents."
    - "Ask the customer for a password or verification code."
  quando_usar_template: "When the WhatsApp 24-hour window is closed."
  exemplos:
    - situacao: "Customer says they cannot access the system"
      resposta: |
        Good afternoon, Maria! I'm sorry for the trouble.
        Can you tell me whether any error message appears on the screen?
        Support Team
```

| Field | What it does |
| --- | --- |
| `empresa.nome`, `empresa.descricao` | Context about the company for every draft |
| `rascunhos.tom` | How to write (formal, informal, "você" or "senhor", the informal or formal "you") |
| `rascunhos.assinatura` | Signature at the end of the message (in `pessoal.yaml` each person sets their own) |
| `rascunhos.saudacao_por_horario` | Starts with Bom dia, Boa tarde or Boa noite (good morning, afternoon or evening) depending on the time |
| `rascunhos.tamanho_maximo` | Length limit |
| `rascunhos.sempre` / `rascunhos.nunca` | Rules The assistant follows in every draft (always / never) |
| `rascunhos.quando_usar_template` | When to prefer a WhatsApp template |
| `rascunhos.exemplos` | Sample replies for common situations (The assistant imitates the style) |

### Company documents

Put files in `~/.config/aspa-mcp/conhecimento/` (subfolders work). Formats: `.md`, `.txt`, `.pdf`, `.csv`, `.json`, `.yaml`.

```
conhecimento/
├── empresa.md          who we are, support hours
├── faq.md              frequently asked questions and approved answers
├── politicas.md        exchanges, cancellation, deadlines, SLA, LGPD
├── produtos/
│   ├── plano-basico.md
│   └── plano-avancado.md
└── procedimentos/
    └── sem-acesso.md
```

Before stating any fact in a draft, The assistant searches this folder. If it finds nothing, it asks instead of making something up. To change the folder: `conhecimento.pasta` in the YAML.

### When to receive notifications

```yaml
notificacoes:
  abas: [meus]                         # meus (mine), pendentes (pending), todos (all)
  apenas_mensagens_de_cliente: true    # only when a customer message arrives
  canais: [desktop, slack]             # desktop, slack, ntfy
  dias: [seg, ter, qua, qui, sex]      # dom, seg, ter, qua, qui, sex, sab (Sunday to Saturday)
  horario:
    inicio: "09:00"
    fim: "18:00"                       # goes past midnight? use inicio "22:00" and fim "06:00"
  fuso: America/Sao_Paulo
  fora_do_horario: acumular            # acumular: summary when the workday starts; ignorar: discard
  intervalo_minimo_minutos: 5          # at most 1 notification every 5 min per contact
  sessao_expirada: true                # notify when you need to sign in again
  atendentes: []                       # empty = any agent; or names; "sem_atendente" (no agent)
  contatos_incluir: []                 # if filled in, only notify for these contacts
  contatos_ignorar: []                 # never notify for these contacts
  nova_conversa: true                  # notify when a new conversation appears in the list
  mostrar_atendente: true              # show the agent in the notification
```

| Field | Options | Default |
| --- | --- | --- |
| `abas` | `meus`, `pendentes`, `todos` | `[meus]` |
| `apenas_mensagens_de_cliente` | `true` / `false` (also notify about replies from colleagues and from automation) | `true` |
| `canais` | `desktop`, `slack`, `ntfy` | all configured channels |
| `dias` | `dom` to `sab` | every day |
| `horario.inicio` / `horario.fim` | `HH:MM` | all day |
| `fuso` | IANA time zone | `America/Sao_Paulo` |
| `fora_do_horario` | `acumular`, `ignorar` | `acumular` |
| `intervalo_minimo_minutos` | number | `0` |
| `sessao_expirada` | `true` / `false` | `true` |
| `atendentes` | names (part of the name works), `sem_atendente` | any |
| `contatos_incluir` | parts of contact names | all |
| `contatos_ignorar` | parts of contact names | none |
| `nova_conversa` | `true` / `false` | `true` |
| `mostrar_atendente` | `true` / `false` | `true` |

Ready-made examples (paste into `pessoal.yaml`):

| I want to be notified about... | Configuration |
| --- | --- |
| Every new message, from any agent | `abas: [todos]` |
| Only my conversations | `abas: [meus]` |
| Mine and the ones nobody has picked up | `abas: [todos]` and `atendentes: [Seu Nome, sem_atendente]` |
| Only Ana's | `abas: [todos]` and `atendentes: [Ana]` |
| Everything except a test contact | `contatos_ignorar: [Teste]` |
| Only one important customer | `abas: [todos]` and `contatos_incluir: [ACME]` |

### Check the configuration

Ask the assistant:

```text
Show the Aspa guidelines and tell me whether there is any error in the configuration.
```

Or check the service log, which flags invalid values (and uses the default instead):

```sh
journalctl --user -u aspa-mcp -n 20
```
