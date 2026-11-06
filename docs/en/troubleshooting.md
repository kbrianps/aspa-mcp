# Common problems and maintenance

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../problemas.md)

| Symptom | What to do |
| --- | --- |
| `DAEMON_DOWN`: "O serviço do aspa-mcp não está rodando" (service not running) | `systemctl --user restart aspa-mcp` |
| `SESSION_EXPIRED` or the "Sessão expirada" (Session expired) notification | Ask the assistant to "sign in to Aspa" or run `npm run smoke -- --login` |
| `aspa` does not show up in `/mcp` | Redo [step 4](installation.md#step-4-connect-to-claude-code) and restart Claude Code |
| `AMBIGUOUS`: more than one conversation matches | Use the full name; if two contacts share the name, also pass the number from the list |
| `WRONG_CONVERSATION` | The open conversation was not the requested one and nothing was done. Read the conversation again and retry |
| `DUPLICATE` | The same message was sent less than 2 minutes ago. Check Aspa before repeating |
| `NOT_VERIFIED` | The action may have happened, but the panel did not confirm it. Check Aspa before repeating |
| `FORBIDDEN` mentioning the 24-hour window | The 24-hour window has closed: send a template |
| `UI_CHANGED` | The Aspa panel changed. Run `npm run doctor -- "<your contact>"` and see what failed |
| `NOT_FOUND`: conversation not found | Ask the assistant to list the conversations first |
| Alerts stopped, or the "Avisos do Aspa parados" alert | `npm run saude` and `npm run doctor`; then `systemctl --user restart aspa-mcp` |
| Reading is slow | The first action after a restart waits for the panel to load (up to about 1 minute). After that it is fast |
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

Both install the latest published version (versions are tagged `v0.6.0`, `v0.7.0`...), install dependencies if they changed (and go back to the previous version if that fails) and restart the service, unless an Aspa window or action is in progress. What changed in each version is in the [CHANGELOG](../../CHANGELOG.md). If the new version changed the systemd service, also run `npm run install-service`. Then **reload the MCP in your client** to see the new tools:

| Client | How to reload |
| --- | --- |
| Claude Code | `/mcp` → `aspa` → **Reconnect** |
| Codex | Close and reopen Codex |
| Others | Restart the client |

Your configuration (`~/.config/aspa-mcp/`), the Aspa session and the Slack token are not affected.
