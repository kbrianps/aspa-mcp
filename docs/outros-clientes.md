# Usar com outros clientes de MCP

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/other-clients.md)

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
| Codex (outro atendente, Ubuntu, modo somente leitura) | Testado: instalação, atualização, configuração guiada (checklist e ajustes), estatísticas, diretrizes, listagem, conversas sem resposta, leitura sem marcar como lida, resumo e rascunho no tom da equipe. O Codex não tentou assumir nem responder conversa de outro atendente. Falta: aviso no Slack, conferência de segurança das ferramentas e janela de revisão numa conversa própria |
| opencode 2.2.5 (DeepSeek, GLM, Kimi via Morph) | Registrado; testar no modo interativo |
| Grok Bot 0.78, Z Code 3.16 | Configurar pelo app e testar |
