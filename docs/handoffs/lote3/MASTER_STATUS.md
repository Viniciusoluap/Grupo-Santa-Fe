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
| 11 | Layout global e responsividade | L1 | Em implementação (agente layout) | dialog.tsx sem overflow; grids fixos | Sem modal compartilhado (16 overlays) | |
| 12 | BPO: categorias (remover contábil/centro de custo) | L5 | Implementada e testada (local) | Contábil obrigatório + centro custo livre | Idem | |
| 13 | Pluggy pageSize + exclusão de conta com EXCLUIR | L6 | Implementada e testada (local) | Bug pageSize v2; confirmação por rótulo | Idem | |
| 14 | Relatórios: VGV de Obras + Ticket Médio | L8 | Implementada e testada (local) | Card Avaliações | Não existe (criar) | |
| 15 | DRE: filtro Mês/Ano | L8 | Implementada e testada (local) | Sem filtro | Sem filtro | |
| 16 | Cobranças/Despesas em lote (combinar, excluir, excluir tudo) | L7 | Implementada e testada (local) | Não existe | Não existe | |
| 17 | Vincular lançamentos a clientes do CRM | L5 | Implementada e testada (local) | Parcial (manual) | Não existe | |
| 18 | Gráficos: Números de Obra, Funil, Ranking, Unidades | L8 | Implementada e testada (local) | Funil com chaves cruas; ranking lê operational_commissions VAZIA (comissões estão nas obras) | Funil por status legado; ranking take 10 antes de ordenar | |
| — | Padronização numérica global | L1 | Em implementação (agente layout) | Parcial (NumeroInput existe; type=number restantes) | Parcial (26 type=number) | |

## Próximo passo exato (29/10 ~20:45 UTC)
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