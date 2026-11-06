# Contributing

🇧🇷 Contribuições são bem-vindas. Código e mensagens de commit em inglês; textos para o atendente em pt-BR. Nunca coloque dados reais de clientes, tokens ou nomes de pessoas e empresas reais em issues, testes ou exemplos.

## Before you start

1. Node.js 22.12 or newer (`nvm use` reads `.nvmrc`).
2. `npm ci`
3. `npm test` must pass.

## Rules

- Source code, comments, logs and commit messages in English; user-facing text (errors, notifications, checklist) in pt-BR.
- [Conventional Commits](https://www.conventionalcommits.org/): `fix: ...`, `feat: ...`, `docs: ...`.
- Every write tool must require the contact name, check the open conversation before the final click and be listed in `tools.mjs` with an audit label.
- Panel selectors and labels change: run `npm run doctor -- "<your own test contact>"` before and after touching `panel.mjs`.
- Test write actions only on a conversation with your own phone number.
- Use only fictitious data in tests, fixtures, examples and screenshots.
- Update `CHANGELOG.md` and both language versions of the docs (`docs/` and `docs/en/`).

## Releases

Maintainers bump `package.json`, add a `CHANGELOG.md` entry, tag `vX.Y.Z` and push the tag. `npm run atualizar` installs the latest tag.
