# Technical reference

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../referencia.md)

### Components

| File | Role |
| --- | --- |
| `index.mjs` | MCP server (stdio) used by Claude Code; guidelines and documents are read here |
| `daemon.mjs` | Background service: Chrome, action queue, watcher and notifications; socket `$XDG_RUNTIME_DIR/aspa-mcp.sock` (600) |
| `aspa.mjs` | Aspa panel automation |
| `config.mjs` | Reads and validates `equipe.yaml` + `pessoal.yaml`, schedule and greeting |
| `knowledge.mjs` | Lists, searches and reads the documents |
| `notify.mjs` | Notification channels (Ubuntu, Slack, ntfy) |
| `audit.mjs` | Audit log of write actions |
| `transcribe.py` | Local transcription with faster-whisper |

### MCP tools

| Tool | Type | What it does |
| --- | --- | --- |
| `aspa_setup_check` | setup | Checklist of what is ready and what is missing, with the next step |
| `aspa_update_settings` | setup | Changes `equipe.yaml` or `pessoal.yaml` (keeps comments, saves a `.bak`, validates and rolls back if invalid) |
| `aspa_save_knowledge` | setup | Creates or updates a document in the knowledge folder |
| `aspa_configure_slack` | setup | Saves your Slack member ID (you paste the token yourself) |
| `aspa_test_notifications` | setup | Sends a test notification and shows what failed |
| `aspa_update` | setup | Updates aspa-mcp to the latest version and restarts the service |
| `aspa_audit_log` | read | Audit log of the actions taken in Aspa (filters: contact, action, date) |
| `aspa_get_guidelines` | read | Company, tone, signature, time-of-day greeting, rules, examples, notifications and list of documents |
| `aspa_search_knowledge` | read | Searches the documents (accent-insensitive) |
| `aspa_read_knowledge` | read | Reads a document |
| `aspa_login` | session | Window for you to sign in to Aspa (up to 5 min) |
| `aspa_list_conversations` | read | Lists conversations (`tab`; `filters`: sem_usuario, sem_resposta, em_automacao, com_contexto, sessao_ativa, sem_sessao_ativa; `order`: recentes, antigas) |
| `aspa_read_conversation` | read | Messages by `index` or `contact`; `loadMoreTimes` loads more history; `keepUnread` keeps it unread |
| `aspa_search_conversation` | read | Searches for words inside a conversation |
| `aspa_statistics` | read | Panel statistics (today, active, no reply, snoozed, per agent) |
| `aspa_quick_replies` | read | Saved **Respostas Rápidas** (Quick Replies) |
| `aspa_list_concluded` | read | Closed conversations, with name search and pagination |
| `aspa_search_contact` | read | Searches for a contact by name or phone number |
| `aspa_download_attachments` | read | Saves attachments to `~/.cache/aspa-mcp/attachments/<contato>/` |
| `aspa_transcribe_audio` | read, optional | Transcribes audio locally |
| `aspa_list_templates` | read | Approved WhatsApp templates |
| `aspa_send_message` | write | Free text (24-hour window) |
| `aspa_send_template` | write | Template with `variables` |
| `aspa_send_attachment` | write | Local file (up to 16 MB) with caption |
| `aspa_open_draft` | window | Opens Aspa with the draft in the message box so you can review and send it |
| `aspa_reply_to_message` | write | Replies quoting a message (`messageIndex`) |
| `aspa_assume` | write | Takes over a conversation with no agent or assigned to another agent |
| `aspa_transfer` | write | Transfers **your own** conversation to another agent or team (Aspa does not let you transfer someone else's conversation: take it over instead) |
| `aspa_mark_unread` | write | Marks as unread |
| `aspa_snooze` | write | Snoozes for `1h`, `1d` or `1w` and verifies |
| `aspa_snooze_until` | write | Snoozes until a date and time (`YYYY-MM-DD`, `HH:MM` in 15-minute steps), with a comment |
| `aspa_create_contact` | write | Creates a contact (name and phone number); refuses a phone number that already exists and verifies afterwards |
| `aspa_block_promotions` | write | Turns **Bloquear Promoções** (Block Promotions) on or off |
| `aspa_conclude` | write | Closes and verifies |
| `aspa_reopen` | write | Reopens (conversations closed in the last week) and verifies |
| `aspa_rename_contact` | write | Renames and verifies the saved name |

Write tools verify the result in the panel and return an error instead of reporting success when the action did not work.

Setup tools only touch your local files (never Aspa) and are also available in read-only mode. The MCP also offers the `configurar` prompt (in Claude Code: `/mcp__aspa__configurar`).

### Environment variables

They live in `~/.config/aspa-mcp/env` (restart the service afterwards). Usage preferences live in the YAML files.

| Variable | Default | What it is for |
| --- | --- | --- |
| `ASPA_SLACK_BOT_TOKEN` | (empty) | Bot token for the Aspa Chat app (`xoxb-...`) |
| `ASPA_SLACK_USER_ID` | (empty) | Your Slack member ID (`U...`) |
| `ASPA_SLACK_WEBHOOK_URL` | (empty) | Alternative: post to a channel through a webhook |
| `ASPA_NTFY_URL` | (empty) | ntfy topic |
| `ASPA_NTFY_SHOW_CONTACT` | `0` | `1` shows the contact in ntfy |
| `ASPA_CONFIG_DIR` | `~/.config/aspa-mcp` | Folder for the configuration files |
| `ASPA_TEAM_CONFIG` / `ASPA_PERSONAL_CONFIG` | `equipe.yaml` / `pessoal.yaml` in the folder above | Alternative paths |
| `ASPA_CHROME_PATH` | `/usr/bin/google-chrome` | Chrome |
| `ASPA_PROFILE_DIR` | `~/.local/share/aspa-mcp/profile` | Profile with the Aspa session |
| `ASPA_CACHE_DIR` | `~/.cache/aspa-mcp` | Downloaded attachments |
| `ASPA_SOCKET` | `$XDG_RUNTIME_DIR/aspa-mcp.sock` | Service socket |
| `ASPA_READ_ONLY` | `0` | `1` exposes only the read tools, login and the review window (use it in other clients) |
| `ASPA_WATCH` | `1` | `0` turns off the watcher |
| `ASPA_WATCH_INTERVAL_MS` | `20000` | Watcher interval |
| `ASPA_WHISPER_DIR` | `/var/tmp/aspa-mcp/whisper` | Transcription install location |
| `ASPA_WHISPER_MODEL` | `small` | Whisper model |
| `ASPA_WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |

### Commands

| Command | What it does |
| --- | --- |
| `npm run install-service` | Installs and starts the service |
| `npm run init-config` | Creates `equipe.yaml`, `pessoal.yaml` and `conhecimento/` |
| `npm run daemon` | Runs the service in the terminal |
| `npm run smoke -- --login` | Login window |
| `npm run smoke -- "<contato>"` | Quick read test |
| `npm run test-notify` | Test notification on the configured channels |
| `npm run auditoria -- [quantidade] [contato]` | Shows the audit log |
| `npm run setup-transcribe` | Installs local transcription |
| `npm run atualizar` | Updates aspa-mcp and restarts the service |
| `npm run slack -- [seu ID]` | Sets up Slack notifications: asks for the token with hidden typing, validates, saves and tests |

### Technical limitations

- It depends on the structure of the Aspa panel; if Aspa changes the layout, things may break.
- Reopening only finds conversations closed in the last week.
- The panel sometimes does not load other people's agent names in the service's session: the conversation shows as assigned (`assigned: true`) with `agent: null`. In those cases the notification filter by agent name does not fire; `sem_atendente` remains reliable.

### Editing the diagrams

The images in `assets/*.png` are generated from `assets/*.mmd` (Mermaid), with a light background so they stay readable in both GitHub's light and dark themes:

```sh
npx -y @mermaid-js/mermaid-cli -i assets/arquitetura.mmd -o assets/arquitetura.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/atendimento.mmd -o assets/atendimento.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/architecture.en.mmd -o assets/architecture.en.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/flow.en.mmd -o assets/flow.en.png -b "#FBF8FF" -s 2
```

### Do I need `/chrome` (Claude in Chrome)?

No. aspa-mcp has its own invisible Chrome. `/chrome` is only useful if you want Claude to look at Aspa open in **your** browser.
