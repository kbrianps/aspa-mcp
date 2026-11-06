<p align="center">
  <img src="assets/banner.svg" alt="aspa-mcp: assistentes de IA + Aspa Chat para equipes de suporte" width="100%">
</p>

<p align="center">
  <img alt="Ubuntu 26.04 LTS" src="https://img.shields.io/badge/Ubuntu-26.04_LTS-6200E9?logo=ubuntu&logoColor=white">
  <img alt="Claude Code 2.1" src="https://img.shields.io/badge/Claude_Code-2.1-6200E9?logo=anthropic&logoColor=white">
  <img alt="Codex" src="https://img.shields.io/badge/Codex-testado-6200E9?logo=openai&logoColor=white">
  <img alt="Model Context Protocol" src="https://img.shields.io/badge/MCP-stdio-6200E9">
  <img alt="Node.js 22.12+" src="https://img.shields.io/badge/Node.js-22.12%2B-6200E9?logo=nodedotjs&logoColor=white">
  <img alt="MIT License" src="https://img.shields.io/badge/licen%C3%A7a-MIT-6200E9">
  <img alt="Transcrição local" src="https://img.shields.io/badge/Whisper-local-6200E9">
</p>

<p align="center">
  🇧🇷 Português · 🇺🇸 <a href="README.en.md">English</a>
</p>

<p align="center">
  <b>Atenda pelo Aspa Chat conversando com o seu assistente de IA (Claude Code, Codex e outros).</b><br>
  Ele lê as conversas, entende áudios e anexos, escreve no tom da sua equipe<br>
  e só envia, transfere ou conclui depois da sua aprovação.
</p>

---

## Destaques

| Recurso | O que faz |
| --- | --- |
| 💬 **Lê tudo** | Conversas, histórico, imagens, PDFs e áudios (com transcrição local opcional). |
| ✍️ **Escreve no seu tom** | Tom, assinatura, regras e exemplos da equipe, mais documentos da empresa como fonte. |
| ✅ **Você aprova** | Nada é enviado, transferido ou concluído sem a sua confirmação, no assistente ou na janela de revisão do Aspa. |
| 🔔 **Avisa na hora certa** | Ubuntu, Slack e celular, só das suas conversas e só no seu horário. |
| 🔒 **Fica no seu computador** | Sessão, anexos, documentos e áudios não saem da sua máquina. |

## Início rápido

Precisa de: Linux com systemd (Ubuntu testado), Node.js 22.12 ou mais novo, Google Chrome, uma conta no Aspa e um assistente de IA (Claude Code, Codex ou outro cliente de MCP).

1. **Baixar e instalar**

   ```sh
   git clone <link-do-repositório> ~/dev/aspa-mcp
   cd ~/dev/aspa-mcp && npm install
   npm run install-service && npm run init-config
   ```

2. **Conectar ao seu assistente**

   ```sh
   # Claude Code (completo, com envio após aprovação)
   claude mcp add --scope user aspa -- node "$HOME/dev/aspa-mcp/index.mjs"

   # Codex ou outro cliente (modo seguro: lê, resume e abre rascunhos; você envia no Aspa)
   codex mcp add aspa --env ASPA_READ_ONLY=1 -- node "$HOME/dev/aspa-mcp/index.mjs"
   ```

3. **Pedir a configuração** no assistente:

   ```text
   Me ajuda a configurar o Aspa.
   ```

   Ele faz o login no Aspa com você e configura empresa, tom, assinatura, documentos e avisos, um item por vez.

4. **Aviso no Slack** (opcional): `npm run slack -- <seu ID do Slack>` e cole o token quando pedir.

5. **Usar**: *"Lista as minhas conversas do Aspa e me diz quais estão não lidas."*

Passo a passo completo, com cada comando explicado: [docs/instalacao.md](docs/instalacao.md).

## Documentação

| Guia | O que tem |
| --- | --- |
| [Instalação](docs/instalacao.md) | Requisitos e instalação passo a passo |
| [Como usar](docs/uso.md) | Fluxo de atendimento, regras e exemplos de pedidos |
| [Personalização](docs/configuracao.md) | Tom, regras, exemplos de resposta, documentos da empresa, quando receber avisos, modelos e exemplo pronto |
| [Notificações](docs/notificacoes.md) | Ubuntu, Slack (direto para você) e celular |
| [Transcrição de áudio](docs/transcricao.md) | Whisper local, opcional |
| [Outros clientes de MCP](docs/outros-clientes.md) | Codex, Antigravity, opencode, Grok Bot, Z Code e o modo somente leitura |
| [Segurança e privacidade](docs/seguranca.md) | Aprovação, registro de auditoria, LGPD, segredos |
| [O que faz e o que não faz](docs/o-que-faz.md) | Limites do aspa-mcp e do painel do Aspa |
| [Problemas comuns](docs/problemas.md) | Erros frequentes, atualização e comandos do serviço |
| [Referência técnica](docs/referencia.md) | Componentes, todas as ferramentas, variáveis e comandos |

## Como funciona

<p align="center">
  <img src="assets/arquitetura.png" alt="Arquitetura do aspa-mcp: assistente de IA (Claude Code, Codex), servidor MCP, serviço em segundo plano, Chrome invisível, Aspa Chat, clientes e notificações" width="100%">
</p>

<sub>Fonte editável do diagrama: <a href="assets/arquitetura.mmd"><code>assets/arquitetura.mmd</code></a></sub>

O **serviço em segundo plano** mantém um Chrome invisível logado no Aspa, executa uma ação por vez no painel e vigia mensagens novas. O **servidor MCP** é a ponte com o assistente (Claude Code, Codex ou outro cliente de MCP) e também entrega as diretrizes e os documentos da equipe.

### Um atendimento do começo ao fim

<p align="center">
  <img src="assets/atendimento.png" alt="Sequência de um atendimento: mensagem do cliente, aviso, leitura, rascunho, aprovação e envio" width="100%">
</p>

<sub>Fonte editável do diagrama: <a href="assets/atendimento.mmd"><code>assets/atendimento.mmd</code></a></sub>

## Testado com

| Componente | Versão |
| --- | --- |
| Sistema | Ubuntu 26.04.1 LTS (GNOME Shell 50.1, X11, kernel 7.0) |
| Claude Code | 2.1.318 |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |
| Também testado em | Codex CLI 0.167.0 (outro atendente, Ubuntu 26.04.1 LTS) |
| Node.js | 22.23.2 |
| Google Chrome | 157.0.8103.38 |
| Python (transcrição) | 3.14.4 com faster-whisper 1.2.1, modelo `small`, CPU |
| Data dos testes | novembro de 2026 |

Testado de ponta a ponta: login, leitura, anexos (imagem, PDF, áudio), transcrição, envio de texto, anexo e template, concluir, reabrir, adiar, renomear contato e notificações no Ubuntu. Também testados: assumir, transferir, criar contato, janela de revisão, filtros, busca, estatísticas, responder citando e adiar até data. Anexos de vídeo: só download. No Codex, um segundo atendente testou a instalação, a configuração guiada e a leitura, sem enviar nada (detalhes em [Outros clientes](docs/outros-clientes.md)).

## Segurança em uma frase

Nada é enviado, transferido ou concluído sem a sua aprovação, toda ação confere antes se a conversa aberta é a certa, e tudo fica num registro de auditoria local. Detalhes em [Segurança e privacidade](docs/seguranca.md).

## Roadmap

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
- [x] Modo somente leitura para outros clientes de MCP
- [x] Configuração guiada pelo próprio MCP (checklist, ajustes, documentos, Slack e teste de avisos)
- [ ] Transcrição na GPU (CUDA)
- [ ] Usar as Respostas Rápidas automaticamente nos rascunhos (a conta ainda não tem nenhuma)
- [ ] Editar e-mail e empresa do contato; status do atendente
- [ ] Testar de forma interativa no Antigravity, opencode (DeepSeek, GLM, Kimi), Grok Bot e Z Code
- [ ] Jornadas e etiquetas, quando configuradas na conta
- [ ] API oficial da Aspa no lugar da automação do painel, quando disponível
- [ ] Webhook de mensagens: dispensar o navegador e oferecer conector para o claude.ai

## Licença

[MIT](LICENSE). Projeto independente, sem vínculo com a Aspa.
