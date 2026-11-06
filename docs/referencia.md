# Referência técnica

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/reference.md)

### Componentes

| Arquivo | Papel |
| --- | --- |
| `index.mjs` | Servidor MCP (stdio) usado pelo assistente (Claude Code, Codex e outros); diretrizes e documentos são lidos aqui |
| `tools.mjs` | Registro único das ferramentas: nome, tipo (leitura, escrita, sessão, revisão), parâmetros e rótulo de auditoria |
| `daemon.mjs` | Serviço em segundo plano: Chrome, fila de ações, vigia e notificações; socket `$XDG_RUNTIME_DIR/aspa-mcp.sock` (600) |
| `aspa.mjs` | Ações no painel do Aspa (ler, enviar, transferir, adiar...) |
| `panel.mjs` | Leitura e cliques no painel: lista, conversa, menus, conferência do contato aberto |
| `browser.mjs` | Chrome invisível, fila de ações, saúde e limpeza de anexos |
| `watcher.mjs` | Vigia de mensagens novas |
| `ui-map.mjs` | Endereços e rótulos do painel do Aspa |
| `config.mjs` | Leitura e validação de `equipe.yaml` + `pessoal.yaml`, agenda e saudação |
| `knowledge.mjs` | Lista, busca e leitura dos documentos |
| `notify.mjs` | Canais de notificação (Ubuntu, Slack, ntfy) |
| `audit.mjs` | Registro de auditoria das ações de escrita |
| `transcribe.py` | Transcrição local com faster-whisper |

### Ferramentas do MCP

| Ferramenta | Tipo | O que faz |
| --- | --- | --- |
| `aspa_setup_check` | configuração | Checklist do que está pronto e do que falta, com o próximo passo |
| `aspa_update_settings` | configuração | Altera `empresa`, `rascunhos` e `notificacoes` em `equipe.yaml` ou `pessoal.yaml` (mantém comentários, guarda `.bak`, valida e desfaz se inválido). A pasta de conhecimento e a auditoria só mudam editando o arquivo à mão |
| `aspa_save_knowledge` | configuração | Cria ou atualiza um documento da pasta de conhecimento |
| `aspa_configure_slack` | configuração | Grava o seu ID de membro do Slack (o token você cola sozinho) |
| `aspa_test_notifications` | configuração | Manda um aviso de teste e mostra o que falhou |
| `aspa_update` | configuração | Atualiza o aspa-mcp para a versão mais nova e reinicia o serviço (fora do modo somente leitura; não reinicia com janela ou ação em andamento) |
| `aspa_audit_log` | leitura | Registro de auditoria das ações feitas no Aspa (filtros: contato, ação, data) |
| `aspa_get_guidelines` | leitura | Empresa, tom, assinatura, saudação do horário, regras, exemplos, notificações e lista de documentos |
| `aspa_search_knowledge` | leitura | Busca nos documentos (sem diferenciar acentos) |
| `aspa_read_knowledge` | leitura | Lê um documento |
| `aspa_login` | sessão | Abre a janela para você entrar no Aspa (até 5 min) e responde na hora; confira depois com `aspa_setup_check` |
| `aspa_list_conversations` | leitura | Lista conversas (`tab`; `filters`: sem_usuario, sem_resposta, em_automacao, com_contexto, sessao_ativa, sem_sessao_ativa; `order`: recentes, antigas) |
| `aspa_read_conversation` | leitura | Mensagens por `index` ou `contact`, com `conversation_id`; `loadMoreTimes` carrega histórico; conversa não lida continua não lida (`keepUnread: false` para marcar como lida) |
| `aspa_search_conversation` | leitura | Busca palavras dentro de uma conversa |
| `aspa_statistics` | leitura | Estatísticas do painel (hoje, ativos, sem resposta, adiados, por atendente) |
| `aspa_quick_replies` | leitura | Respostas Rápidas cadastradas |
| `aspa_list_concluded` | leitura | Concluídos, com busca por nome e paginação |
| `aspa_search_contact` | leitura | Busca contato por nome ou telefone |
| `aspa_download_attachments` | leitura | Salva anexos em `~/.cache/aspa-mcp/attachments/<contato>/` |
| `aspa_transcribe_audio` | leitura, opcional | Transcreve áudios localmente |
| `aspa_list_templates` | leitura | Templates aprovados do WhatsApp |
| `aspa_send_message` | escrita | Texto livre (janela de 24h) |
| `aspa_send_template` | escrita | Template com `variables` |
| `aspa_send_attachment` | escrita | Arquivo local (até 16 MB) com legenda; só da pasta pessoal (fora de pastas ocultas), de `/tmp` ou anexos baixados |
| `aspa_open_draft` | janela | Abre o Aspa com o rascunho na caixa para você revisar e enviar |
| `aspa_reply_to_message` | escrita | Responde citando uma mensagem (`messageIndex` mais `quoted_text`, um trecho dela, para não citar a mensagem errada) |
| `aspa_assume` | escrita | Assume uma conversa sem atendente ou de outro atendente |
| `aspa_transfer` | escrita | Transfere uma conversa **sua** para outro atendente ou time (o Aspa não deixa transferir conversa de outra pessoa: use assumir) |
| `aspa_mark_unread` | escrita | Marca como não lida |
| `aspa_snooze` | escrita | Adia `1h`, `1d` ou `1w` e confere |
| `aspa_snooze_until` | escrita | Adia até data e hora (`YYYY-MM-DD`, `HH:MM` de 15 em 15 min), com comentário |
| `aspa_create_contact` | escrita | Cria contato (nome e telefone); recusa telefone já cadastrado e confere depois |
| `aspa_block_promotions` | escrita | Liga ou desliga "Bloquear Promoções" |
| `aspa_conclude` | escrita | Conclui e confere |
| `aspa_reopen` | escrita | Reabre (concluídas na última semana) e confere |
| `aspa_rename_contact` | escrita | Renomeia e confere o nome salvo |

As ferramentas de escrita conferem o resultado no painel e devolvem erro em vez de dizer que deu certo quando não deu. Antes de agir, elas:

1. Exigem o nome do contato (`contact`); o `index` sozinho não basta e só serve para separar contatos com o mesmo nome.
2. Conferem se o cabeçalho da conversa aberta é o do contato pedido, logo depois de abrir e de novo antes do clique final.
3. Com o `conversation_id` devolvido por `aspa_read_conversation`, recusam a ação se a conversa aberta for outra.
4. Recusam a mesma mensagem para o mesmo contato em menos de 2 minutos, a não ser com `confirm_duplicate: true`.

Os erros vêm com um código estável no fim do texto, como `(código: WRONG_CONVERSATION)`: `SESSION_EXPIRED`, `BUSY`, `NOT_FOUND`, `AMBIGUOUS`, `WRONG_CONVERSATION`, `UI_CHANGED`, `TIMEOUT`, `CANCELLED`, `DUPLICATE`, `INVALID_INPUT`, `FORBIDDEN`, `NO_DISPLAY`, `NOT_VERIFIED`, `DAEMON_DOWN` ou `INTERNAL`. Com `NOT_VERIFIED`, a ação pode ter acontecido: confira no Aspa antes de repetir.

As ferramentas de configuração mexem só nos seus arquivos locais (nunca no Aspa) e, menos a `aspa_update`, ficam disponíveis também no modo somente leitura. O MCP também oferece o prompt `configurar` (no Claude Code: `/mcp__aspa__configurar`).

### Variáveis de ambiente

Ficam em `~/.config/aspa-mcp/env` (reinicie o serviço depois). As preferências de uso ficam nos arquivos YAML.

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `ASPA_SLACK_BOT_TOKEN` | (vazio) | Token do bot do app Aspa Chat (`xoxb-...`) |
| `ASPA_SLACK_USER_ID` | (vazio) | Seu ID de membro no Slack (`U...`) |
| `ASPA_SLACK_WEBHOOK_URL` | (vazio) | Alternativa: postar num canal via webhook |
| `ASPA_NTFY_URL` | (vazio) | Tópico do ntfy |
| `ASPA_NTFY_SHOW_CONTACT` | `0` | `1` mostra o contato no ntfy |
| `ASPA_CONFIG_DIR` | `~/.config/aspa-mcp` | Pasta dos arquivos de configuração |
| `ASPA_TEAM_CONFIG` / `ASPA_PERSONAL_CONFIG` | `equipe.yaml` / `pessoal.yaml` na pasta acima | Caminhos alternativos |
| `ASPA_CHROME_PATH` | `/usr/bin/google-chrome` | Chrome |
| `ASPA_PROFILE_DIR` | `~/.local/share/aspa-mcp/profile` | Perfil com a sessão do Aspa |
| `ASPA_CACHE_DIR` | `~/.cache/aspa-mcp` | Anexos baixados |
| `ASPA_ATTACHMENT_RETENTION_DAYS` | `7` | Apaga anexos baixados há mais dias que isso (`0` desliga) |
| `ASPA_CHROME_MEMORY_LIMIT_MB` | `1200` | Reinicia o Chrome invisível quando ocioso e acima desse uso de memória |
| `ASPA_SOCKET` | `$XDG_RUNTIME_DIR/aspa-mcp.sock` | Socket do serviço |
| `ASPA_READ_ONLY` | `0` | `1` expõe só as ferramentas de leitura, de configuração local, o login e a janela de revisão (use em outros clientes). No arquivo `env`, vale para o computador todo e o serviço recusa qualquer escrita |
| `ASPA_WATCH` | `1` | `0` desliga o vigia |
| `ASPA_WATCH_INTERVAL_MS` | `20000` | Intervalo do vigia |
| `ASPA_WHISPER_DIR` | `~/.local/share/aspa-mcp/whisper` (ou `/var/tmp/aspa-mcp/whisper`, se já instalada lá) | Instalação da transcrição |
| `ASPA_WHISPER_MODEL` | `small` | Modelo do Whisper |
| `ASPA_WHISPER_DEVICE` | `cpu` | `cpu` ou `cuda` |

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run install-service` | Instala e inicia o serviço |
| `npm run init-config` | Cria `equipe.yaml`, `pessoal.yaml` e `conhecimento/` |
| `npm run daemon` | Roda o serviço no terminal |
| `npm run smoke -- --login` | Janela de login |
| `npm run smoke -- "<contato>"` | Teste rápido de leitura |
| `npm run test-notify` | Aviso de teste nos canais configurados |
| `npm run auditoria -- [quantidade] [contato]` | Mostra o registro de auditoria |
| `npm run setup-transcribe` | Instala a transcrição local |
| `npm run atualizar` | Atualiza o aspa-mcp e reinicia o serviço |
| `npm run saude` | Mostra versão, Chrome, fila e se os avisos estão funcionando |
| `npm run doctor -- ["<contato>"]` | Confere se o painel do Aspa está como o aspa-mcp espera (lista, abas, menus e, com um contato, a conversa) |
| `npm test` | Roda os testes automáticos |
| `npm run slack -- [seu ID]` | Configura o aviso no Slack: pede o token com digitação oculta, valida, salva e testa |

### Limitações técnicas

- Depende da estrutura do painel do Aspa; se a Aspa mudar o layout, pode quebrar.
- Reabrir só encontra conversas concluídas na última semana.
- O nome do atendente de outras pessoas às vezes não é carregado pelo painel na sessão do serviço: a conversa aparece como atribuída (`assigned: true`) com `agent: null`. Nesses casos o filtro de notificação por nome de atendente não dispara; `sem_atendente` continua confiável.

### Editar os diagramas

As imagens em `assets/*.png` são geradas a partir de `assets/*.mmd` (Mermaid), com fundo claro para ficarem legíveis nos temas claro e escuro do GitHub:

```sh
npx -y @mermaid-js/mermaid-cli -i assets/arquitetura.mmd -o assets/arquitetura.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/atendimento.mmd -o assets/atendimento.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/architecture.en.mmd -o assets/architecture.en.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/flow.en.mmd -o assets/flow.en.png -b "#FBF8FF" -s 2
```

### Preciso do `/chrome` (Claude in Chrome)?

Não. O aspa-mcp tem o próprio Chrome invisível. O `/chrome` só serve para o Claude olhar o Aspa aberto no **seu** navegador.
