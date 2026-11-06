# Instalação

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/installation.md)

## Antes de começar

| Item | Como conferir |
| --- | --- |
| Linux com systemd (Ubuntu recomendado) | `systemctl --user status` funciona |
| Node.js 20 ou mais novo | `node --version` |
| Google Chrome | `google-chrome --version` |
| Claude Code | `claude --version` |
| Conta no Aspa com acesso ao painel de atendimento | você consegue entrar em https://app.aspa.chat |
| Acesso a este repositório | peça o link a um admin da organização |

> No macOS funciona, mas o serviço precisa ser iniciado à mão (veja [Problemas comuns](problemas.md)).

---

## Instalação passo a passo

Faça uma vez só. Leva uns 5 minutos.

### Passo 1: baixar o projeto

```sh
git clone <link-do-repositório> ~/dev/aspa-mcp
cd ~/dev/aspa-mcp
npm install
```

### Passo 2: instalar o serviço em segundo plano

```sh
npm run install-service
```

Isso cria o serviço `aspa-mcp`, que fica rodando sozinho e liga junto com o computador. Para conferir:

```sh
systemctl --user status aspa-mcp
```

Deve aparecer `active (running)`.

### Passo 3: criar os arquivos de configuração

```sh
npm run init-config
```

Cria `~/.config/aspa-mcp/equipe.yaml`, `~/.config/aspa-mcp/pessoal.yaml` e a pasta `~/.config/aspa-mcp/conhecimento/`, a partir dos modelos em branco. Para preencher, use o exemplo completo da pasta `exemplos/` (veja a [Personalização](configuracao.md)).

### Passo 4: conectar ao Claude Code

```sh
claude mcp add --scope user aspa -- node "$HOME/dev/aspa-mcp/index.mjs"
```

### Passo 5: fazer login no Aspa

```sh
npm run smoke -- --login
```

1. Abre uma **janela do Chrome** no Aspa.
2. Entre com o **seu** e-mail e senha do Aspa.
3. Quando o painel carregar, a janela **fecha sozinha**.

> Sua senha é digitada só nessa janela. Ela não passa pelo Claude nem fica salva no projeto.

### Passo 6: testar

```sh
npm run smoke -- "Nome de um contato"
```

Troque pelo nome de alguém na lista de atendimentos. O comando mostra quantas conversas existem, as mensagens desse contato e os templates disponíveis.

### Passo 7: reiniciar o Claude Code

Feche e abra o Claude Code, digite `/mcp` e confira se `aspa` aparece como **connected**.

### Passo 8: deixar o assistente configurar o resto

Abra o Claude Code (ou outro cliente, veja [Outros clientes](outros-clientes.md)) e peça:

```text
Me ajuda a configurar o Aspa.
```

No Claude Code também dá para usar o comando pronto `/mcp__aspa__configurar`.

O assistente roda um checklist (serviço, login, empresa, tom, assinatura, documentos, Slack, notificações e transcrição) e resolve os itens pendentes **um de cada vez**: faz perguntas, mostra o que vai gravar e salva nos seus arquivos de configuração depois que você confirmar. Ele cria os documentos da empresa a partir do que você contar ou colar, sem inventar nada.

O token do Slack é a única coisa que ele **não** grava, para o segredo não passar pelo modelo. Para ele, rode no terminal:

```sh
cd ~/dev/aspa-mcp && npm run slack
```

Cole o token quando pedir (a digitação fica oculta). O comando confere o token com o Slack, salva e manda uma mensagem de teste para você.

✅ **Instalação concluída.** Os passos manuais das seções 5 e 6 continuam valendo para quem prefere editar os arquivos direto.
