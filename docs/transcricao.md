# Transcrição de áudio (opcional)

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/transcription.md)

Transcreve os áudios dos clientes **no seu computador** (o áudio não sai da máquina). Ocupa cerca de 1 GB em `/var/tmp/aspa-mcp/whisper`.

```sh
cd ~/dev/aspa-mcp
npm run setup-transcribe
systemctl --user restart aspa-mcp
```

Depois é só pedir: *"Transcreve os áudios da conversa do João."*

Mais precisão (mais lento):

```sh
ASPA_WHISPER_MODEL=medium npm run setup-transcribe
systemctl --user restart aspa-mcp
```

Sem instalar, o Claude apenas avisa que a transcrição não está ativada.
