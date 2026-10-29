# MASTER STATUS — Lote 03 — 18 correções (Prospecta + Grupo Santa Fé)

- Branch (ambos): `claude/lote3-18-correcoes-20261029` — base: main de 29/10 (Prospecta 597697c · SF 1a62539)
- Worktrees locais: `/home/user/Prospecta-lote3`, `/home/user/Grupo-Santa-Fe-lote3` (os diretórios principais estão na frente do Drive, branch `claude/drive-organizacao-20261029`).
- Pedido do dono (29/10): concluir a organização do Drive e, na sequência, executar este lote.
- Estados: Pendente · Em auditoria · Em implementação · Implementada · Testada · Publicada · Bloqueada

| # | Correção | Lote | Estado | Prospecta | Santa Fé | SHA |
|---|----------|------|--------|-----------|----------|-----|
| 01 | WhatsApp: seleção múltipla e exclusão de conversas | L2 | Em auditoria | | | |
| 02 | WhatsApp: vincular conversa a lead existente | L2 | Em auditoria | | | |
| 03 | WhatsApp: destinatários sincronizados com o CRM | L2 | Em auditoria | | | |
| 04 | WhatsApp: indicador Mensagens Enviadas (travado em 100) | L2 | Em auditoria | | | |
| 05 | Gerador de PCI: remover Galeria de Fotos | L3 | Em auditoria | | | |
| 06 | Gerador de PCI: validar cronograma (acumulados) | L3 | Em auditoria | | | |
| 07 | Gerador de PCI: listas e fórmulas do Excel oficial | L3 | Em auditoria | | | |
| 08 | PLS: status, acumulados, aferidos, vigência | L4 | Em auditoria | | | |
| 09 | Integrações: remover blocos WhatsApp + excluir versão PCI | L4 | Em auditoria | | | |
| 10 | Modelos PCI: XLS/XLSM/XLSB → saída XLS + compatibilidade | L3 | Em auditoria | | | |
| 11 | Layout global e responsividade | L1 | Em auditoria | | | |
| 12 | BPO: categorias (remover contábil/centro de custo) | L5 | Em auditoria | | | |
| 13 | Pluggy pageSize + exclusão de conta com EXCLUIR | L6 | Em auditoria | | | |
| 14 | Relatórios: VGV de Obras + Ticket Médio | L8 | Em auditoria | | | |
| 15 | DRE: filtro Mês/Ano | L8 | Em auditoria | | | |
| 16 | Cobranças/Despesas em lote (combinar, excluir, excluir tudo) | L7 | Em auditoria | | | |
| 17 | Vincular lançamentos a clientes do CRM | L5 | Em auditoria | | | |
| 18 | Gráficos: Números de Obra, Funil, Ranking, Unidades | L8 | Em auditoria | | | |
| — | Padronização numérica global | L1 | Em auditoria | | | |

## Próximo passo exato
1. Concluir L0 (auditorias Prospecta e SF em andamento) e registrar a matriz aqui.
2. Plano por correção em `PLANO.md`; depois L1→L10.
3. Fonte para listas/fórmulas da PCI: modelo oficial em produção (`pci_models` na Prospecta, "PCI MYLCA ATUALIZADA.xlsb") e fixture `server/caixa/__fixtures__/pci-modelo-anonimo.xls`.
