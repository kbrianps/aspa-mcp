# Audio transcription (optional)

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../transcricao.md)

Transcribes customer audio messages **on your computer** (the audio never leaves the machine). It takes up about 1 GB in `/var/tmp/aspa-mcp/whisper`.

```sh
cd ~/dev/aspa-mcp
npm run setup-transcribe
systemctl --user restart aspa-mcp
```

Then just ask: *"Transcribe the audio messages in João's conversation."*

More accuracy (slower):

```sh
ASPA_WHISPER_MODEL=medium npm run setup-transcribe
systemctl --user restart aspa-mcp
```

If it is not installed, Claude simply tells you that transcription is not enabled.
