# Notificações (Ubuntu e Slack)

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/notifications.md)

O serviço avisa quando chega mensagem nas **suas conversas** (ou nas abas configuradas) e quando a sessão do Aspa expira:

- no **Ubuntu** (balão no topo da tela): já vem ligado;
- no **Slack**, direto na sua conversa com o app (e no **celular** pelo app do Slack): precisa configurar;
- no **celular sem Slack** (app ntfy): opcional.

Os avisos mostram só o **nome do contato e o horário**, nunca o texto da mensagem. Quais canais, dias e horários: veja [Quando receber notificações](configuracao.md#quando-receber-notificações).

### Onde ficam os segredos

Tokens e links privados ficam no arquivo `~/.config/aspa-mcp/env` (criado no passo 2; só você consegue ler). Linhas começando com `#` estão desligadas.

```sh
nano ~/.config/aspa-mcp/env
```

No `nano`: **Ctrl+O**, **Enter** para salvar e **Ctrl+X** para sair. Depois de mudar este arquivo:

```sh
systemctl --user restart aspa-mcp
cd ~/dev/aspa-mcp && npm run test-notify
```

O `test-notify` manda um aviso de teste para os canais ligados e mostra quais são, por exemplo `channels: desktop, slack-dm`.

### Notificação no Ubuntu

1. **Instale o comando de notificação** (já vem na maioria dos Ubuntu):

   ```sh
   sudo apt install libnotify-bin
   ```

2. **Teste o Ubuntu sozinho**:

   ```sh
   notify-send "Aspa" "Teste do Ubuntu"
   ```

3. **Teste pelo aspa-mcp**:

   ```sh
   cd ~/dev/aspa-mcp && npm run test-notify
   ```

   Deve aparecer o balão **"Aspa: Teste"**.

4. **Se o balão não aparece**, desligue o **Não perturbe**: clique no **relógio** no topo da tela e desligue a chave, ou **Configurações** → **Notificações** → **Não perturbe**. Com ele ligado, os avisos ficam só na lista do relógio.
5. **Avisos com a tela bloqueada**: **Configurações** → **Notificações** → **Notificações na tela de bloqueio**.
6. **Se o passo 2 funciona e o 3 não**, o serviço não está vendo a sua sessão gráfica:

   ```sh
   systemctl --user import-environment DISPLAY DBUS_SESSION_BUS_ADDRESS
   systemctl --user restart aspa-mcp
   ```

7. **Para desligar** o aviso do Ubuntu, tire `desktop` de `notificacoes.canais` no `pessoal.yaml`.

### Notificação no Slack (direto para você)

O aviso chega numa conversa privada com o app **Aspa Chat** (no Slack, em **Apps** → **Aspa Chat**). Não precisa de canal.

#### Parte 1: criar o app (uma pessoa faz, uma vez para o time todo)

1. Abra https://api.slack.com/apps → **Create New App** → **Paste a manifest** → workspace da empresa.
2. Na aba **YAML**, apague tudo e cole:

   ```yaml
   display_information:
     name: Aspa Chat
     description: Avisos internos de novas mensagens no Aspa (aspa-mcp)
   features:
     app_home:
       home_tab_enabled: false
       messages_tab_enabled: true
       messages_tab_read_only_enabled: true
     bot_user:
       display_name: aspa-bot
       always_online: false
   oauth_config:
     scopes:
       bot:
         - chat:write
   settings:
     org_deploy_enabled: false
     socket_mode_enabled: false
     token_rotation_enabled: false
   ```

3. **Next** → **Create**.
4. (Opcional) **Basic Information** → **Display Information** → **Long description**:

   ```
   Aspa Chat é o app interno de avisos da equipe de suporte.

   Ele avisa você quando chega uma mensagem nova nas suas conversas do Aspa Chat (o WhatsApp de atendimento). O aviso chega direto aqui, na conversa privada com este app, e também no celular pelo app do Slack.

   O que aparece no aviso:
   • Nome do contato
   • Horário da mensagem
   • Link para abrir o painel do Aspa

   O que não aparece:
   • O conteúdo da conversa com o cliente

   Funciona junto com a ferramenta interna aspa-mcp, que roda no computador de cada atendente. Este app não é a integração oficial da Aspa.
   ```

5. **Install App** → **Install to Workspace** → **Permitir** (não pede canal).
6. **Deixe o bot com cara de produto** (opcional, recomendado):
   - **App Home** → **Your App's Presence in Slack** → **Edit**: em **Display Name (Bot Name)** coloque `Aspa Chat` e em **Default username** `aspachat`. Salve.
   - **Basic Information** → **Display Information**: em **App icon** envie o arquivo [`assets/slack-icon.png`](../assets/slack-icon.png) deste repositório e em **Background color** use `#6200E9`. Salve.
7. **OAuth & Permissions** → copie o **Bot User OAuth Token** (`xoxb-...`).
8. Guarde o token num gerenciador de senhas e passe só para quem vai usar. **Não cole em chat, issue ou commit.** Se vazar, use **OAuth & Permissions** → **Revoke All OAuth Tokens** e reinstale o app para gerar outro.

> Erro "requires bot_user": falta o bloco `bot_user` no manifest. Erro "cannot be converted to username": o `display_name` tem acento ou espaço; use algo como `aspa-bot`. A tela "MCP Servers" do Slack não é necessária.

#### Parte 2: cada pessoa configura no próprio computador

1. **Seu ID do Slack**: sua foto → **Perfil** → **⋮** → **Copiar ID do membro** (começa com `U`).
2. No terminal, rode o comando com o seu ID e cole o token quando pedir (a digitação fica oculta):

   ```sh
   cd ~/dev/aspa-mcp && npm run slack -- U0123456789
   ```

   Ele confere o token com o Slack, salva os dois no `~/.config/aspa-mcp/env` e manda a mensagem "✅ Notificações do aspa-mcp funcionando" em **Apps** → **Aspa Chat**. Não precisa reiniciar nada.
3. Confira que `slack` está em `notificacoes.canais` no `pessoal.yaml`.

   Prefere editar à mão? No `~/.config/aspa-mcp/env`, sem o `#`: `ASPA_SLACK_BOT_TOKEN=xoxb-...` e `ASPA_SLACK_USER_ID=U...`. Para testar depois: `npm run test-notify`.

   Como os avisos aparecem no Slack:

   | Tipo | Exemplo |
   | --- | --- |
   | Mensagem nova | 💬 **Nova mensagem no Aspa** · **João** · 14:23 · botão **Abrir no Aspa** |
   | Fora do horário | 🕘 **Mensagens recebidas fora do horário** · lista de contatos, enviada no início do expediente |
   | Sessão expirada | ⚠️ **Sessão do Aspa expirada** · peça ao assistente "faz o login no Aspa" |

#### Parte 3: receber no celular

1. Instale o app do **Slack** no celular, no mesmo workspace.
2. No Slack: **sua foto** → **Preferências** → **Notificações** → **Mensagens diretas, menções e palavras-chave** (as mensagens do app contam como diretas).
3. Em **Notificações para dispositivos móveis**, escolha receber **mesmo quando estiver ativo no computador**, se quiser os dois.
4. Permita notificações do Slack nas configurações do celular.

#### Erros comuns do Slack

| O terminal mostra | Causa | Solução |
| --- | --- | --- |
| `channels: desktop` (sem `slack-dm`) | Linhas do Slack com `#`, falta uma das duas ou `slack` fora de `canais` | Edite os arquivos e reinicie |
| `slack-dm: invalid_auth` | Token errado ou revogado | Copie de novo o `xoxb-` |
| `slack-dm: channel_not_found` | ID de membro errado | Copie de novo o ID (`U...`) |
| `slack-dm: not_allowed_token_type` | Outro tipo de token | Use o **Bot User OAuth Token** (`xoxb-`) |
| `slack-dm: missing_scope` | App sem `chat:write` | Confira o manifest e reinstale |

### Celular sem Slack (app ntfy, opcional)

1. Instale o app **ntfy** (Android ou iOS).
2. Gere um tópico **longo e aleatório** só seu, por exemplo com `echo aspa-$(openssl rand -hex 12)` (quem souber o nome lê os avisos; não copie exemplos).
3. No app, toque em **+** e assine esse tópico.
4. No `~/.config/aspa-mcp/env`: `ASPA_NTFY_URL=https://ntfy.sh/<tópico-longo-e-aleatório>`
5. Coloque `ntfy` em `notificacoes.canais`, reinicie e teste.

> O ntfy.sh é um servidor público de terceiros: por padrão o aviso **não** mostra o nome do contato. Para mostrar, adicione `ASPA_NTFY_SHOW_CONTACT=1` no `env`.
