# Pasta de conhecimento

Coloque aqui os documentos que ensinam o assistente sobre a empresa. Ele consulta esta pasta antes de afirmar qualquer fato num rascunho e, se não encontrar, pergunta em vez de inventar.

## Exemplo pronto no repositório

O repositório tem um exemplo completo em `exemplos/conhecimento/`, de uma empresa **fictícia** (Acme Internet):

```
exemplos/conhecimento/
├── empresa.md                       quem somos, canais e horário
├── faq.md                           perguntas frequentes com respostas aprovadas
├── politicas.md                     cancelamento, reembolso, prazos e LGPD
├── respostas-modelo.md              frases aprovadas para situações comuns
├── produtos/
│   ├── plano-essencial.md
│   └── plano-profissional.md
└── procedimentos/
    ├── internet-lenta.md
    └── acesso-ao-app.md
```

Use como modelo de **formato**: copie um arquivo, troque o conteúdo pelo real e salve aqui. **Não copie os exemplos sem editar**: eles têm preços e prazos inventados, e o assistente passaria esses dados para clientes reais.

## Dicas de escrita

- Um assunto por arquivo, com um título claro na primeira linha (`# Plano Essencial`).
- Escreva fatos objetivos: valores, prazos, limites, passos. O assistente busca por palavras.
- Mantenha atualizado: documento velho vira resposta errada.
- Formatos aceitos: `.md`, `.txt`, `.pdf`, `.csv`, `.json`, `.yaml`. Subpastas funcionam.

Esta pasta fica só no seu computador. Não coloque os documentos reais no repositório público.
