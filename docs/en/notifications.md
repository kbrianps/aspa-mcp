# Notifications (Ubuntu and Slack)

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../notificacoes.md)

The service notifies you when a message arrives in **your conversations** (or in the configured tabs) and when the Aspa session expires:

- on **Ubuntu** (a pop-up at the top of the screen): on by default;
- on **Slack**, directly in your conversation with the app (and on your **phone** through the Slack app): needs setup;
- on a **phone without Slack** (ntfy app): optional.

Notifications show only the **contact name and the time**, never the message text. For channels, days and hours, see [When to receive notifications](configuration.md#53-when-to-receive-notifications).

### 6.1 Where the secrets live

Tokens and private links are kept in the `~/.config/aspa-mcp/env` file (created in step 2; only you can read it). Lines starting with `#` are disabled.

```sh
nano ~/.config/aspa-mcp/env
```

In `nano`: **Ctrl+O**, **Enter** to save and **Ctrl+X** to exit. After changing this file:

```sh
systemctl --user restart aspa-mcp
cd ~/dev/aspa-mcp && npm run test-notify
```

`test-notify` sends a test notification to the enabled channels and shows which ones they are, for example `channels: desktop, slack-dm`.

### 6.2 Ubuntu notifications

1. **Install the notification command** (it already comes with most Ubuntu installs):

   ```sh
   sudo apt install libnotify-bin
   ```

2. **Test Ubuntu on its own**:

   ```sh
   notify-send "Aspa" "Teste do Ubuntu"
   ```

3. **Test through aspa-mcp**:

   ```sh
   cd ~/dev/aspa-mcp && npm run test-notify
   ```

   The **"Aspa: Teste"** (Aspa: Test) pop-up should appear.

4. **If the pop-up does not appear**, turn off **Não perturbe** (Do Not Disturb): click the **clock** at the top of the screen and turn off the switch, or go to **Configurações** (Settings) → **Notificações** (Notifications) → **Não perturbe**. While it is on, notifications only show up in the clock's list.
5. **Notifications while the screen is locked**: **Configurações** → **Notificações** → **Notificações na tela de bloqueio** (Lock screen notifications).
6. **If step 2 works but step 3 does not**, the service cannot see your graphical session:

   ```sh
   systemctl --user import-environment DISPLAY DBUS_SESSION_BUS_ADDRESS
   systemctl --user restart aspa-mcp
   ```

7. **To turn off** Ubuntu notifications, remove `desktop` from `notificacoes.canais` in `pessoal.yaml`.

### 6.3 Slack notifications (sent directly to you)

The notification arrives in a private conversation with the **Aspa Chat** app (in Slack, under **Apps** → **Aspa Chat**). No channel is needed.

#### Part 1: create the app (one person does this, once for the whole team)

1. Open https://api.slack.com/apps → **Create New App** → **Paste a manifest** → the company workspace.
2. In the **YAML** tab, delete everything and paste:

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
4. (Optional) **Basic Information** → **Display Information** → **Long description**:

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

5. **Install App** → **Install to Workspace** → **Permitir** (Allow) (it does not ask for a channel).
6. **Give the bot a product look** (optional, recommended):
   - **App Home** → **Your App's Presence in Slack** → **Edit**: set **Display Name (Bot Name)** to `Aspa Chat` and **Default username** to `aspachat`. Save.
   - **Basic Information** → **Display Information**: under **App icon** upload the file [`assets/slack-icon.png`](../../assets/slack-icon.png) from this repository, and under **Background color** use `#6200E9`. Save.
7. **OAuth & Permissions** → copy the **Bot User OAuth Token** (`xoxb-...`).
8. Keep the token in a password manager and share it only with the people who will use it. **Do not paste it in a chat, issue or commit.** If it leaks, use **OAuth & Permissions** → **Revoke All OAuth Tokens** and reinstall the app to generate a new one.

> Error "requires bot_user": the `bot_user` block is missing from the manifest. Error "cannot be converted to username": the `display_name` has an accent or a space; use something like `aspa-bot`. Slack's "MCP Servers" screen is not needed.

#### Part 2: each person sets it up on their own computer

1. **Your Slack ID**: your photo → **Perfil** (Profile) → **⋮** → **Copiar ID do membro** (Copy member ID) (it starts with `U`).
2. In the terminal, run the command with your ID and paste the token when asked (your typing stays hidden):

   ```sh
   cd ~/dev/aspa-mcp && npm run slack -- U0123456789
   ```

   It checks the token with Slack, saves both values in `~/.config/aspa-mcp/env` and sends the message "✅ Notificações do aspa-mcp funcionando" (aspa-mcp notifications working) in **Apps** → **Aspa Chat**. No restart is needed.
3. Check that `slack` is in `notificacoes.canais` in `pessoal.yaml`.

   Prefer to edit by hand? In `~/.config/aspa-mcp/env`, without the `#`: `ASPA_SLACK_BOT_TOKEN=xoxb-...` and `ASPA_SLACK_USER_ID=U...`. To test afterwards: `npm run test-notify`.

   How notifications look in Slack:

   | Type | Example |
   | --- | --- |
   | New message | 💬 **Nova mensagem no Aspa** (New message in Aspa) · **João** · 14:23 · **Abrir no Aspa** (Open in Aspa) button |
   | Outside working hours | 🕘 **Mensagens recebidas fora do horário** (Messages received outside working hours) · list of contacts, sent when the workday starts |
   | Session expired | ⚠️ **Sessão do Aspa expirada** (Aspa session expired) · ask Claude to "sign in to Aspa" |

#### Part 3: get them on your phone

1. Install the **Slack** app on your phone, in the same workspace.
2. In Slack: **your photo** → **Preferências** (Preferences) → **Notificações** (Notifications) → **Mensagens diretas, menções e palavras-chave** (Direct messages, mentions and keywords). Messages from the app count as direct messages.
3. Under **Notificações para dispositivos móveis** (Mobile notifications), choose to receive them **even when you are active on your computer**, if you want both.
4. Allow Slack notifications in your phone settings.

#### Common Slack errors

| The terminal shows | Cause | Fix |
| --- | --- | --- |
| `channels: desktop` (no `slack-dm`) | Slack lines start with `#`, one of the two is missing, or `slack` is not in `canais` | Edit the files and restart |
| `slack-dm: invalid_auth` | Wrong or revoked token | Copy the `xoxb-` token again |
| `slack-dm: channel_not_found` | Wrong member ID | Copy the ID (`U...`) again |
| `slack-dm: not_allowed_token_type` | Different token type | Use the **Bot User OAuth Token** (`xoxb-`) |
| `slack-dm: missing_scope` | App without `chat:write` | Check the manifest and reinstall |

### 6.4 Phone without Slack (ntfy app, optional)

1. Install the **ntfy** app (Android or iOS).
2. Make up a **long, random** topic, for example `aspa-k3j9x2mq8v7tpl4wz` (anyone who knows the name can read the notifications).
3. In the app, tap **+** and subscribe to that topic.
4. In `~/.config/aspa-mcp/env`: `ASPA_NTFY_URL=https://ntfy.sh/aspa-k3j9x2mq8v7tpl4wz`
5. Add `ntfy` to `notificacoes.canais`, restart and test.

> ntfy.sh is a public third-party server: by default the notification does **not** show the contact name. To show it, add `ASPA_NTFY_SHOW_CONTACT=1` to `env`.
