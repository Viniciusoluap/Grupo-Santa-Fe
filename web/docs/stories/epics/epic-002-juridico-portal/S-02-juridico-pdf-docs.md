# Story S-02 — Jurídico: Geração de PDF e Documentos
**Epic:** EPIC-002
**Status:** Ready
**Agent:** @dev
**Depends on:** S-01

## Contexto

O módulo Jurídico (`/admin/juridico`) já tem esqueleto funcional com lista de contratos e formulário de criação. Precisa ser expandido com:
- Geração de PDF do contrato via jsPDF (server-side)
- Armazenamento no Vercel Blob
- Upload de contrato já assinado
- Visualização de documentos do contrato
- Indicador de status de assinatura

## Acceptance Criteria

- [ ] AC-01: Botão "Gerar PDF" na linha de cada contrato na tabela de Jurídico
- [ ] AC-02: Server Action `gerarPdfContrato(contratoId)` gera PDF com: logo/cabeçalho Grupo Santa Fé, número do contrato, tipo, partes, valor, cláusulas, rodapé com espaço para assinaturas
- [ ] AC-03: PDF é salvo no Vercel Blob e URL registrada em `ContratoDocumento` (tipo `"contrato_gerado"`)
- [ ] AC-04: Após geração, botão muda para "Baixar PDF" com link direto à URL do Blob
- [ ] AC-05: Botão "Upload Assinado" permite upload de PDF assinado manualmente; salva em Blob e registra `ContratoDocumento` (tipo `"assinado"`), atualiza `assinaturaStatus` para `"assinado"`
- [ ] AC-06: Coluna "Docs" na tabela mostra contagem de documentos do contrato
- [ ] AC-07: Modal/dropdown ao clicar no contrato lista todos os documentos com links de download
- [ ] AC-08: Badge de `assinaturaStatus` visível na tabela: 🔴 pendente, 🟡 solicitado, 🟢 assinado
- [ ] AC-09: Todas as rotas/actions com autenticação obrigatória

## Tasks

- [ ] Criar `web/src/lib/actions/juridico.ts` com `gerarPdfContrato`, `uploadContratoAssinado`
- [ ] Implementar geração PDF com jsPDF (template básico com dados do contrato)
- [ ] Implementar upload para Vercel Blob usando `@vercel/blob`
- [ ] Atualizar `web/src/app/admin/juridico/page.tsx` — adicionar coluna Docs e badge assinatura
- [ ] Criar `web/src/app/admin/juridico/_components/contrato-documentos.tsx` — modal de documentos
- [ ] Criar `web/src/app/admin/juridico/_components/contrato-acoes.tsx` — botões gerar/upload

## File List

- `web/src/lib/actions/juridico.ts` (novo)
- `web/src/app/admin/juridico/page.tsx` (modificar)
- `web/src/app/admin/juridico/_components/contrato-documentos.tsx` (novo)
- `web/src/app/admin/juridico/_components/contrato-acoes.tsx` (novo)
