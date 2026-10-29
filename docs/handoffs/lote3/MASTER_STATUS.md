# MASTER STATUS — Lote 03 — 18 correções (Prospecta + Grupo Santa Fé)

- Branch (ambos): `claude/lote3-18-correcoes-20261029` — base: main de 29/10 (Prospecta 597697c · SF 1a62539)
- Worktrees locais: `/home/user/Prospecta-lote3`, `/home/user/Grupo-Santa-Fe-lote3` (os diretórios principais estão na frente do Drive, branch `claude/drive-organizacao-20261029`).
- Pedido do dono (29/10): concluir a organização do Drive e, na sequência, executar este lote.
- Estados: Pendente · Em auditoria · Em implementação · Implementada · Testada · Publicada · Bloqueada

| # | Correção | Lote | Estado | Prospecta | Santa Fé | SHA |
|---|----------|------|--------|-----------|----------|-----|
| 01 | WhatsApp: seleção múltipla e exclusão de conversas | L2 | Implementada e testada (local) | Parcial (lixeira 1 a 1) | Parcial (lixeira 1 a 1) | |
| 02 | WhatsApp: vincular conversa a lead existente | L2 | Implementada e testada (local) | Não existe (vínculo inferido por telefone) | Não existe | |
| 03 | WhatsApp: destinatários sincronizados com o CRM | L2 | Implementada e testada (local) | Bug: leadsParaEnvio sem deleted_at (André Renan excluído 26/10 aparece) | Bug: sem filtro excluidoEm | |
| 04 | WhatsApp: indicador Mensagens Enviadas (travado em 100) | L2 | Implementada e testada (local) | Bug: historico .limit(100) e length | Bug: take 100 e length | |
| 05 | Gerador de PCI: remover Galeria de Fotos | L3 | Implementada e testada (local) | Existe (galeria sob o gerador; manter p/ empreiteiro) | Existe (idem) | |
| 06 | Gerador de PCI: validar cronograma (acumulados) | L3 | Implementada e testada (local) | Parcial (sem validação; max só no blur) | Parcial (idem) | |
| 07 | Gerador de PCI: listas e fórmulas do Excel oficial | L3 | Implementada e testada (local) | Não existe (todos texto livre; BIFF8 não lê DV) | Não existe | |
| 08 | PLS: status, acumulados, aferidos, vigência | L4 | Implementada e testada (local) | Parcial (status depende de cache; aferido vazio) | Parcial (idem) | |
| 09 | Integrações: remover blocos WhatsApp + excluir versão PCI | L4 | Implementada e testada (local) | Blocos WA em Integrações; sem excluir versão | Blocos WA já não renderizados (componente órfão); sem excluir versão | |
| 10 | Modelos PCI: XLS/XLSM/XLSB → saída XLS + compatibilidade | L3 | Implementada e testada (local) | Saída = formato do modelo (xlsm→xlsm) | Idem | |
| 11 | Layout global e responsividade | L1 | Testada (Chromium); falta Safari real | dialog.tsx sem overflow; grids fixos | Sem modal compartilhado (16 overlays) | |
| 12 | BPO: categorias (remover contábil/centro de custo) | L5 | Implementada e testada (local) | Contábil obrigatório + centro custo livre | Idem | |
| 13 | Pluggy pageSize + exclusão de conta com EXCLUIR | L6 | Implementada e testada (local) | Bug pageSize v2; confirmação por rótulo | Idem | |
| 14 | Relatórios: VGV de Obras + Ticket Médio | L8 | Implementada e testada (local) | Card Avaliações | Não existe (criar) | |
| 15 | DRE: filtro Mês/Ano | L8 | Implementada e testada (local) | Sem filtro | Sem filtro | |
| 16 | Cobranças/Despesas em lote (combinar, excluir, excluir tudo) | L7 | Implementada e testada (local) | Não existe | Não existe | |
| 17 | Vincular lançamentos a clientes do CRM | L5 | Implementada e testada (local) | Parcial (manual) | Não existe | |
| 18 | Gráficos: Números de Obra, Funil, Ranking, Unidades | L8 | Implementada e testada (local) | Funil com chaves cruas; ranking lê operational_commissions VAZIA (comissões estão nas obras) | Funil por status legado; ranking take 10 antes de ordenar | |
| — | Padronização numérica global | L1 | Testada (Chromium); falta Safari real | Parcial (NumeroInput existe; type=number restantes) | Parcial (26 type=number) | |

## L9 — integração da main (Drive) + suíte completa + paridade (29/10 ~21:40 UTC)
- Merge (sem rebase) da main nas branches do lote: Prospecta `6476d28` (main 6ffdee3), SF `5fbdae2` (main 7f2072a).
  Conflitos resolvidos preservando os dois lados: P `drizzle/schema.ts` (pci_models: colunas do lote + drive_file_id) e
  `server/pci-gerador.ts` (auditoria do lote + cópia no Drive); SF `web/prisma/schema.prisma` (PciModelo, idem, diff mínimo,
  sem `prisma format`), `web/src/lib/obras/pci-gerador-dados.ts` (idem) e `web/src/lib/whatsapp/midia.ts` (imports dos dois).
- Migrações em ordem: P 0093 (Drive) → 0094 → 0095 → 0096; SF 20261029100000 → 100100 (Drive) → 110000 → 111000 → 112000.
  `drizzle/meta/_journal.json` NÃO foi avançado: está congelado em 0060 na main desde #139 e 0061→0093 também não têm
  entrada (aplicação por SQL; ver HANDOFF-19-10). Avançar só 0093-0096 criaria lacuna e faria um `drizzle-kit migrate`
  tentar reaplicar o histórico.
- Modal (correção 11): SF migrou os overlays restantes para `web/src/components/ui/modal.tsx` (agenda, usuários, corretores x2,
  documentos/edição de contrato, revisão de projeto, sugestão/ZAP, WhatsApp: PDF/imagem/documento/vínculo/exclusão em lote,
  foto de perfil do admin-shell) — `72e470e`; só o fundo do drawer e o clique-fora dos menus do admin-shell ficam com
  `fixed inset-0`. Prospecta: visualizadores do WhatsApp, detalhes do projeto e pedido de revisão passaram ao `Dialog` — `1578fc9`.
  Testes de varredura nos dois (`modal-compartilhado.test.ts`, `server/overlays-dialog.test.ts`).
- Ajuste de testes quebrados pela main no SF — `c9133fe`: `server-only` simulado em medicoes-atomicidade/portal-empreiteiro
  (obra-progresso importa drive-organizacao) e payload válido no teste do webhook Asaas (a main passou a recusar corpo sem `event`).
- Paridade: `PARIDADE-L9.md` (tabela correção × sistema × arquivo × teste × estado).

### Testes L9
(a) automáticos
- Prospecta: `pnpm check` OK; `pnpm vitest run` completo 173 arquivos / 1389 testes OK; `pnpm build` OK;
  `scripts/layout-check/check.mjs` 9/9 (390/820/1440).
- SF: `npx prisma generate` + `npx tsc --noEmit` OK; eslint nos arquivos tocados 0 erros (avisos `<img>`/`Download` não usado, pré-existentes);
  `npx vitest run` sem banco 149 arquivos OK + 26 pulados (1071 testes OK); com banco local `santafe_l9` (db push, `--no-file-parallelism`)
  1208 OK / 11 falhas, todas pré-existentes na main (ver abaixo); `npx next build` OK; `scripts/layout-check/check.mjs` 9/9.
- Falhas pré-existentes (mesmo código/teste na main, nenhuma em arquivo do lote): exclusao-definitiva (4), projeto-engenheiro (3),
  medicao-drive (2), bancos-sync "Asaas" (1), obra-pagamento-etapa (1: INSERT cru sem `atualizadoEm`, schema igual ao da main).
  Observação: o banco local precisa de um usuário admin (6 suítes usam `findFirst({ papel: "admin" })`); `prisma/seed.ts` está
  desatualizado (adapter SQLite) — o admin foi inserido por SQL no banco local.
- Migrações (banco limpo): P — DDL do schema da base (597697c) + 0093→0096 aplicadas via psql; colunas idênticas às do schema
  da branch (1215 colunas, diff vazio) e as quatro reaplicam sem erro (idempotentes). Replay 0000→0096 puro não é possível:
  0019 depende de `regularizacoes`, criada fora das migrações (lacuna histórica conhecida). SF — `prisma migrate deploy` falha
  (P3019, `migration_lock.toml` = sqlite, conhecido); schema da base (1a62539) + 5 migrações novas via psql → `prisma migrate diff`
  contra o schema da branch = vazio; reaplicação idempotente OK.
(b) manuais: nenhuma tela aberta com dados reais (só o harness Chromium).
(c) pendente em produção: migrações do lote, Safari iPhone/iPad reais, Pluggy real, fluxos com dados reais.

## Próximo passo exato (L10)
- Aplicar em produção, com autorização: Prospecta (Neon) `drizzle/0094_whatsapp_vinculo.sql`, `0095_bpo_lote3.sql`, `0096_pci_lote3.sql`;
  SF (Supabase) `20261029110000_whatsapp_vinculo`, `20261029111000_bpo_lote3`, `20261029112000_pci_lote3` — antes do merge.
- Abrir os PRs da branch `claude/lote3-18-correcoes-20261029` nos dois repositórios, revisar, mesclar e acompanhar o deploy.
- Smoke via logs da Vercel; validar no Safari real (iPhone/iPad); relatório final separando (a)/(b)/(c).

## Histórico — próximo passo anterior (29/10 ~20:45 UTC)
- Drive concluído: PRs Prospecta #176 e SF #239 mesclados (main 6ffdee3 / 7f2072a); migrações Neon 0093 e Supabase 20261029100000 + 20261029100100 aplicadas em produção; deploys de produção iniciados.
- Grupos WhatsApp (01-04, 09a), Relatórios (14, 18), PCI (05-08, 09b, 10) e BPO (12, 13, 15, 16, 17) implementados e testados localmente — checkpoints em `agentes/`. Prospecta 2741b2b, SF deeea2d.
- Em andamento: grupo layout (11 + numérico) — checkpoint `agentes/layout.md`.
- Depois: L9 (trazer a main com o Drive para as branches do lote, suíte completa, paridade) e L10 (migrações P 0094/0095/0096 e SF 20261029110000/111000/112000 em produção, PRs, merge, deploy, smoke via logs da Vercel, relatório (a)/(b)/(c)).

## Histórico (29/10 ~04:05 UTC)
- L0 concluída: `AUDITORIA-PROSPECTA.md`, `AUDITORIA-SF.md`. Dado de produção (Prospecta): operational_commissions vazia; etapas gravadas lead_new/attending/followup/approved_projects/contracts_registry/measurements.
- PCI oficial do dono recebida (PCI20CAIXA.xls, também cadastrada na Prospecta como modelo v2 atual). Mapeamento em andamento → `MAPEAMENTO-PCI.md` + `pci-listas.json`.
- Agentes em execução (sem commit; orquestrador commita): whatsapp (01-04, 09a), bpo (12, 17, 13, 16, 15), relatorios (14, 18). Checkpoints em `agentes/`.
- Depois: grupo PCI (05, 06, 07, 08, 09b, 10) com o mapeamento; grupo layout+numérico (11) por último; L9 testes/paridade; L10 PRs/migrações/merge/deploy.
- Migrações reservadas: P 0093 (Drive), 0094 whatsapp, 0095 bpo, 0096+ PCI; SF 20261029100000 (Drive), 20261029110000 whatsapp, 20261029111000 bpo, 2026102912xxxx PCI.
## L10 — publicação (29/10 ~21:40 UTC)
- Migrações aplicadas em produção: Neon 0094, 0095, 0096; Supabase 20261029110000, 20261029111000, 20261029112000 (todas aditivas/idempotentes).
- PRs abertos (rascunho): Prospecta #180, Santa Fé #242 — aguardando build da Vercel e revisão automática.
- Próximo passo exato: build verde + achados de revisão tratados → marcar pronto, merge, conferir deploy de produção READY e erros de runtime na Vercel; depois relatório final (a)/(b)/(c). Pendências de produção: Safari real, Pluggy real, m² com 2 casas na incorporação (decisão do dono), CSV de comissões no SF.
