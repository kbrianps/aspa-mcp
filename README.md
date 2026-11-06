<p align="center">
  <img src="assets/banner.svg" alt="aspa-mcp: Claude Code + Aspa Chat para equipes de suporte" width="100%">
</p>

<p align="center">
  <img alt="Ubuntu 26.04 LTS" src="https://img.shields.io/badge/Ubuntu-26.04_LTS-6200E9?logo=ubuntu&logoColor=white">
  <img alt="Claude Code 2.1" src="https://img.shields.io/badge/Claude_Code-2.1-6200E9?logo=anthropic&logoColor=white">
  <img alt="Model Context Protocol" src="https://img.shields.io/badge/MCP-stdio-6200E9">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-6200E9?logo=nodedotjs&logoColor=white">
  <img alt="Transcrição local" src="https://img.shields.io/badge/Whisper-local-6200E9">
</p>

<p align="center">
  <b>Atenda pelo Aspa Chat conversando com o Claude.</b><br>
  Ele lê as conversas, entende áudios e anexos, escreve no tom da sua equipe<br>
  e só envia, transfere ou conclui depois da sua aprovação.
</p>

---

## Destaques

| Recurso | O que faz |
| --- | --- |
| 💬 **Lê tudo** | Conversas, histórico, imagens, PDFs e áudios (com transcrição local opcional). |
| ✍️ **Escreve no seu tom** | Tom, assinatura, regras e exemplos da equipe, mais documentos da empresa como fonte. |
| ✅ **Você aprova** | Nada é enviado, transferido ou concluído sem a sua confirmação no Claude Code. |
| 🔔 **Avisa na hora certa** | Ubuntu, Slack e celular, só das suas conversas e só no seu horário. |
| 🔒 **Fica no seu computador** | Sessão, anexos, documentos e áudios não saem da sua máquina. |

## Sumário

1. [Como funciona](#como-funciona)
2. [Testado com](#testado-com)
3. [Antes de começar](#1-antes-de-começar)
4. [Instalação passo a passo](#2-instalação-passo-a-passo)
5. [Como usar no dia a dia](#3-como-usar-no-dia-a-dia)
6. [Exemplos de pedidos](#4-exemplos-de-pedidos)
7. [Personalização: tom, regras e documentos](#5-personalização-tom-regras-e-documentos)
8. [Notificações (Ubuntu e Slack)](#6-notificações-ubuntu-e-slack)
9. [Transcrição de áudio (opcional)](#7-transcrição-de-áudio-opcional)
10. [Problemas comuns](#8-problemas-comuns)
11. [O que faz e o que não faz](#9-o-que-faz-e-o-que-não-faz)
12. [Segurança e privacidade](#10-segurança-e-privacidade)
13. [Usar com outros clientes de MCP](#11-usar-com-outros-clientes-de-mcp)
14. [Referência técnica](#12-referência-técnica)
15. [Roadmap](#13-roadmap)

---

## Como funciona

<p align="center">
  <img src="assets/arquitetura.png" alt="Arquitetura do aspa-mcp: Claude Code, servidor MCP, serviço em segundo plano, Chrome invisível, Aspa Chat, clientes e notificações" width="100%">
</p>

<sub>Fonte editável do diagrama: <a href="assets/arquitetura.mmd"><code>assets/arquitetura.mmd</code></a></sub>

O **serviço em segundo plano** mantém um Chrome invisível logado no Aspa, executa uma ação por vez no painel e vigia mensagens novas. O **servidor MCP** é a ponte com o Claude Code e também entrega as diretrizes e os documentos da equipe.

### Um atendimento do começo ao fim

<p align="center">
  <img src="assets/atendimento.png" alt="Sequência de um atendimento: mensagem do cliente, aviso, leitura, rascunho, aprovação e envio" width="100%">
</p>

<sub>Fonte editável do diagrama: <a href="assets/atendimento.mmd"><code>assets/atendimento.mmd</code></a></sub>

---

## Testado com

| Componente | Versão |
| --- | --- |
| Sistema | Ubuntu 26.04.1 LTS (GNOME Shell 50.1, X11, kernel 7.0) |
| Claude Code | 2.1.318 |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |
| Node.js | 22.23.2 |
| Google Chrome | 157.0.8103.38 |
| Python (transcrição) | 3.14.4 com faster-whisper 1.2.1, modelo `small`, CPU |
| Data dos testes | novembro de 2026 |

Testado de ponta a ponta: login, leitura, anexos (imagem, PDF, áudio), transcrição, envio de texto, anexo e template, concluir, reabrir, adiar, renomear contato e notificações no Ubuntu. Também testados: assumir, transferir, criar contato, janela de revisão, filtros, busca, estatísticas, responder citando e adiar até data. Anexos de vídeo: só download.

---

## 1. Antes de começar

| Item | Como conferir |
| --- | --- |
| Linux com systemd (Ubuntu recomendado) | `systemctl --user status` funciona |
| Node.js 20 ou mais novo | `node --version` |
| Google Chrome | `google-chrome --version` |
| Claude Code | `claude --version` |
| Conta no Aspa com acesso ao painel de atendimento | você consegue entrar em https://app.aspa.chat |
| Acesso a este repositório | peça o link a um admin da organização |

> No macOS funciona, mas o serviço precisa ser iniciado à mão (veja [Problemas comuns](#8-problemas-comuns)).

---

## 2. Instalação passo a passo

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

Cria `~/.config/aspa-mcp/equipe.yaml`, `~/.config/aspa-mcp/pessoal.yaml` e a pasta `~/.config/aspa-mcp/conhecimento/`, a partir dos modelos em branco. Para preencher, use o exemplo completo da pasta `exemplos/` (veja a [seção 5](#5-personalização-tom-regras-e-documentos)).

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

Abra o Claude Code (ou outro cliente, veja a seção 11) e peça:

```text
Me ajuda a configurar o Aspa.
```

No Claude Code também dá para usar o comando pronto `/mcp__aspa__configurar`.

O assistente roda um checklist (serviço, login, empresa, tom, assinatura, documentos, Slack, notificações e transcrição) e resolve os itens pendentes **um de cada vez**: faz perguntas, mostra o que vai gravar e salva nos seus arquivos de configuração depois que você confirmar. Ele cria os documentos da empresa a partir do que você contar ou colar, sem inventar nada.

O token do Slack é a única coisa que ele **não** grava: você mesmo cola no arquivo `~/.config/aspa-mcp/env`, para o segredo não passar pelo modelo.

✅ **Instalação concluída.** Os passos manuais das seções 5 e 6 continuam valendo para quem prefere editar os arquivos direto.

---

## 3. Como usar no dia a dia

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

## 4. Exemplos de pedidos

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

---

## 5. Personalização: tom, regras e documentos

Tudo é configurável em arquivos simples, em `~/.config/aspa-mcp/`:

| Arquivo | Quem edita | Para quê |
| --- | --- | --- |
| `equipe.yaml` | a equipe (igual para todos) | Sobre a empresa, tom, assinatura padrão, regras, exemplos, documentos, notificações padrão |
| `pessoal.yaml` | cada atendente | Sua assinatura, seus horários e canais de aviso. **Tem prioridade** sobre o da equipe |
| `conhecimento/` | a equipe | Documentos que ensinam o Claude sobre a empresa |

**As mudanças valem na hora**, sem reiniciar nada.

### Modelos e exemplo pronto

O repositório traz duas pastas para você não começar do zero:

| Pasta | O que é | Como usar |
| --- | --- | --- |
| [`modelos/`](modelos/) | Arquivos **em branco**, comentados | O `npm run init-config` copia para `~/.config/aspa-mcp/`. É só preencher |
| [`exemplos/`](exemplos/) | Uma configuração **completa e preenchida** de uma empresa fictícia (Acme Monitoramento) | Abra para ver como fica um `equipe.yaml`, um `pessoal.yaml` e a pasta de conhecimento de verdade. Copie o **formato**, não o conteúdo |

```
exemplos/
├── equipe.yaml                      empresa, tom, regras, 4 respostas modelo, notificações
├── pessoal.yaml                     assinatura e combinações de notificação comentadas
└── conhecimento/
    ├── empresa.md                   quem somos, canais, horários, SLA, times internos
    ├── faq.md                       perguntas frequentes com respostas aprovadas
    ├── politicas.md                 cancelamento, reembolso, visita técnica, LGPD
    ├── respostas-modelo.md          frases aprovadas para abrir, pedir dados, encaminhar e encerrar
    ├── produtos/
    │   ├── plano-essencial.md       preço, limites, o que inclui e o que não inclui
    │   └── plano-profissional.md
    └── procedimentos/
        ├── camera-offline.md        perguntas, passos, quando escalar, o que não fazer
        └── acesso-ao-app.md
```

Passo a passo sugerido:

1. Rode `npm run init-config` (cria os arquivos em branco).
2. Abra `exemplos/equipe.yaml` ao lado do seu `~/.config/aspa-mcp/equipe.yaml` e preencha o seu seguindo o formato.
3. Para cada documento de `exemplos/conhecimento/` que fizer sentido, crie o equivalente real em `~/.config/aspa-mcp/conhecimento/`.
4. Peça ao Claude: *"Mostra as diretrizes do Aspa"*. Se aparecer algum **aviso**, ainda há valor de modelo ou exemplo para trocar.

> **Não copie os documentos de exemplo sem editar.** Eles têm preços, prazos e políticas inventados, marcados com "EXEMPLO FICTÍCIO". Se ficarem na sua pasta de conhecimento, as diretrizes avisam o Claude para não usar esses dados com clientes.

```sh
nano ~/.config/aspa-mcp/equipe.yaml
nano ~/.config/aspa-mcp/pessoal.yaml
```

> Como o repositório é público, **não** coloque estes arquivos nele. Compartilhe o `equipe.yaml` e os documentos com o time por um canal privado.

### 5.1 Sobre a empresa e tom dos rascunhos

```yaml
empresa:
  nome: "Nome da empresa"
  descricao: >
    O que a empresa faz, para quem e qual é o principal produto.

rascunhos:
  idioma: pt-BR
  tom: "Cordial, objetivo e sem jargão técnico. Trate o cliente por você."
  assinatura: "Equipe de Suporte"
  saudacao_por_horario: true        # Bom dia / Boa tarde / Boa noite
  tamanho_maximo: "até 6 linhas"
  sempre:
    - "Confirme o entendimento do problema antes de propor a solução."
  nunca:
    - "Prometer prazos ou preços que não estejam nos documentos."
    - "Pedir senha ou código de verificação ao cliente."
  quando_usar_template: "Quando a janela de 24h do WhatsApp estiver fechada."
  exemplos:
    - situacao: "Cliente diz que não consegue acessar o sistema"
      resposta: |
        Boa tarde, Maria! Sinto muito pelo transtorno.
        Você consegue me dizer se aparece alguma mensagem de erro na tela?
        Equipe de Suporte
```

| Campo | O que faz |
| --- | --- |
| `empresa.nome`, `empresa.descricao` | Contexto sobre a empresa para todo rascunho |
| `rascunhos.tom` | Como escrever (formal, informal, "você" ou "senhor") |
| `rascunhos.assinatura` | Assinatura no fim da mensagem (no `pessoal.yaml` cada um põe a sua) |
| `rascunhos.saudacao_por_horario` | Começa com Bom dia, Boa tarde ou Boa noite conforme a hora |
| `rascunhos.tamanho_maximo` | Limite de tamanho |
| `rascunhos.sempre` / `rascunhos.nunca` | Regras que o Claude segue em todo rascunho |
| `rascunhos.quando_usar_template` | Quando preferir um template do WhatsApp |
| `rascunhos.exemplos` | Respostas modelo para situações comuns (o Claude imita o estilo) |

### 5.2 Documentos da empresa

Coloque arquivos em `~/.config/aspa-mcp/conhecimento/` (subpastas valem). Formatos: `.md`, `.txt`, `.pdf`, `.csv`, `.json`, `.yaml`.

```
conhecimento/
├── empresa.md          quem somos, horário de atendimento
├── faq.md              perguntas frequentes e respostas aprovadas
├── politicas.md        trocas, cancelamento, prazos, SLA, LGPD
├── produtos/
│   ├── plano-basico.md
│   └── plano-avancado.md
└── procedimentos/
    └── sem-acesso.md
```

Antes de afirmar qualquer fato num rascunho, o Claude busca nessa pasta. Se não encontrar, ele pergunta em vez de inventar. Para mudar a pasta: `conhecimento.pasta` no YAML.

### 5.3 Quando receber notificações

```yaml
notificacoes:
  abas: [meus]                         # meus, pendentes, todos
  apenas_mensagens_de_cliente: true    # só quando chega mensagem do cliente
  canais: [desktop, slack]             # desktop, slack, ntfy
  dias: [seg, ter, qua, qui, sex]      # dom, seg, ter, qua, qui, sex, sab
  horario:
    inicio: "09:00"
    fim: "18:00"                       # passa da meia-noite? use inicio "22:00" e fim "06:00"
  fuso: America/Sao_Paulo
  fora_do_horario: acumular            # acumular: resumo quando o expediente começa; ignorar: descarta
  intervalo_minimo_minutos: 5          # no máximo 1 aviso a cada 5 min por contato
  sessao_expirada: true                # avisa quando precisa logar de novo
  atendentes: []                       # vazio = qualquer atendente; ou nomes; "sem_atendente"
  contatos_incluir: []                 # se preenchido, só avisa destes contatos
  contatos_ignorar: []                 # nunca avisa destes contatos
  nova_conversa: true                  # avisa quando surge uma conversa nova na lista
  mostrar_atendente: true              # mostra o atendente no aviso
```

| Campo | Opções | Padrão |
| --- | --- | --- |
| `abas` | `meus`, `pendentes`, `todos` | `[meus]` |
| `apenas_mensagens_de_cliente` | `true` / `false` (avisar também respostas de colegas e da automação) | `true` |
| `canais` | `desktop`, `slack`, `ntfy` | todos os configurados |
| `dias` | `dom` a `sab` | todos |
| `horario.inicio` / `horario.fim` | `HH:MM` | o dia todo |
| `fuso` | fuso IANA | `America/Sao_Paulo` |
| `fora_do_horario` | `acumular`, `ignorar` | `acumular` |
| `intervalo_minimo_minutos` | número | `0` |
| `sessao_expirada` | `true` / `false` | `true` |
| `atendentes` | nomes (parte do nome vale), `sem_atendente` | qualquer |
| `contatos_incluir` | partes de nomes de contatos | todos |
| `contatos_ignorar` | partes de nomes de contatos | nenhum |
| `nova_conversa` | `true` / `false` | `true` |
| `mostrar_atendente` | `true` / `false` | `true` |

Exemplos prontos (cole no `pessoal.yaml`):

| Quero ser avisado de... | Configuração |
| --- | --- |
| Toda mensagem nova, de qualquer atendente | `abas: [todos]` |
| Só as minhas conversas | `abas: [meus]` |
| As minhas e as que ninguém pegou | `abas: [todos]` e `atendentes: [Seu Nome, sem_atendente]` |
| Só as do Lucas | `abas: [todos]` e `atendentes: [Lucas]` |
| Tudo, menos um contato de testes | `contatos_ignorar: [Teste]` |
| Só de um cliente importante | `abas: [todos]` e `contatos_incluir: [ACME]` |

### 5.4 Conferir a configuração

Peça ao Claude:

```text
Mostra as diretrizes do Aspa e me diz se tem algum erro na configuração.
```

Ou veja o log do serviço, que avisa valores inválidos (e usa o padrão no lugar):

```sh
journalctl --user -u aspa-mcp -n 20
```

---

## 6. Notificações (Ubuntu e Slack)

O serviço avisa quando chega mensagem nas **suas conversas** (ou nas abas configuradas) e quando a sessão do Aspa expira:

- no **Ubuntu** (balão no topo da tela): já vem ligado;
- no **Slack**, direto na sua conversa com o app (e no **celular** pelo app do Slack): precisa configurar;
- no **celular sem Slack** (app ntfy): opcional.

Os avisos mostram só o **nome do contato e o horário**, nunca o texto da mensagem. Quais canais, dias e horários: veja a [seção 5.3](#53-quando-receber-notificações).

### 6.1 Onde ficam os segredos

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

### 6.2 Notificação no Ubuntu

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

### 6.3 Notificação no Slack (direto para você)

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
   - **Basic Information** → **Display Information**: em **App icon** envie o arquivo [`assets/slack-icon.png`](assets/slack-icon.png) deste repositório e em **Background color** use `#6200E9`. Salve.
7. **OAuth & Permissions** → copie o **Bot User OAuth Token** (`xoxb-...`).
8. Guarde o token num gerenciador de senhas e passe só para quem vai usar. **Não cole em chat, issue ou commit.** Se vazar, use **OAuth & Permissions** → **Revoke All OAuth Tokens** e reinstale o app para gerar outro.

> Erro "requires bot_user": falta o bloco `bot_user` no manifest. Erro "cannot be converted to username": o `display_name` tem acento ou espaço; use algo como `aspa-bot`. A tela "MCP Servers" do Slack não é necessária.

#### Parte 2: cada pessoa configura no próprio computador

1. **Seu ID do Slack**: sua foto → **Perfil** → **⋮** → **Copiar ID do membro** (começa com `U`).
2. No `~/.config/aspa-mcp/env`, sem o `#`:

   ```
   ASPA_SLACK_BOT_TOKEN=xoxb-...
   ASPA_SLACK_USER_ID=U0123456789
   ```

3. Confira que `slack` está em `notificacoes.canais` no `pessoal.yaml`.
4. Reinicie e teste:

   ```sh
   systemctl --user restart aspa-mcp
   cd ~/dev/aspa-mcp && npm run test-notify
   ```

   Esperado: `channels: desktop, slack-dm` e `sent to all channels`, e a mensagem "✅ Notificações do aspa-mcp funcionando" em **Apps** → **Aspa Chat**.

   Como os avisos aparecem no Slack:

   | Tipo | Exemplo |
   | --- | --- |
   | Mensagem nova | 💬 **Nova mensagem no Aspa** · **João** · 14:23 · botão **Abrir no Aspa** |
   | Fora do horário | 🕘 **Mensagens recebidas fora do horário** · lista de contatos, enviada no início do expediente |
   | Sessão expirada | ⚠️ **Sessão do Aspa expirada** · peça ao Claude "faz o login no Aspa" |

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

### 6.4 Celular sem Slack (app ntfy, opcional)

1. Instale o app **ntfy** (Android ou iOS).
2. Invente um tópico **longo e aleatório**, por exemplo `aspa-k3j9x2mq8v7tpl4wz` (quem souber o nome lê os avisos).
3. No app, toque em **+** e assine esse tópico.
4. No `~/.config/aspa-mcp/env`: `ASPA_NTFY_URL=https://ntfy.sh/aspa-k3j9x2mq8v7tpl4wz`
5. Coloque `ntfy` em `notificacoes.canais`, reinicie e teste.

> O ntfy.sh é um servidor público de terceiros: por padrão o aviso **não** mostra o nome do contato. Para mostrar, adicione `ASPA_NTFY_SHOW_CONTACT=1` no `env`.

---

## 7. Transcrição de áudio (opcional)

Transcreve os áudios dos clientes **no seu computador** (o áudio não sai da máquina). Ocupa cerca de 1 GB em `/var/tmp/aspa-mcp/whisper`.

```sh
cd ~/dev/aspa-mcp
npm run setup-transcribe
systemctl --user restart aspa-mcp
```

Depois é só pedir: *"Transcreve os áudios da conversa do João."*

Mais precisão (mais lento):

```sh
ASPA_WHISPER_MODEL=medium npm run setup-transcribe
systemctl --user restart aspa-mcp
```

Sem instalar, o Claude apenas avisa que a transcrição não está ativada.

---

## 8. Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| "aspa-mcp daemon is not running" | `systemctl --user restart aspa-mcp` |
| "Aspa session expired" ou aviso "Sessão expirada" | Peça "faz o login no Aspa" ou rode `npm run smoke -- --login` |
| `aspa` não aparece em `/mcp` | Refaça o [passo 4](#passo-4-conectar-ao-claude-code) e reinicie o Claude Code |
| "More than one conversation matches" | Use o nome completo ou o número da lista |
| "Send button not available" | A janela de 24h fechou: envie um template |
| "Conversation not found" | Peça para listar as conversas primeiro |
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

## 9. O que faz e o que não faz

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
- Ações em massa: o painel só oferece transferir, adiar e concluir em lote; o Claude faz o mesmo conversa por conversa.
- Não muda o seu status de atendente nem grava áudio (para enviar áudio, use um arquivo com `aspa_send_attachment`).
- Não assiste vídeos: só baixa o arquivo.
- Não coloca o texto das mensagens nas notificações.
- Não lida com a sua senha.
- Não burla proteções do Aspa (App Check, reCAPTCHA) nem usa APIs privadas: opera o próprio site do Aspa, como você faria.
- Não funciona no claude.ai nem em outra máquina sem instalar.

---

## 10. Segurança e privacidade

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

---

## 11. Usar com outros clientes de MCP

O aspa-mcp é um servidor MCP padrão (stdio): funciona em qualquer cliente que aceite MCP, não só no Claude Code. O serviço em segundo plano é o mesmo para todos.

> **Recomendado: modo somente leitura** (`ASPA_READ_ONLY=1`) em clientes que não sejam o Claude Code. Nesse modo o MCP oferece as 14 ferramentas de leitura (listar, ler, buscar, estatísticas, diretrizes, anexos, transcrição, auditoria) mais o login e a janela de revisão (`aspa_open_draft`), em que é você quem clica em enviar no Aspa: nenhum agente consegue enviar, transferir, adiar ou concluir nada sozinho.
>
> **LGPD:** ao ler conversas por outro cliente, o conteúdo dos clientes vai para o provedor daquele modelo (OpenAI, Google, xAI, DeepSeek, Moonshot, Zhipu...). Confira se isso é permitido antes de usar com conversas reais.

| Cliente | Como adicionar (somente leitura) |
| --- | --- |
| **Codex** | `codex mcp add aspa --env ASPA_READ_ONLY=1 -- node "$HOME/dev/aspa-mcp/index.mjs"` |
| **Antigravity (agy)** | `agy mcp add -e ASPA_READ_ONLY=1 aspa node "$HOME/dev/aspa-mcp/index.mjs"` |
| **opencode** (inclui DeepSeek, GLM, Kimi e outros provedores) | `opencode mcp add --global --env ASPA_READ_ONLY=1 aspa -- node "$HOME/dev/aspa-mcp/index.mjs"` |
| **Grok Bot** | No app: configurações de MCP → adicionar servidor local (stdio) com comando `node`, argumento `$HOME/dev/aspa-mcp/index.mjs` (caminho completo) e variável `ASPA_READ_ONLY=1` |
| **Z Code** | No app: configurações → MCP → adicionar servidor local com o mesmo comando, argumento e variável |
| **Claude Code** (completo, com escrita) | `claude mcp add --scope user aspa -- node "$HOME/dev/aspa-mcp/index.mjs"` |

Para liberar a escrita num cliente, registre de novo sem `ASPA_READ_ONLY=1`. Use clientes em **modo interativo**, aprovando cada ação; não rode agentes em modo automático com o aspa-mcp.

Pedido de teste sugerido (não lê conversas):

```text
Use somente as ferramentas do MCP aspa aspa_statistics e aspa_get_guidelines. Responda: quantos atendimentos hoje, ativos e sem resposta, e qual o tom de resposta da equipe.
```

| Cliente | Situação nos testes (novembro de 2026) |
| --- | --- |
| Claude Code 2.1 + Claude Opus 5.5 | Testado de ponta a ponta |
| Antigravity (agy) 1.5.2 | Encontrou e leu as ferramentas; no modo não interativo para antes de chamar (precisa de aprovação). Testar no modo interativo |
| Codex 0.162 | Registrado; o teste não rodou porque os modelos configurados não estão liberados para a conta ChatGPT |
| opencode 2.2.5 (DeepSeek, GLM, Kimi via Morph) | Registrado; testar no modo interativo |
| Grok Bot 0.78, Z Code 3.16 | Configurar pelo app e testar |

---

## 12. Referência técnica

### Componentes

| Arquivo | Papel |
| --- | --- |
| `index.mjs` | Servidor MCP (stdio) usado pelo Claude Code; diretrizes e documentos são lidos aqui |
| `daemon.mjs` | Serviço em segundo plano: Chrome, fila de ações, vigia e notificações; socket `$XDG_RUNTIME_DIR/aspa-mcp.sock` (600) |
| `aspa.mjs` | Automação do painel do Aspa |
| `config.mjs` | Leitura e validação de `equipe.yaml` + `pessoal.yaml`, agenda e saudação |
| `knowledge.mjs` | Lista, busca e leitura dos documentos |
| `notify.mjs` | Canais de notificação (Ubuntu, Slack, ntfy) |
| `audit.mjs` | Registro de auditoria das ações de escrita |
| `transcribe.py` | Transcrição local com faster-whisper |

### Ferramentas do MCP

| Ferramenta | Tipo | O que faz |
| --- | --- | --- |
| `aspa_setup_check` | configuração | Checklist do que está pronto e do que falta, com o próximo passo |
| `aspa_update_settings` | configuração | Altera `equipe.yaml` ou `pessoal.yaml` (mantém comentários, guarda `.bak`, valida e desfaz se inválido) |
| `aspa_save_knowledge` | configuração | Cria ou atualiza um documento da pasta de conhecimento |
| `aspa_configure_slack` | configuração | Grava o seu ID de membro do Slack (o token você cola sozinho) |
| `aspa_test_notifications` | configuração | Manda um aviso de teste e mostra o que falhou |
| `aspa_audit_log` | leitura | Registro de auditoria das ações feitas no Aspa (filtros: contato, ação, data) |
| `aspa_get_guidelines` | leitura | Empresa, tom, assinatura, saudação do horário, regras, exemplos, notificações e lista de documentos |
| `aspa_search_knowledge` | leitura | Busca nos documentos (sem diferenciar acentos) |
| `aspa_read_knowledge` | leitura | Lê um documento |
| `aspa_login` | sessão | Janela para você entrar no Aspa (até 5 min) |
| `aspa_list_conversations` | leitura | Lista conversas (`tab`; `filters`: sem_usuario, sem_resposta, em_automacao, com_contexto, sessao_ativa, sem_sessao_ativa; `order`: recentes, antigas) |
| `aspa_read_conversation` | leitura | Mensagens por `index` ou `contact`; `loadMoreTimes` carrega histórico; `keepUnread` mantém não lida |
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
| `aspa_send_attachment` | escrita | Arquivo local (até 16 MB) com legenda |
| `aspa_open_draft` | janela | Abre o Aspa com o rascunho na caixa para você revisar e enviar |
| `aspa_reply_to_message` | escrita | Responde citando uma mensagem (`messageIndex`) |
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

As ferramentas de escrita conferem o resultado no painel e devolvem erro em vez de dizer que deu certo quando não deu.

As ferramentas de configuração mexem só nos seus arquivos locais (nunca no Aspa) e ficam disponíveis também no modo somente leitura. O MCP também oferece o prompt `configurar` (no Claude Code: `/mcp__aspa__configurar`).

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
| `ASPA_SOCKET` | `$XDG_RUNTIME_DIR/aspa-mcp.sock` | Socket do serviço |
| `ASPA_READ_ONLY` | `0` | `1` expõe só as ferramentas de leitura, o login e a janela de revisão (use em outros clientes) |
| `ASPA_WATCH` | `1` | `0` desliga o vigia |
| `ASPA_WATCH_INTERVAL_MS` | `20000` | Intervalo do vigia |
| `ASPA_WHISPER_DIR` | `/var/tmp/aspa-mcp/whisper` | Instalação da transcrição |
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

### Limitações técnicas

- Depende da estrutura do painel do Aspa; se a Aspa mudar o layout, pode quebrar.
- Reabrir só encontra conversas concluídas na última semana.
- O nome do atendente de outras pessoas às vezes não é carregado pelo painel na sessão do serviço: a conversa aparece como atribuída (`assigned: true`) com `agent: null`. Nesses casos o filtro de notificação por nome de atendente não dispara; `sem_atendente` continua confiável.

### Editar os diagramas

As imagens em `assets/*.png` são geradas a partir de `assets/*.mmd` (Mermaid), com fundo claro para ficarem legíveis nos temas claro e escuro do GitHub:

```sh
npx -y @mermaid-js/mermaid-cli -i assets/arquitetura.mmd -o assets/arquitetura.png -b "#FBF8FF" -s 2
npx -y @mermaid-js/mermaid-cli -i assets/atendimento.mmd -o assets/atendimento.png -b "#FBF8FF" -s 2
```

### Preciso do `/chrome` (Claude in Chrome)?

Não. O aspa-mcp tem o próprio Chrome invisível. O `/chrome` só serve para o Claude olhar o Aspa aberto no **seu** navegador.

---

## 13. Roadmap

- [x] Leitura, anexos, transcrição local e envio com aprovação
- [x] Concluir, reabrir, adiar, renomear e assumir conversas
- [x] Notificações no Ubuntu, Slack (direto para a pessoa) e celular
- [x] Configuração da equipe e pessoal: tom, regras, exemplos, documentos, horários e canais
- [x] Registro de auditoria de toda ação feita no Aspa
- [x] Janela de revisão do rascunho no próprio Aspa
- [x] Filtros e ordenação da lista, busca na conversa, nos concluídos e nos contatos
- [x] Marcar como não lida, ler sem marcar, responder citando, adiar até data e hora
- [x] Estatísticas e Respostas Rápidas
- [x] Notificações por atendente, contato e conversa nova
- [x] Transferência, assumir conversa de outro atendente e criação de contato testados ao vivo
- [ ] Transcrição na GPU (CUDA)
- [ ] Usar as Respostas Rápidas automaticamente nos rascunhos (a conta ainda não tem nenhuma)
- [ ] Editar e-mail e empresa do contato; status do atendente
- [x] Modo somente leitura para outros clientes de MCP
- [x] Configuração guiada pelo próprio MCP (checklist, ajustes, documentos, Slack e teste de avisos)
- [ ] Testar de forma interativa no Codex, Antigravity, opencode (DeepSeek, GLM, Kimi), Grok Bot e Z Code
- [ ] Jornadas e etiquetas, quando configuradas na conta
- [ ] API oficial da Aspa no lugar da automação do painel, quando disponível
- [ ] Webhook de mensagens: dispensar o navegador e oferecer conector para o claude.ai
