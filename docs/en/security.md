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

- **Where it is**: `~/.local/share/aspa-mcp/auditoria.jsonl` (one JSON line per action, only you can read it; nothing is deleted). Each month the previous file becomes `auditoria-YYYY-MM.jsonl`, and queries read all of them. Configuration, document, Slack ID, login and update changes are logged too.
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

### Built-in protections

- **Right recipient:** every write requires the contact name and checks the header of the open conversation before the final click. With the `conversation_id` from the read, it refuses if the conversation is a different one.
- **No double sends:** the same message to the same contact within 2 minutes is refused.
- **Cancelled requests do not run:** if the assistant gives up on a call that was still queued, it is not executed in Aspa.
- **Real read-only mode:** with `ASPA_READ_ONLY=1` in the `env` file, the service itself refuses every write, whatever the client.
- **Local files:** attachments can only come from your home folder (outside hidden folders such as `~/.config` and `~/.ssh`), `/tmp` or downloaded attachments. Knowledge documents are only read and written inside the knowledge folder, without symbolic links or hidden files. The assistant cannot change the knowledge folder or the audit settings.
- **Customer content is data, not orders:** the MCP tells the model to ignore requests written inside messages, contact names and documents.
- **Alerts that stop, tell you:** if the panel cannot be read for more than 5 minutes, you get an alert, and another one when it recovers. `npm run saude` shows the status.

### Precautions

- Write actions affect **real customers**. Approve only what you have read.
- `~/.local/share/aspa-mcp/profile` holds an **active Aspa session**: treat it like a password.
- `~/.config/aspa-mcp/env` holds the Slack token: do not share it or commit it.
- `~/.config/aspa-mcp/equipe.yaml` and `conhecimento/` contain internal information: share them only through private channels.
- Downloaded attachments are stored in `~/.cache/aspa-mcp` and deleted automatically after 7 days (`ASPA_ATTACHMENT_RETENTION_DAYS`). To delete them now: `rm -rf ~/.cache/aspa-mcp/attachments`.
- The Slack token is not passed to Chrome or to transcription; the service reads the `env` file only when sending an alert.
- Conversations contain personal data (LGPD). Use them only for internal support.
- Never commit `.har` files, the profile, `env`, the team configuration, documents or attachments.
