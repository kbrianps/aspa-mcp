# Security policy

🇧🇷 Para relatar uma falha de segurança, **não abra uma issue pública**. Use o relato privado do GitHub (aba **Security** → **Report a vulnerability**). Nunca inclua tokens, sessões, conversas ou dados de clientes no relato.

## Reporting a vulnerability

Do **not** open a public issue. Use GitHub private vulnerability reporting (**Security** tab → **Report a vulnerability**) and describe:

- what an attacker could do and under which conditions;
- the affected version (`npm run saude` prints it) and component;
- steps to reproduce with fictitious data only.

Never include Slack tokens, the Chrome profile, the `env` file, audit logs, customer conversations, phone numbers or attachments. We aim to acknowledge reports within 5 business days.

## Scope

- The MCP server, the background service and their local files.
- Write safety (wrong recipient, duplicate sends, read-only bypass), path handling, secret exposure and prompt injection through customer content.

Out of scope: vulnerabilities in Aspa Chat itself (report them to Aspa), in Google Chrome, Node.js or the AI assistants.

## Supported versions

Only the latest tagged release receives fixes. Update with `npm run atualizar`.
