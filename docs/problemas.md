# Problemas comuns e manutenção

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/troubleshooting.md)

| Sintoma | O que fazer |
| --- | --- |
| "aspa-mcp daemon is not running" | `systemctl --user restart aspa-mcp` |
| "Aspa session expired" ou aviso "Sessão expirada" | Peça "faz o login no Aspa" ou rode `npm run smoke -- --login` |
| `aspa` não aparece em `/mcp` | Refaça o [passo 4](instalacao.md#passo-4-conectar-ao-claude-code) e reinicie o Claude Code |
| "More than one conversation matches" | Use o nome completo ou o número da lista |
| "Send button not available" | A janela de 24h fechou: envie um template |
| "Conversation not found" | Peça para listar as conversas primeiro |
| Rascunho ignora o tom da equipe | Peça "mostra as diretrizes do Aspa" e confira `erros_de_configuracao` |
| Notificações não chegam | Confira `dias`, `horario` e `canais` no `pessoal.yaml`; rode `npm run test-notify` |
| Quero ver o que o serviço faz | `journalctl --user -u aspa-mcp -f` |
| macOS | Em vez do passo 2, deixe um terminal com `npm run daemon`. Outro Chrome: `export ASPA_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` |
| Sair da conta do Aspa | `systemctl --user stop aspa-mcp && rm -rf ~/.local/share/aspa-mcp/profile` |
| Desinstalar | `systemctl --user disable --now aspa-mcp && claude mcp remove aspa --scope user` |

```sh
systemctl --user status aspa-mcp         # está rodando?
systemctl --user restart aspa-mcp        # reiniciar
journalctl --user -u aspa-mcp -f         # acompanhar o log
systemctl --user disable --now aspa-mcp  # parar e desligar
```

---

### Atualizar o aspa-mcp

Quando houver versão nova, o checklist de configuração avisa ("Versão nova disponível"). Para atualizar, escolha um jeito:

- **Pedindo ao assistente** (Claude Code ou Codex): *"Atualiza o aspa."*
- **No terminal**: `cd ~/dev/aspa-mcp && npm run atualizar`

Os dois puxam a versão nova, instalam dependências se mudaram e reiniciam o serviço. Depois, **recarregue o MCP no cliente** para ver as ferramentas novas:

| Cliente | Como recarregar |
| --- | --- |
| Claude Code | `/mcp` → `aspa` → **Reconnect** |
| Codex | Feche e abra o Codex |
| Outros | Reinicie o cliente |

A configuração (`~/.config/aspa-mcp/`), a sessão do Aspa e o token do Slack não são afetados.
