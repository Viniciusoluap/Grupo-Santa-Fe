# HANDOFF 23/10 — Lote de correções H1–H6 (Prospecta + Grupo Santa Fé)

Branch de trabalho: `claude/sync-mirrored-repos-bsqnz3` (nos dois repositórios).
Ordem aprovada: H1 → H2 → H5 → H3 → H4 → H6. Merge e deploy autorizados pelo dono ao concluir.

## Status por história

| # | História | Prospecta | Santa Fé |
|---|----------|-----------|----------|
| H1 | Fundo sem faixa branca no overscroll (iPad) | ✅ commit | ✅ commit |
| H2 | 🤝 só depois do nome (Negócio fechado) | ✅ commit | ✅ commit |
| H5 | Selo "PCI vinculada" no card da obra | ✅ commit | ✅ commit |
| H3 | Excluir definitivamente lead arquivado | ⏳ | ⏳ |
| H4 | Notificações padronizadas | ⏳ | ⏳ |
| H6 | PLS fiel à PCI (coordenadas, dados 1x, datas da obra, curva) | ⏳ | ⏳ |

## H1 — concluído
- Prospecta: `AdminRoute` marca `<html class="area-escura">`; `index.css` deixa html/body `#0F1419` e
  `overscroll-behavior-x: none`; CRM com `overflow-x-clip` no contêiner e `overscroll-x-contain` no kanban
  (rolagem horizontal só dentro do pipeline).
- Santa Fé: `AdminShell` marca `<html class="area-admin">`; `globals.css` deixa html/body com o cinza do painel
  e `overscroll-behavior-x: none`; kanban com `overscroll-x-contain`.
- Testes: (a) `pnpm check` / `tsc` OK nos dois; Playwright (Prospecta, API simulada) em 820×1180, 1180×820 e
  1024×1366: html/body escuros (antes: body branco), documento sem rolagem horizontal, kanban rola internamente.
  (b) —. (c) Confirmar no iPad real após o deploy (efeito elástico do Safari não é reproduzível no Chromium).

## H2 — concluído
- Removido o 🤝 ANTES do nome nos cards do pipeline e na visão em lista do CRM (Prospecta `AdminCRM.tsx`;
  SF `lead-kanban.tsx` e `leads-client.tsx`). Fica só o indicador de temperatura à direita/abaixo do nome.
- Tela de detalhe do lead não foi alterada (fora do print).
- Testes: (a) `pnpm check` / `tsc` OK. (b) —. (c) conferir card "Negócio fechado" em produção.

## H5 — concluído
- Prospecta: `getAllProjects` (server/db.ts) devolve `pciVinculada` (linha em `construction_pci` com `linked_at`);
  `ListaObras.tsx` mostra o selo verde "PCI vinculada" logo abaixo do selo de situação.
- Santa Fé: `carregarListaObras` devolve `pciVinculada` (`ObraPci.vinculadaEm`); `lista-obras.tsx` mostra o selo
  ao lado do selo de situação. Vale também para o Portal do Empreiteiro (mesma lista).
- Testes: (a) Prospecta: suíte completa 915/915 + `pnpm check`; Playwright (API simulada, iPad e celular): selo
  só na obra com PCI. SF: `tsc` OK; novo teste em `medicoes.db.test.ts` (sem PCI → não; PCI enviada sem vincular →
  não; vinculada → sim) passando com Postgres local. Suíte SF local: 766 ok, 10 falhas pré-existentes do ambiente
  local (gatilhos SQL/Drive ausentes no banco local; as mesmas 10 falham sem esta mudança).
  (b) —. (c) conferir na lista de Obras em produção.

## Próximo passo
H3: "Excluir definitivamente" ao lado de "Recuperar" em "Ver arquivados" (só admin, só arquivados, com confirmação,
bloqueado se houver vínculos: obra, financiamento, comissões, documentos).
