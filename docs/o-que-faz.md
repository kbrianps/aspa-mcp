# O que faz e o que não faz

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/scope.md)

### Faz

- Lista conversas (Todos, Meus, Pendentes) com contato, atendente, horário e se está não lida.
- Lê o histórico completo, separando cliente e equipe, com horário, status de entrega, anexos e janela de 24h.
- Baixa imagens, PDFs e áudios; transcreve áudios localmente (opcional).
- Segue o tom, a assinatura, as regras e os exemplos da equipe, e consulta os documentos da empresa.
- Envia texto (na janela de 24h), templates (com variáveis) e arquivos.
- Assume, transfere, adia (1 hora, 1 dia, 1 semana ou até data e hora), conclui, reabre e marca como não lida.
- Responde citando uma mensagem e abre o rascunho no próprio Aspa para você revisar e enviar.
- Lista com filtros do painel (sem usuário, sem resposta, em automação, com contexto, sessão ativa/inativa) e ordenação.
- Busca dentro de uma conversa, nos concluídos (com paginação) e nos contatos; cria contatos.
- Mostra as estatísticas do painel e as Respostas Rápidas da equipe.
- Liga e desliga "Bloquear Promoções" do contato; renomeia contatos.
- Avisa no Ubuntu, Slack ou celular, com abas, atendentes, contatos, dias, horários e canais configuráveis.

### Não faz

- **Não envia nada sozinho**: toda ação pede aprovação no Claude Code.
- Não transcreve na nuvem; sem a instalação opcional, não transcreve.
- Não aplica jornadas, etiquetas nem assuntos do Aspa (a conta não tem nenhum configurado).
- Não edita e-mail ou empresa do contato (a conta não tem permissão no painel) e não apaga contatos (o painel não tem essa opção).
- Ações em massa: o painel só oferece transferir, adiar e concluir em lote; o assistente faz o mesmo conversa por conversa.
- Não muda o seu status de atendente nem grava áudio (para enviar áudio, use um arquivo com `aspa_send_attachment`).
- Não assiste vídeos: só baixa o arquivo.
- Não coloca o texto das mensagens nas notificações.
- Não lida com a sua senha.
- Não burla proteções do Aspa (App Check, reCAPTCHA) nem usa APIs privadas: opera o próprio site do Aspa, como você faria.
- Não funciona no claude.ai nem em outra máquina sem instalar.
