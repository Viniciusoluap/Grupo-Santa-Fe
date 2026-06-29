# Story S-01 — Schema Prisma: Modelos Jurídico e Chat
**Epic:** EPIC-002
**Status:** Ready
**Agent:** @data-engineer → @dev

## Contexto

O módulo Jurídico precisa de dois novos modelos e extensões no modelo `Contrato` existente para suportar documentos de contratos e chat de atendimento.

## Acceptance Criteria

- [ ] AC-01: Modelo `ContratoDocumento` criado com campos: `id`, `contratoId`, `nome`, `url`, `tipo` (`contrato_gerado|assinado|anexo`), `criadoEm`
- [ ] AC-02: Modelo `ChatMensagem` criado com campos: `id`, `leadId`, `remetente` (`cliente|corretor|sistema`), `texto`, `lido`, `criadoEm`
- [ ] AC-03: Modelo `Contrato` estendido com: `leadId` (opcional), `assinaturaStatus` (default `"pendente"`), `assinaturaGovId` (opcional), relação `documentos`
- [ ] AC-04: Modelo `Lead` estendido com relações `contratos` e `chatMensagens`
- [ ] AC-05: Migration Prisma gerada e aplicada sem erros
- [ ] AC-06: Prisma Client regenerado — TypeScript reconhece todos os novos campos

## Tasks

- [ ] Editar `web/prisma/schema.prisma` — adicionar `ContratoDocumento`, `ChatMensagem`, extensões em `Contrato` e `Lead`
- [ ] Executar `npx prisma migrate dev --name juridico-chat-schema`
- [ ] Verificar saída sem erros e migration aplicada
- [ ] Executar `npx prisma generate` se necessário

## File List

- `web/prisma/schema.prisma`
- `web/prisma/migrations/` (nova migration)
