# PARIDADE L9 — Lote 03 (18 correções) — Prospecta × Grupo Santa Fé

- Data: 29/10/2026 · Branch (ambos): `claude/lote3-18-correcoes-20261029`
- Base: main com a organização do Drive integrada por merge (Prospecta main 6ffdee3 · SF main 7f2072a).
- Mesmo conteúdo nos dois worktrees (`docs/handoffs/lote3/PARIDADE-L9.md`).
- Estado "Testada" = testes automáticos verdes nos dois sistemas; nenhuma correção foi validada em produção ainda (L10).

## Tabela por correção

| # | Correção | Prospecta — arquivo principal | Prospecta — teste | Santa Fé — arquivo principal (web/) | Santa Fé — teste | Estado |
|---|----------|-------------------------------|-------------------|-------------------------------------|------------------|--------|
| 01 | WhatsApp: seleção múltipla e exclusão em lote | `server/whatsapp-router.ts` (previaExclusaoConversas/excluirConversas), `client/src/components/whatsapp/ConversasWhatsApp.tsx` | `server/whatsapp-lote3.test.ts` | `src/lib/actions/whatsapp.ts`, `src/app/admin/whatsapp/_components/conversas-whatsapp.tsx` | `whatsapp-lote3.test.ts`, `whatsapp-lote3.db.test.ts` | Testada (local) |
| 02 | WhatsApp: vincular conversa a lead existente | `shared/whatsapp/conversas.ts`, `drizzle/0094_whatsapp_vinculo.sql` | `server/whatsapp-lote3.test.ts` (PGlite com a 0094) | `src/lib/whatsapp/conversas.ts`, migração `20261029110000_whatsapp_vinculo` | `whatsapp-lote3.db.test.ts` | Testada (local) |
| 03 | WhatsApp: destinatários sincronizados com o CRM | `server/whatsapp-router.ts` (leadsParaEnvio só `deleted_at IS NULL`), `AdminWhatsApp.tsx` | `server/whatsapp-lote3.test.ts` | `src/app/admin/whatsapp/page.tsx`, `src/app/api/whatsapp/enviar/route.ts` (lead ativo) | `whatsapp-lote3.db.test.ts` | Testada (local) |
| 04 | WhatsApp: KPI Mensagens Enviadas (sem teto de 100) | `server/whatsapp-router.ts` (resumoEnvios por período) | `server/whatsapp-lote3.test.ts` | `src/lib/actions/whatsapp.ts` (resumoEnviosWhatsapp) | `whatsapp-lote3.db.test.ts` (150/170) | Testada (local) |
| 05 | Gerador de PCI: sem Galeria de Fotos | `client/src/pages/AdminEditarObra.tsx` | `server/galeria-medicoes.test.ts`, `pci-lote3.test.ts` | `.../obras/[id]/editar/_components/editar-obra-client.tsx` | `pci-lote3.test.ts` | Testada (local) |
| 06 | Gerador de PCI: validação do cronograma | `shared/pci-gerador.ts`, `client/src/components/obra/GeradorPciAba.tsx` | `server/pci-gerador.test.ts`, `server/pci-lote3.test.ts` | `src/lib/pci-gerador.ts`, `src/components/obras/gerador-pci.tsx` | `pci-gerador.test.ts`, `pci-lote3.test.ts` | Testada (local) |
| 07 | Gerador de PCI: listas/fórmulas do Excel oficial | `shared/pci-listas.ts`, `shared/pci-curvas.ts` | `pci-lote3.test.ts`, `pci-lote3-db.test.ts` | `src/lib/pci-listas.ts`, `src/lib/pci-curvas.ts` | `pci-lote3.test.ts` | Testada (local) |
| 08 | PLS: status, acumulados, aferidos, vigência | `shared/medicao-caixa.ts`, `server/caixa/medicao-pdf.ts` | `pls-fiel-pci.test.ts`, `caixa-medicao.test.ts` | `src/lib/medicao-caixa.ts`, `src/lib/caixa/medicao-pdf.ts` | `pls-fiel-pci.test.ts` | Testada (local) |
| 09a | Integrações sem blocos do WhatsApp | `client/src/pages/admin/AdminIntegracoes.tsx` | `rbac`/`whatsapp-*` | componente órfão `conexao-whatsapp-integracoes.tsx` removido | `whatsapp-*` | Testada (local) |
| 09b | Excluir versão do modelo da PCI (lógica) | `server/pci-gerador.ts` (excluirModeloPci), `drizzle/0096_pci_lote3.sql` | `pci-lote3-db.test.ts` | `src/lib/obras/pci-gerador-dados.ts`, migração `20261029112000_pci_lote3` | `pci-modelos-lote3.db.test.ts` | Testada (local) |
| 10 | Modelos PCI XLS/XLSM/XLSB → saída .xls + compatibilidade | `server/pci-gerador.ts` (baseXlsCompativel), `server/caixa/pci-modelo-estrutura.ts` | `pci-lote3.test.ts`, `pci-lote3-db.test.ts` | `src/lib/caixa/pci-modelo-estrutura.ts`, `src/lib/obras/pci-gerador-dados.ts` | `pci-lote3*.test.ts` | Testada (local) |
| 11 | Layout global e responsividade | `client/src/components/ui/dialog.tsx` (+ select/popover/sheet), `client/src/index.css`; L9: WhatsApp, Projetos e Revisão de projeto no `Dialog` | `server/overlays-dialog.test.ts` (L9), `scripts/layout-check/check.mjs` 9/9 | `src/components/ui/modal.tsx`, `src/app/globals.css`; L9: todos os overlays restantes no `Modal` | `modal-compartilhado.test.ts` (inclui varredura L9), `scripts/layout-check/check.mjs` 9/9 | Testada (Chromium); falta Safari real |
| 12 | BPO: categorias sem contábil/centro de custo | `shared/financeiro/bpo-operacional.ts`, `server/bpo-router.ts` | `server/bpo-lote3.test.ts` | `src/lib/bpo-operacional.ts`, `src/lib/actions/bpo.ts` | `bpo-lote3.test.ts` | Testada (local) |
| 13 | Pluggy sem pageSize + excluir conta com EXCLUIR | `server/_core/pluggy.ts`, `BancosPanel.tsx` | `pluggy.test.ts`, `bancos-sync.test.ts`, `bpo-auditoria-final.test.ts` | `src/lib/bancos/pluggy.ts`, `bancos-panel.tsx` | `pluggy-v2.test.ts`, `bancos-sync.db.test.ts` (Pluggy) | Testada (local); Pluggy real pendente |
| 14 | Relatórios: VGV de Obras + Ticket Médio | `shared/financeiro/relatorios-indicadores.ts`, `server/relatorios-router.ts` | `server/relatorios-indicadores.test.ts` | `src/lib/financeiro/relatorios-bpo.ts`, `relatorios-bpo-dados.ts` | `relatorios-bpo.test.ts`, `relatorios-bpo.db.test.ts`, `relatorios-bpo-periodo.test.ts` | Testada (local) |
| 15 | DRE: filtro Mês/Ano | `server/bpo-router.ts` (dre/dreCategorias/dreAnos) | `server/bpo-lote3.test.ts` | `src/app/admin/bpo/page.tsx` (celulasDre), `bpo-client.tsx` | `bpo-lote3.test.ts` | Testada (local) |
| 16 | Cobranças/Despesas em lote (combinar, excluir, excluir tudo) | `server/bpo-lote.ts`, `client/src/components/bpo/LoteLancamentos.tsx`, `drizzle/0095_bpo_lote3.sql` | `server/bpo-lote3.test.ts` (PGlite) | `src/lib/actions/bpo-lote.ts`, `_components/barra-lote.tsx`, migração `20261029111000_bpo_lote3` | `bpo-lote3.db.test.ts` | Testada (local) |
| 17 | Vincular lançamentos a clientes do CRM | `server/bpo-router.ts` (sugestoesCliente/aplicarVinculos), `components/bpo/Vinculo*` | `server/bpo-lote3.test.ts` | `src/lib/bpo-vinculo-cliente.ts`, `src/lib/actions/bpo-vinculo.ts`, `_components/vinculo-cliente.tsx` | `bpo-lote3*.test.ts` | Testada (local) |
| 18 | Gráficos: Números de Obra, Funil, Ranking, Unidades | `shared/financeiro/relatorios-indicadores.ts`, `AdminRelatorios.tsx` | `server/relatorios-indicadores.test.ts` | `src/lib/financeiro/relatorios-bpo.ts`, `bpo-client.tsx` | `relatorios-bpo*.test.ts` | Testada (local) |
| — | Padronização numérica 1.000.000,00 | `client/src/lib/format.ts`, `NumeroInput` | `server/format.test.ts`, `server/numero-mascara.test.ts` | `src/lib/utils.ts` (formatArea/formatPercent), `CurrencyInput`/`NumeroInput` | `utils.test.ts` | Testada (Chromium); falta Safari real |

## Integração com a organização do Drive (L9)

| Ponto | Prospecta | Santa Fé | Resolução |
|-------|-----------|----------|-----------|
| Modelo da PCI (tabela) | `pci_models`: colunas do lote (deleted_*, compat_report, awaiting_confirmation, confirmed_*) + `drive_file_id` (Drive) | `PciModelo`: excluido*, relatorioCompatibilidade, aguardandoConfirmacao, confirmado* + `driveFileId` | Mantidos os dois lados |
| Envio do modelo da PCI | auditoria do lote + `copiarParaDrive("modelo_pci")` | auditoria do lote + `copiarParaDrive("pciModelo")` | Mantidos os dois lados; a cópia no Drive acontece também para versão aguardando confirmação (o arquivo é o mesmo) |
| Mídia do WhatsApp | — (sem conflito) | `midia.ts`: vínculo manual (`chaveTelefone`) + cópia/lixeira do Drive | Imports dos dois lados |

## Diferenças justificadas (stack, não regra de negócio)

- Modal: Prospecta usa o `Dialog` (Radix) compartilhado; Santa Fé usa `components/ui/modal.tsx`. Mesmo padrão (largura responsiva, altura em `dvh`, rolagem interna, Esc fecha). Exceção de stack prevista no CLAUDE.md.
- Santa Fé mantém `fixed inset-0` só no `admin-shell` (fundo do menu lateral e clique-fora dos menus do cabeçalho — não são modais; o menu tem `w-64`, cabe em 390 px). A Prospecta usa o `Sidebar`/`Sheet` de `components/ui`.
- Visualizador de documento do WhatsApp: na Prospecta um único visualizador (PDF em iframe ou aviso); no Santa Fé PDF e "outros documentos" são dois visualizadores — mesmo comportamento para o usuário.
- Detalhes do projeto: na Prospecta abre em modal (agora `Dialog`); no Santa Fé é página própria (`/admin/projetos/[id]`) — diferença anterior ao lote, apenas de navegação.
- Migrações: Prospecta em `drizzle/NNNN_*.sql` (o `drizzle/meta/_journal.json` está congelado em 0060 na main desde #139; 0061→0096 são aplicadas por SQL, sem avançar o journal — ver HANDOFF-19-10); Santa Fé em `web/prisma/migrations/<timestamp>` (o `migration_lock.toml` é `sqlite`, então `prisma migrate deploy` não roda; aplicação por SQL).

## Pendências de paridade conhecidas (anteriores ao lote, registradas pelos agentes)

- Prospecta não tem filtros de busca/mês/ano/status em Cobranças/Despesas (o "Excluir tudo" respeita os filtros existentes).
- Santa Fé não tem exportação CSV de comissões em Relatórios (a Prospecta tem).
- Áreas da incorporação exibidas com m² inteiro nos dois sistemas (relatório PDF validado) — decisão do dono.
