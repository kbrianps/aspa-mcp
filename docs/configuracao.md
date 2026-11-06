# Personalização: tom, regras e documentos

[← Voltar ao README](../README.md) · [Instalação](instalacao.md) · [Uso](uso.md) · [Personalização](configuracao.md) · [Notificações](notificacoes.md) · [Problemas](problemas.md) · [Referência](referencia.md)

🇺🇸 [English](en/configuration.md)

Tudo é configurável em arquivos simples, em `~/.config/aspa-mcp/`:

| Arquivo | Quem edita | Para quê |
| --- | --- | --- |
| `equipe.yaml` | a equipe (igual para todos) | Sobre a empresa, tom, assinatura padrão, regras, exemplos, documentos, notificações padrão |
| `pessoal.yaml` | cada atendente | Sua assinatura, seus horários e canais de aviso. **Tem prioridade** sobre o da equipe |
| `conhecimento/` | a equipe | Documentos que ensinam o assistente sobre a empresa |

**As mudanças valem na hora**, sem reiniciar nada.

### Modelos e exemplo pronto

O repositório traz duas pastas para você não começar do zero:

| Pasta | O que é | Como usar |
| --- | --- | --- |
| [`modelos/`](../modelos/) | Arquivos **em branco**, comentados | O `npm run init-config` copia para `~/.config/aspa-mcp/`. É só preencher |
| [`exemplos/`](../exemplos/) | Uma configuração **completa e preenchida** de uma empresa fictícia (Acme Internet) | Abra para ver como fica um `equipe.yaml`, um `pessoal.yaml` e a pasta de conhecimento de verdade. Copie o **formato**, não o conteúdo |

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
        ├── internet-lenta.md        perguntas, passos, quando escalar, o que não fazer
        └── acesso-ao-app.md
```

Passo a passo sugerido:

1. Rode `npm run init-config` (cria os arquivos em branco).
2. Abra `exemplos/equipe.yaml` ao lado do seu `~/.config/aspa-mcp/equipe.yaml` e preencha o seu seguindo o formato.
3. Para cada documento de `exemplos/conhecimento/` que fizer sentido, crie o equivalente real em `~/.config/aspa-mcp/conhecimento/`.
4. Peça ao assistente: *"Mostra as diretrizes do Aspa"*. Se aparecer algum **aviso**, ainda há valor de modelo ou exemplo para trocar.

> **Não copie os documentos de exemplo sem editar.** Eles têm preços, prazos e políticas inventados, marcados com "EXEMPLO FICTÍCIO". Se ficarem na sua pasta de conhecimento, as diretrizes avisam o assistente para não usar esses dados com clientes.

```sh
nano ~/.config/aspa-mcp/equipe.yaml
nano ~/.config/aspa-mcp/pessoal.yaml
```

> Como o repositório é público, **não** coloque estes arquivos nele. Compartilhe o `equipe.yaml` e os documentos com o time por um canal privado.

### Sobre a empresa e tom dos rascunhos

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
| `rascunhos.sempre` / `rascunhos.nunca` | Regras que o assistente segue em todo rascunho |
| `rascunhos.quando_usar_template` | Quando preferir um template do WhatsApp |
| `rascunhos.exemplos` | Respostas modelo para situações comuns (o assistente imita o estilo) |

### Documentos da empresa

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

Antes de afirmar qualquer fato num rascunho, o assistente busca nessa pasta. Se não encontrar, ele pergunta em vez de inventar. Para mudar a pasta: `conhecimento.pasta` no YAML.

### Quando receber notificações

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
| Só as da Ana | `abas: [todos]` e `atendentes: [Ana]` |
| Tudo, menos um contato de testes | `contatos_ignorar: [Teste]` |
| Só de um cliente importante | `abas: [todos]` e `contatos_incluir: [ACME]` |

### Conferir a configuração

Peça ao assistente:

```text
Mostra as diretrizes do Aspa e me diz se tem algum erro na configuração.
```

Ou veja o log do serviço, que avisa valores inválidos (e usa o padrão no lugar):

```sh
journalctl --user -u aspa-mcp -n 20
```
