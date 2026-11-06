# Como usar

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/usage.md)

## Como usar no dia a dia

Abra o Claude Code em qualquer pasta e **peça em português**, como pediria a um colega.

### Fluxo recomendado

1. **Ver o que chegou**
   > Lista as conversas do Aspa e me diz quais estão não lidas.
2. **Entender o problema**
   > Lê a conversa do João e resume em 3 linhas. Se tiver áudio, transcreve. Se tiver imagem, me diz o que aparece.
3. **Pedir um rascunho**
   > Prepara um rascunho de resposta. Não envie ainda.

   O Claude consulta automaticamente o tom, as regras e os documentos da equipe.
4. **Revisar**: peça ajustes se quiser ("mais curto", "explica melhor o passo 2").
5. **Enviar** (escolha um jeito)
   - Pelo Claude:
     > Pode enviar.

     O Claude Code mostra uma **caixa de permissão** com o texto exato. Confira e aprove.
   - Pelo próprio Aspa, revisando na tela:
     > Abre no Aspa com esse rascunho para eu revisar.

     Abre uma **janela do Aspa** já na conversa, com o texto na caixa. Você edita e clica em enviar no painel. Enquanto a janela estiver aberta, os avisos e as outras ações ficam pausados; feche a janela quando terminar. O registro de auditoria anota se você enviou.
6. **Organizar**
   > Conclui a conversa do João.

### Regras importantes

- **Nada é enviado sem a sua aprovação.** Enviar, transferir, adiar, concluir, reabrir e renomear sempre abrem uma caixa de permissão.
- **Nunca marque "sempre permitir"** para essas ferramentas. Aprove uma por uma.
- **Janela de 24h do WhatsApp**: depois de 24h sem mensagem do cliente, só dá para enviar **templates**. O Claude avisa e sugere um.
- **Abrir uma conversa pode marcá-la como lida** no painel do Aspa. Para evitar, peça "lê sem marcar como lida" (`keepUnread`).
- **Conversa sem atendente** mostra "Assumir" no lugar da caixa de texto: peça "assume a conversa" antes de responder ou transferir.

---

## Exemplos de pedidos

### Ler e entender

```text
Lista as conversas abertas do Aspa e me diz quais estão como não lidas.
```

```text
Lê a conversa do João no Aspa e resume o problema em 3 linhas.
```

```text
Lê a conversa da Maria (carregue mais 2 vezes o histórico), baixa os anexos e me diz o que aparece nas imagens e no PDF.
```

```text
Transcreve os áudios da conversa do João e me diz o que ele pediu.
```

```text
Passa por todas as conversas em que a última mensagem é do cliente e, para cada uma, me dá: contato, resumo de 1 linha e rascunho de resposta. Não envie nada.
```

```text
Lê a conversa do cliente ACME e verifica no código do nosso sistema se o comportamento que ele relata é esperado. Depois prepara um rascunho explicando ao cliente.
```

### Responder

```text
Prepara um rascunho de resposta para o João. Só envie depois que eu aprovar.
```

```text
Pode enviar o rascunho que aprovei para o João.
```

```text
A janela de 24h da conversa da Maria fechou. Lista os templates e envia o "Iniciar-conversa-manhã".
```

```text
Envia para o João o PDF /home/eu/Downloads/manual.pdf com a legenda "Segue o manual".
```

### Mais recursos do painel

```text
Lista só as conversas sem resposta, das mais antigas para as mais novas.
```

```text
Procura na conversa da Maria onde ela falou de "boleto".
```

```text
Responde citando a última mensagem do João: "Recebido, já estou verificando."
```

```text
Mostra as estatísticas do Aspa de hoje.
```

```text
Busca o contato com telefone 41 99999-9999.
```

```text
Procura nos concluídos a conversa da ACME da semana passada.
```

### Organizar

```text
Assume a conversa do João.
```

```text
Marca a conversa do João como não lida.
```

```text
Adia a conversa da Maria até segunda às 9h, com o comentário "aguardando boleto".
```

```text
Transfere a conversa da Maria para o time Comercial com o comentário "cliente quer upgrade".
```

```text
Adia a conversa do João por 1 dia.
```

```text
Conclui a conversa do João.
```

```text
Reabre a conversa do João que foi concluída ontem.
```

### Configuração e sessão

```text
Quais são as diretrizes de resposta da equipe e quais documentos você tem sobre a empresa?
```

```text
O que os nossos documentos dizem sobre prazo de cancelamento?
```

```text
Mostra tudo o que foi enviado hoje pelo Aspa e se alguma ação deu erro.
```

```text
Minha sessão do Aspa expirou, faz o login de novo.
```
