# Problemas comuns e manutenção

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/troubleshooting.md)

| Sintoma | O que fazer |
| --- | --- |
| `DAEMON_DOWN`: "O serviço do aspa-mcp não está rodando" | `systemctl --user restart aspa-mcp` |
| `SESSION_EXPIRED` ou aviso "Sessão expirada" | Peça "faz o login no Aspa" ou rode `npm run smoke -- --login` |
| `aspa` não aparece em `/mcp` | Refaça o [passo 4](instalacao.md#passo-4-conectar-ao-claude-code) e reinicie o Claude Code |
| `AMBIGUOUS`: "Mais de uma conversa corresponde" | Use o nome completo; se houver dois contatos com o mesmo nome, passe também o número da lista |
| `WRONG_CONVERSATION` | A conversa aberta não era a pedida, e nada foi feito. Leia a conversa de novo e repita |
| `DUPLICATE` | A mesma mensagem já foi enviada há menos de 2 minutos. Confira no Aspa antes de repetir |
| `NOT_VERIFIED` | A ação pode ter acontecido, mas o painel não confirmou. Confira no Aspa antes de repetir |
| `FORBIDDEN` com "janela de 24 h" | A janela de 24h fechou: envie um template |
| `UI_CHANGED` | O painel do Aspa mudou. Rode `npm run doctor -- "<seu contato>"` e veja o que falhou |
| `NOT_FOUND`: "Conversa não encontrada" | Peça para listar as conversas primeiro |
| Avisos pararam ou aviso "Avisos do Aspa parados" | `npm run saude` e `npm run doctor`; depois `systemctl --user restart aspa-mcp` |
| Ler está lento | A primeira ação depois de reiniciar espera o painel carregar (até cerca de 1 minuto). Depois disso, fica rápido |
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

Os dois instalam a última versão publicada (as versões são marcadas como `v0.6.0`, `v0.7.0`...), instalam dependências se mudaram (e voltam para a versão anterior se a instalação falhar) e reiniciam o serviço, a não ser que haja uma janela ou ação do Aspa em andamento. O que mudou em cada versão fica no [CHANGELOG](../CHANGELOG.md). Se a versão nova mudou o serviço do systemd, rode também `npm run install-service`. Depois, **recarregue o MCP no cliente** para ver as ferramentas novas:

| Cliente | Como recarregar |
| --- | --- |
| Claude Code | `/mcp` → `aspa` → **Reconnect** |
| Codex | Feche e abra o Codex |
| Outros | Reinicie o cliente |

A configuração (`~/.config/aspa-mcp/`), a sessão do Aspa e o token do Slack não são afetados.
