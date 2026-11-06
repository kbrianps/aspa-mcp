# Changelog

All notable changes to aspa-mcp. Versions follow [Semantic Versioning](https://semver.org/); `npm run atualizar` installs the latest tagged version.

## 0.8.0 - 2026-11-06

### Added
- Automatic draft when the customer replies (`rascunho_automatico`): Claude Code runs in the background with only the Aspa read tools, reads the conversation, transcribes audio and sends a summary and a draft reply to Slack and Ubuntu. Nothing is sent to the customer.
- `aspa_auto_drafts` tool to review the prepared drafts before sending.

### Fixed
- Alerts say "atendente não identificado" instead of "sem atendente" when the agent line has not loaded yet.

## 0.7.0 - 2026-11-06

### Added
- pt-BR titles and accurate hints (read-only, destructive, idempotent, open world) on every tool.
- Pagination for the conversation list (`limit`, `cursor`, `next_cursor`) and `has_more` for concluded conversations.
- Recovery from crashed browser tabs; reads are retried once when the browser tab is lost.
- Automatic detection of Google Chrome or Chromium; clear error when systemd is missing.
- Headless DOM tests with an anonymized panel fixture.
- `SECURITY.md`, `CONTRIBUTING.md`, issue and pull request templates.

### Changed
- Compact JSON output without duplicated captions, attachment triggers or URLs; shorter guidelines.
- Stricter schemas for snooze date and time and for contact phone numbers.
- PDF knowledge documents are cached until they change.
- Instructions show the real install folder instead of a fixed path; paths with spaces or accents work.
- The fictional example company is now an internet provider, and docs and templates speak of "the assistant" instead of a specific one.
- Inherited section numbers removed from the docs.

### Fixed
- Freshly reopened conversations with only events can be opened.
- Templates can be sent when the 24-hour window is closed and the panel shows "Envie uma mensagem modelo" with the "Escolher" button.
- Right after a restart, actions wait for the full conversation list instead of reporting the conversation as not found.
- The MCP server finds the background service even when the client passes a minimal environment without `XDG_RUNTIME_DIR`.
- The hidden Chrome is recycled above 2.5 GB instead of 1.2 GB, which restarted it too often.

## 0.6.0 - 2026-11-06

### Added
- `npm run doctor` checks that the Aspa panel still looks the way aspa-mcp expects.
- Startup summary of unread conversations, and watcher state saved across restarts so activity during downtime is not lost.
- Audit entries for settings, knowledge documents, Slack ID, login and updates; monthly audit files.
- Version mismatch between the MCP server and the background service shows up in the setup checklist.
- Attachments older than 7 days are deleted automatically; the hidden Chrome restarts when idle and above a memory limit.

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
