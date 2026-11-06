# Installation

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../instalacao.md)

## Before you start

| Item | How to check |
| --- | --- |
| Linux with systemd (Ubuntu recommended) | `systemctl --user status` works |
| Node.js 22.12 or newer | `node --version` |
| Google Chrome | `google-chrome --version` |
| Claude Code | `claude --version` |
| Aspa account with access to the support panel | you can sign in at https://app.aspa.chat |
| Access to this repository | ask an organization admin for the link |

> It works on macOS, but the service has to be started by hand (see [Troubleshooting](troubleshooting.md)).

---

## Step-by-step installation

You only do this once. It takes about 5 minutes.

### Step 1: download the project

```sh
git clone <repository-url> ~/dev/aspa-mcp
cd ~/dev/aspa-mcp
npm install
```

### Step 2: install the background service

```sh
npm run install-service
```

This creates the `aspa-mcp` service, which runs on its own and starts together with the computer. To check it:

```sh
systemctl --user status aspa-mcp
```

You should see `active (running)`.

### Step 3: create the configuration files

```sh
npm run init-config
```

This creates `~/.config/aspa-mcp/equipe.yaml`, `~/.config/aspa-mcp/pessoal.yaml` and the `~/.config/aspa-mcp/conhecimento/` folder from the blank templates. To fill them in, use the complete example in the `exemplos/` folder (see [Configuration](configuration.md)).

### Step 4: connect to Claude Code

```sh
claude mcp add --scope user aspa -- node "$HOME/dev/aspa-mcp/index.mjs"
```

### Step 5: sign in to Aspa

```sh
npm run smoke -- --login
```

1. A **Chrome window** opens on Aspa.
2. Sign in with **your own** Aspa email and password.
3. Once the panel loads, the window **closes by itself**.

> You type your password only in that window. It never goes through the assistant and is not saved in the project.

### Step 6: test

```sh
npm run smoke -- "Nome de um contato"
```

Replace it with the name of someone in the conversation list. The command shows how many conversations exist, the messages from that contact and the available templates.

### Step 7: restart Claude Code

Close and reopen Claude Code, type `/mcp` and check that `aspa` shows as **connected**.

### Step 8: let the assistant configure the rest

Open Claude Code (or another client, see [Other clients](other-clients.md)) and ask:

```text
Help me set up Aspa.
```

In Claude Code you can also use the built-in command `/mcp__aspa__configurar`.

The assistant runs a checklist (service, login, company, tone, signature, documents, Slack, notifications and transcription) and handles the pending items **one at a time**: it asks questions, shows what it is going to save and writes it to your configuration files after you confirm. It creates the company documents from what you tell it or paste in, without making anything up.

The Slack token is the only thing it does **not** save, so the secret never passes through the model. For that, run this in the terminal:

```sh
cd ~/dev/aspa-mcp && npm run slack
```

Paste the token when asked (your typing stays hidden). The command checks the token with Slack, saves it and sends you a test message.

✅ **Installation complete.** The manual steps in sections 5 and 6 still apply if you prefer to edit the files directly.
