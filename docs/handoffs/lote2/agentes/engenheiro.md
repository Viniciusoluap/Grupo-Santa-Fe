# Checkpoint — GRUPO engenheiro (correção 04, AD-02)

## Status
- [x] Prospecta: shared/engenheiro.ts, drizzle/0083_perfil_engenheiro.sql, schema.ts, server/usuario-documentos.ts (router tRPC `engenheiros` + rota Express GET /api/usuarios/:userId/documentos/:docId registrada em api/index.ts e server/_core/index.ts), configuracoes-router (engenheiro em create/update/listUsers), operacional-router (projetos.engenheiros → listarEngenheiros), AdminProjetos (CREA automático), AdminConfiguracoes + components/admin/PerfilEngenheiroPanel.tsx, client/src/lib/documentos-usuario.ts. pnpm check OK (só erros de massa-tab, de outro agente); vitest server/engenheiro.test.ts 8/8 + 6 suítes vizinhas 67/67.
- [ ] SF: lógica, migração 20261027110000_perfil_engenheiro, schema, actions, route handler, UI, Projetos
- [ ] Testes / typecheck

## Decisões
- Acesso a perfil/documentos: admin (gestão de usuários é exclusiva do admin nos dois repos — não existe módulo de "configurações/usuários" para colaborador) + o próprio engenheiro (leitura/download).
- Upload em partes de 1 MB (reusa `document_upload_chunks` no Prospecta e `documento_upload_partes` no SF); download em partes de 1 MB (limite de 4,5 MB da Vercel); ZIP montado no navegador com `fflate.zipSync` (função compartilhada testada).

## Próximo passo
- Próximo: SF (web/src/lib/engenheiro.ts espelhando shared/engenheiro.ts).
