# Using other MCP clients

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../outros-clientes.md)

aspa-mcp is a standard MCP server (stdio): it works in any client that supports MCP, not only in Claude Code. The background service is the same for all of them.

> **Recommended: read-only mode** (`ASPA_READ_ONLY=1`) in clients other than Claude Code. In this mode the MCP offers the 14 read tools (list, read, search, statistics, guidelines, attachments, transcription, audit) plus login and the review window (`aspa_open_draft`), where you are the one who clicks send in Aspa: no AI agent can send, transfer, snooze or close anything on its own.
>
> **LGPD (Brazil's data protection law):** when you read conversations through another client, the customers' content goes to that model's provider (OpenAI, Google, xAI, DeepSeek, Moonshot, Zhipu...). Check whether this is allowed before using it with real conversations.

| Client | How to add it (read-only) |
| --- | --- |
| **Codex** | `codex mcp add aspa --env ASPA_READ_ONLY=1 -- node "$HOME/dev/aspa-mcp/index.mjs"` |
| **Antigravity (agy)** | `agy mcp add -e ASPA_READ_ONLY=1 aspa node "$HOME/dev/aspa-mcp/index.mjs"` |
| **opencode** (includes DeepSeek, GLM, Kimi and other providers) | `opencode mcp add --global --env ASPA_READ_ONLY=1 aspa -- node "$HOME/dev/aspa-mcp/index.mjs"` |
| **Grok Bot** | In the app: MCP settings → add a local (stdio) server with the command `node`, the argument `$HOME/dev/aspa-mcp/index.mjs` (full path) and the variable `ASPA_READ_ONLY=1` |
| **Z Code** | In the app: settings → MCP → add a local server with the same command, argument and variable |
| **Claude Code** (full, with write access) | `claude mcp add --scope user aspa -- node "$HOME/dev/aspa-mcp/index.mjs"` |

To allow write actions in a client, register it again without `ASPA_READ_ONLY=1`. Use clients in **interactive mode**, approving each action; do not run AI agents in automatic mode with aspa-mcp.

Suggested test request (it does not read conversations):

```text
Use only the aspa MCP tools aspa_statistics and aspa_get_guidelines. Answer: how many conversations today, how many active and with no reply, and what the team's reply tone is.
```

| Client | Status in testing (November 2026) |
| --- | --- |
| Claude Code 2.1 + Claude Opus 5.5 | Tested end to end |
| Antigravity (agy) 1.5.2 | Found and read the tools; in non-interactive mode it stops before calling them (needs approval). Test in interactive mode |
| Codex (a second support agent, Ubuntu, read-only mode) | Tested: installation, update, guided setup (checklist and adjustments), statistics, guidelines, listing, conversations with no reply, reading without marking as read, summary and draft in the team's tone. Codex did not try to take over or reply to another support agent's conversation. Still to test: Slack notification, security review of the tools and the review window on a conversation of their own |
| opencode 2.2.5 (DeepSeek, GLM, Kimi via Morph) | Registered; test in interactive mode |
| Grok Bot 0.78, Z Code 3.16 | Configure in the app and test |
