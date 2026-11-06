# Segurança e privacidade

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/security.md)

### Registro de auditoria

Toda ação que muda algo no Aspa feita pelo aspa-mcp fica registrada, **inclusive tentativas que falharam**:

| Ação registrada | O que fica no registro |
| --- | --- |
| Enviar mensagem | texto enviado |
| Enviar template | nome do template e variáveis |
| Enviar anexo | nome, tamanho e SHA-256 do arquivo, legenda |
| Transferir / assumir | destino e comentário |
| Adiar / adiar até | duração ou data e hora, comentário |
| Concluir / reabrir / marcar como não lida | contato |
| Responder citando | mensagem citada e texto |
| Abrir rascunho no Aspa / rascunho fechado | texto, e se você enviou pela janela |
| Criar contato | nome e telefone |
| Bloquear promoções | ligado ou desligado |
| Renomear contato | novo nome |

Cada registro tem também: data e hora, duração, usuário e computador, contato, status (`ok` ou `erro`), se o resultado foi conferido no painel e a mensagem de erro, quando houver. No terminal, ações que rodaram mas não se confirmaram no painel aparecem como **NÃO CONFERIDO**.

- **Onde fica**: `~/.local/share/aspa-mcp/auditoria.jsonl` (uma linha JSON por ação, só você consegue ler; o arquivo só cresce, nada é apagado).
- **Ver no terminal**:

  ```sh
  cd ~/dev/aspa-mcp
  npm run auditoria            # últimas 20 ações
  npm run auditoria -- 100     # últimas 100
  npm run auditoria -- 50 João # últimas 50 do contato João
  ```

- **Ver pelo Claude**: *"Mostra o que foi enviado hoje pelo Aspa"* ou *"Quais ações deram erro esta semana?"*.
- **Configurar** (no `equipe.yaml` ou `pessoal.yaml`):

  ```yaml
  auditoria:
    arquivo: ~/.local/share/aspa-mcp/auditoria.jsonl  # outro caminho, se quiser
    incluir_texto: true   # false: guarda só o tamanho do texto, não o conteúdo
  ```

> O registro tem textos enviados a clientes (dados pessoais, LGPD). Trate como confidencial.

### Cuidados

- As ações de escrita afetam **clientes reais**. Aprove só o que você leu.
- `~/.local/share/aspa-mcp/profile` guarda uma **sessão ativa do Aspa**: trate como senha.
- `~/.config/aspa-mcp/env` guarda o token do Slack: não compartilhe nem faça commit.
- `~/.config/aspa-mcp/equipe.yaml` e `conhecimento/` têm informações internas: compartilhe só por canais privados.
- Anexos baixados ficam em `~/.cache/aspa-mcp`: apague quando terminar (`rm -rf ~/.cache/aspa-mcp/attachments`).
- As conversas têm dados pessoais (LGPD). Use só para o suporte interno.
- Nunca faça commit de `.har`, perfil, `env`, configuração da equipe, documentos ou anexos.
