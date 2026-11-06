# Common problems and maintenance

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../problemas.md)

| Symptom | What to do |
| --- | --- |
| "aspa-mcp daemon is not running" | `systemctl --user restart aspa-mcp` |
| "Aspa session expired" or the "Sessão expirada" (Session expired) notification | Ask Claude to "sign in to Aspa" or run `npm run smoke -- --login` |
| `aspa` does not show up in `/mcp` | Redo [step 4](installation.md#step-4-connect-to-claude-code) and restart Claude Code |
| "More than one conversation matches" | Use the full name or the number in the list |
| "Send button not available" | The 24-hour window has closed: send a template |
| "Conversation not found" | Ask Claude to list the conversations first |
| Drafts ignore the team's tone | Ask Claude to "show the Aspa guidelines" and check `erros_de_configuracao` |
| Notifications do not arrive | Check `dias`, `horario` and `canais` in `pessoal.yaml`; run `npm run test-notify` |
| I want to see what the service is doing | `journalctl --user -u aspa-mcp -f` |
| macOS | Instead of step 2, keep a terminal open running `npm run daemon`. For a different Chrome location: `export ASPA_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` |
| Sign out of the Aspa account | `systemctl --user stop aspa-mcp && rm -rf ~/.local/share/aspa-mcp/profile` |
| Uninstall | `systemctl --user disable --now aspa-mcp && claude mcp remove aspa --scope user` |

```sh
systemctl --user status aspa-mcp         # is it running?
systemctl --user restart aspa-mcp        # restart
journalctl --user -u aspa-mcp -f         # follow the log
systemctl --user disable --now aspa-mcp  # stop and disable
```

---

### Updating aspa-mcp

When a new version is available, the setup checklist tells you ("Versão nova disponível", new version available). To update, pick one way:

- **Ask the assistant** (Claude Code or Codex): *"Update aspa."*
- **In the terminal**: `cd ~/dev/aspa-mcp && npm run atualizar`

Both pull the new version, install dependencies if they changed and restart the service. Then **reload the MCP in your client** to see the new tools:

| Client | How to reload |
| --- | --- |
| Claude Code | `/mcp` → `aspa` → **Reconnect** |
| Codex | Close and reopen Codex |
| Others | Restart the client |

Your configuration (`~/.config/aspa-mcp/`), the Aspa session and the Slack token are not affected.
