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

- **Onde fica**: `~/.local/share/aspa-mcp/auditoria.jsonl` (uma linha JSON por ação, só você consegue ler; nada é apagado). A cada mês o arquivo anterior vira `auditoria-AAAA-MM.jsonl`, e a consulta lê todos. Mudanças de configuração, documentos, ID do Slack, login e atualização também entram no registro.
- **Ver no terminal**:

  ```sh
  cd ~/dev/aspa-mcp
  npm run auditoria            # últimas 20 ações
  npm run auditoria -- 100     # últimas 100
  npm run auditoria -- 50 João # últimas 50 do contato João
  ```

- **Ver pelo assistente**: *"Mostra o que foi enviado hoje pelo Aspa"* ou *"Quais ações deram erro esta semana?"*.
- **Configurar** (no `equipe.yaml` ou `pessoal.yaml`):

  ```yaml
  auditoria:
    arquivo: ~/.local/share/aspa-mcp/auditoria.jsonl  # outro caminho, se quiser
    incluir_texto: true   # false: guarda só o tamanho do texto, não o conteúdo
  ```

> O registro tem textos enviados a clientes (dados pessoais, LGPD). Trate como confidencial.

### Proteções embutidas

- **Destinatário certo:** toda escrita exige o nome do contato e confere o cabeçalho da conversa aberta antes do clique final. Com o `conversation_id` da leitura, recusa se a conversa for outra.
- **Sem envio em dobro:** a mesma mensagem para o mesmo contato em menos de 2 minutos é recusada.
- **Pedido cancelado não roda:** se o assistente desistir de uma chamada que ainda estava na fila, ela não é executada no Aspa.
- **Modo somente leitura de verdade:** com `ASPA_READ_ONLY=1` no arquivo `env`, o próprio serviço recusa qualquer escrita, qualquer que seja o cliente.
- **Arquivos locais:** anexos só saem da pasta pessoal (fora de pastas ocultas como `~/.config` e `~/.ssh`), de `/tmp` ou dos anexos baixados. Documentos de conhecimento só são lidos e gravados dentro da pasta de conhecimento, sem links simbólicos nem arquivos ocultos. A pasta de conhecimento e a auditoria não podem ser mudadas pelo assistente.
- **Conteúdo de cliente é dado, não ordem:** o MCP avisa o modelo para ignorar pedidos escritos dentro de mensagens, nomes de contato e documentos.
- **Avisos que param, avisam:** se o painel não puder ser lido por mais de 5 minutos, chega um aviso, e outro quando voltar. `npm run saude` mostra o estado.

### Cuidados

- As ações de escrita afetam **clientes reais**. Aprove só o que você leu.
- `~/.local/share/aspa-mcp/profile` guarda uma **sessão ativa do Aspa**: trate como senha.
- `~/.config/aspa-mcp/env` guarda o token do Slack: não compartilhe nem faça commit.
- `~/.config/aspa-mcp/equipe.yaml` e `conhecimento/` têm informações internas: compartilhe só por canais privados.
- Anexos baixados ficam em `~/.cache/aspa-mcp` e são apagados sozinhos depois de 7 dias (`ASPA_ATTACHMENT_RETENTION_DAYS`). Para apagar na hora: `rm -rf ~/.cache/aspa-mcp/attachments`.
- O token do Slack não é repassado ao Chrome nem à transcrição; o serviço lê o arquivo `env` só na hora de avisar.
- As conversas têm dados pessoais (LGPD). Use só para o suporte interno.
- Nunca faça commit de `.har`, perfil, `env`, configuração da equipe, documentos ou anexos.
