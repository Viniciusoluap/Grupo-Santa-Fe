# MASTER STATUS — Lote 02 — 22 correções (Prospecta + Grupo Santa Fé)

- Branch (ambos os repos): `claude/lote2-22-correcoes-20261027`
- Base: Prospecta `08fdd3d` · Santa Fé `a696389` (origin/main em 27/10/2026)
- Agente: Claude Code (orquestração AIOX). Codex trabalha em paralelo em `codex/aiox-16-correcoes-20261026` — **não tocar** nos arquivos dele (ver EXECUTION_LOG).
- Plano: ver ARCHITECTURE_DECISIONS.md (AD-10 ondas).
- Autorização do dono (27/10): execução completa, merge e deploy.

Estados: `Auditoria` · `Planejado` · `Em andamento` · `Implementado` · `Testado` · `Em produção` · `Bloqueado`

| # | Correção | Auditoria SF (origin/main) | Auditoria Prospecta | Estado | SHA |
|---|----------|---------------------------|---------------------|--------|-----|
| 01 | Remover PLS XLS (manter PLS PDF + PCI XLS) | Existe; remover XLS da UI/rota/e-mail/Drive | Existe (BIFF8 xls+pdf, e-mail pdf+xls) | Testada (auto) | 3d0d3fa / 59abb8a |
| 02 | Fotos por medição em Detalhes da Obra | Parcial (só Editar Obra agrupa) | Detalhes em grade plana; Editar agrupa | Testada (auto) | 3d0d3fa / 59abb8a |
| 03 | Gerador de PCI + Sub PCI atual (Integrações) | Parcial (leitor/gravador PLS existem; sem gerador) | Parcial (leitor; sem gerador) | Em implementação | — |
| 04 | Perfil Engenheiro + CREA + documentos | Faltante (sem papel engenheiro, sem docs de usuário) | Faltante (sem papel/docs/ZIP) | Testada (auto) | 3d0d3fa / 59abb8a |
| 05 | Mapa Operacional satélite/ruas + cluster | Parcial (OSM, sem cluster) | OSM, circleMarker, sem cluster | Testada (auto) | 3d0d3fa / 59abb8a |
| 06 | Incorporação sem KML (checkbox) | Bloqueio por geojson existe | Bloqueio sem KML | Testada (auto) — migrações 0084 / 20261027120000 pendentes em prod | 4a5a561 / 6380e23 |
| 07 | Projeto Aprovado ↔ Projetos | Não integrado; Projeto exige lead | Separados (lead_id já nulo) | Testada (auto) — migrações 0086 / 20261027140000 pendentes em prod | 003f43d / dfdbcdc |
| 08 | Dados Gerais (nome empreendimento, responsável por ID, remover campos) | Existe; responsável texto livre | Existe; responsável texto | Testada (auto) — migrações 0084 / 20261027120000 pendentes em prod | 4a5a561 / 6380e23 |
| 09 | Redesign Incorporação | Grade de botões, 5 fases | 5 fases/22 etapas | Planejado | — |
| 10 | Estudo de Massa Generativa | Existe com geometria real (turf) | Existe (turf, genético) | Testada (auto) — migrações 0084 / 20261027120000 pendentes em prod | 4a5a561 / 6380e23 |
| 11 | Estudos Salvos | Persistência simples, sem versões/UX | JSON sobrescreve | Testada (auto) — migrações 0084 / 20261027120000 pendentes em prod | 4a5a561 / 6380e23 |
| 12 | Orçamento Parametrizado + import Excel | Parcial (sem import) | Parcial (sem import) | Em implementação | — |
| 13 | Negociação responsiva | Existe (cartões) | Existe | Planejado | — |
| 14 | Projeto Aprovado responsivo | Existe (tabela) | Existe | Planejado | — |
| 15 | Unidades do cenário + comprador CRM | Parcial (manual, comprador texto) | Parcial (manual) | Em implementação | — |
| 16 | Máscara R$ + editar/excluir unidade | Faltante | Faltante | Em implementação | — |
| 17 | Planejamento responsivo | Existe | Existe | Planejado | — |
| 18 | Fornecedores R$ + Orçado vs Contratado | Parcial | Parcial | Em implementação | — |
| 19 | Indicadores Fornecedores/Material/Atendimento | Parcial | Parcial | Em implementação | — |
| 20 | Viabilidade Terreno ↔ cenário | Parcial (% fixos) | % fixos 10/5/25 | Em implementação | — |
| 21 | Componente global de valor BRL | Fragmentado (≥7 padrões) | ≥10 padrões; formatCurrency centavos×reais | Testada (auto) — base pronta | 3d0d3fa / 59abb8a |
| 22 | Relatórios da Viabilidade → Relatório Executivo | Duplicado (2 executivos) | Duplicado | Planejado | — |

## Próximo passo exato (atualizado 27/10 02:15 UTC)
- SHAs na coluna: Prospecta / Santa Fé (checkpoint da Onda 1).
- Agentes interrompidos por limite de uso às ~02:00 (reset 05:40 UTC); trabalho preservado no commit de checkpoint.
- Em execução: incorporacao-core (06/08/10/11 — Prospecta servidor pronto; falta UI Prospecta + porte SF), pci-gerador (03), projetos-aprovacao (07).
- Depois: Onda 2 restante {12,20} {15,16,18,19}; Onda 3 {09,13,14,17} → {22}; build, PRs, migrações prod (Prospecta 0082–0086 via Neon; SF 20261027* via Supabase), merge, deploy.
- Testes (a) automáticos: Prospecta 63/63 (engenheiro, numero-mascara, numero-input, mapa-alfinetes, galeria-detalhes, medicao-solicitacao); SF 51/51 (engenheiro, perfil-engenheiro.db, numero-*) + 87/88 obras-mapa (1 falha pré-existente medicao-drive). (b) manuais: nenhum. (c) produção: pendente.

- 27/10 09:30: 07 concluída (Prospecta 10/10 + vizinhas; SF puros 4/4, db 6/6, vizinhos 40/40). Nota: no banco LOCAL do SF, `prisma db push` deixa `estudos_incorporacao_versoes.id` sem DEFAULT (trigger de versão falha); corrigido localmente com `SET DEFAULT gen_random_uuid()` — não afeta produção (migrações SQL).
- 27/10 ~10:00: 06/08/10/11 concluídas (Prospecta vitest completo 1191/1191; SF 1017/1027 — 10 falhas fora do escopo: pré-existentes + bancos-sync/bpo-extrato do Codex). Iniciados agentes orcamento-viabilidade (12,20) e unidades-lancamento (15,16,18,19). pci-gerador (03) em andamento.
