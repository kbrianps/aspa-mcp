# Changelog

All notable changes to aspa-mcp. Versions follow [Semantic Versioning](https://semver.org/); `npm run atualizar` installs the latest tagged version.

## 0.6.0 - 2026-11-06

### Added
- `npm run doctor` checks that the Aspa panel still looks the way aspa-mcp expects.
- Startup summary of unread conversations, and watcher state saved across restarts so activity during downtime is not lost.
- Audit entries for settings, knowledge documents, Slack ID, login and updates; monthly audit files.
- Version mismatch between the MCP server and the background service shows up in the setup checklist.
- Attachments older than 7 days are deleted automatically; the hidden Chrome restarts when idle and above 1.2 GB.

### Changed
- Reading keeps unread conversations unread by default (`keepUnread: false` marks them as read).
- `aspa_reply_to_message` requires `quoted_text`, an excerpt of the quoted message.
- `aspa_login` returns as soon as the window opens.
- Transfers and renames are verified in the panel; the audit log keeps only an allowlist of result fields.
- Stricter configuration: booleans, unknown keys, empty filters and whole-word agent names.
- Updates install the latest tagged version, roll back if dependencies fail and do not restart during an Aspa window or action; the service finishes the current action before stopping.
- Single tool registry; the panel automation is split into `browser`, `panel`, `watcher`, `ui-map` and `aspa` modules.
- Chrome and the transcription process get a minimal environment without secrets; the systemd unit no longer loads the env file and has memory and stop limits (run `npm run install-service` again).
- Transcription runs one job at a time from a folder owned by the user.
- Navigation inside the panel replaces full page reloads, making statistics, search and mark unread much faster.

## 0.5.0 - 2026-11-06

### Added
- Write safety: contact name required, conversation header checked before the final click, optional `conversation_id`, duplicate send guard.
- Typed errors with stable codes, `npm run saude`, degraded and recovered alerts.
- Read-only mode enforced by the service with `ASPA_READ_ONLY=1` in the env file.
- MIT license, automated tests and CI.

### Changed
- Short customer messages such as "sim" and "ok" are no longer dropped.
- Knowledge and attachment paths are restricted; the knowledge folder and audit settings cannot be changed by the assistant.
- Node.js 22.12 or newer is required.
