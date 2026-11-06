# What it does and what it does not do

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../o-que-faz.md)

### What it does

- Lists conversations (**Todos** (All), **Meus** (Mine), **Pendentes** (Pending)) with contact, agent, time and whether each one is unread.
- Reads the full history, separating customer and team messages, with time, delivery status, attachments and the 24-hour window.
- Downloads images, PDFs and audio files; transcribes audio locally (optional).
- Follows the team's tone, signature, rules and examples, and checks the company documents.
- Sends text (within the 24-hour window), templates (with variables) and files.
- Takes over, transfers, snoozes (1 hour, 1 day, 1 week or until a date and time), closes, reopens and marks as unread.
- Replies quoting a message, and opens the draft in Aspa itself so you can review and send it.
- Lists with the panel's filters (no user, no reply, in automation, with context, active/inactive session) and sorting.
- Searches inside a conversation, in closed conversations (with pagination) and in contacts; creates contacts.
- Shows the panel statistics and the team's **Respostas Rápidas** (Quick Replies).
- Turns the contact's **Bloquear Promoções** (Block Promotions) setting on and off; renames contacts.
- Notifies you on Ubuntu, Slack or your phone, with configurable tabs, agents, contacts, days, hours and channels.

### What it does not do

- **It does not send anything on its own**: every action asks for approval in Claude Code.
- It does not transcribe in the cloud; without the optional install, it does not transcribe at all.
- It does not apply Aspa journeys, tags or subjects (the account has none configured).
- It does not edit a contact's email or company (the account has no permission for that in the panel) and does not delete contacts (the panel has no such option).
- Bulk actions: the panel only offers bulk transfer, snooze and close; Claude does the same one conversation at a time.
- It does not change your agent status or record audio (to send audio, use a file with `aspa_send_attachment`).
- It does not watch videos: it only downloads the file.
- It does not put message text in notifications.
- It does not handle your password.
- It does not bypass Aspa's protections (App Check, reCAPTCHA) or use private APIs: it operates Aspa's own website, just as you would.
- It does not work on claude.ai or on another machine without installing it there.
