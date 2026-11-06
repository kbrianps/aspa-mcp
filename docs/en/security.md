# Security and privacy

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../seguranca.md)

### Audit log

Every action aspa-mcp takes that changes something in Aspa is logged, **including attempts that failed**:

| Logged action | What the log keeps |
| --- | --- |
| Send message | text sent |
| Send template | template name and variables |
| Send attachment | file name, size and SHA-256, caption |
| Transfer / take over | destination and comment |
| Snooze / snooze until | duration or date and time, comment |
| Close / reopen / mark as unread | contact |
| Reply quoting | quoted message and text |
| Open draft in Aspa / draft closed | text, and whether you sent it from the window |
| Create contact | name and phone number |
| Block promotions | on or off |
| Rename contact | new name |

Each entry also has: date and time, duration, user and computer, contact, status (`ok` or `erro`), whether the result was verified in the panel, and the error message when there is one. In the terminal, actions that ran but could not be confirmed in the panel show up as **NÃO CONFERIDO** (not verified).

- **Where it is**: `~/.local/share/aspa-mcp/auditoria.jsonl` (one JSON line per action, only you can read it; the file only grows, nothing is deleted).
- **View it in the terminal**:

  ```sh
  cd ~/dev/aspa-mcp
  npm run auditoria            # last 20 actions
  npm run auditoria -- 100     # last 100
  npm run auditoria -- 50 João # last 50 for the contact João
  ```

- **View it through Claude**: *"Show what was sent through Aspa today"* or *"Which actions failed this week?"*.
- **Configure it** (in `equipe.yaml` or `pessoal.yaml`):

  ```yaml
  auditoria:
    arquivo: ~/.local/share/aspa-mcp/auditoria.jsonl  # a different path, if you want
    incluir_texto: true   # false: keeps only the length of the text, not its content
  ```

> The log contains texts sent to customers (personal data, covered by LGPD, Brazil's data protection law). Treat it as confidential.

### Precautions

- Write actions affect **real customers**. Approve only what you have read.
- `~/.local/share/aspa-mcp/profile` holds an **active Aspa session**: treat it like a password.
- `~/.config/aspa-mcp/env` holds the Slack token: do not share it or commit it.
- `~/.config/aspa-mcp/equipe.yaml` and `conhecimento/` contain internal information: share them only through private channels.
- Downloaded attachments are stored in `~/.cache/aspa-mcp`: delete them when you are done (`rm -rf ~/.cache/aspa-mcp/attachments`).
- Conversations contain personal data (LGPD). Use them only for internal support.
- Never commit `.har` files, the profile, `env`, the team configuration, documents or attachments.
