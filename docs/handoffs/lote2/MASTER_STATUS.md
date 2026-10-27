# MASTER STATUS — Lote 02 — 22 correções (Prospecta + Grupo Santa Fé)

- Branch (ambos os repos): `claude/lote2-22-correcoes-20261027`
- Base: Prospecta `08fdd3d` · Santa Fé `a696389` (origin/main em 27/10/2026)
- Agente: Claude Code (orquestração AIOX). Codex trabalha em paralelo em `codex/aiox-16-correcoes-20261026` — **não tocar** nos arquivos dele (ver EXECUTION_LOG).
- Plano: ver ARCHITECTURE_DECISIONS.md (AD-10 ondas).
- Autorização do dono (27/10): execução completa, merge e deploy.

Estados: `Auditoria` · `Planejado` · `Em andamento` · `Implementado` · `Testado` · `Em produção` · `Bloqueado`

| # | Correção | Auditoria SF (origin/main) | Auditoria Prospecta | Estado | SHA |
|---|----------|---------------------------|---------------------|--------|-----|
| 01 | Remover PLS XLS (manter PLS PDF + PCI XLS) | Existe; remover XLS da UI/rota/e-mail/Drive | Existe (BIFF8 xls+pdf, e-mail pdf+xls) | Planejado | — |
| 02 | Fotos por medição em Detalhes da Obra | Parcial (só Editar Obra agrupa) | Detalhes em grade plana; Editar agrupa | Planejado | — |
| 03 | Gerador de PCI + Sub PCI atual (Integrações) | Parcial (leitor/gravador PLS existem; sem gerador) | Parcial (leitor; sem gerador) | Planejado | — |
| 04 | Perfil Engenheiro + CREA + documentos | Faltante (sem papel engenheiro, sem docs de usuário) | Faltante (sem papel/docs/ZIP) | Planejado | — |
| 05 | Mapa Operacional satélite/ruas + cluster | Parcial (OSM, sem cluster) | OSM, circleMarker, sem cluster | Planejado | — |
| 06 | Incorporação sem KML (checkbox) | Bloqueio por geojson existe | Bloqueio sem KML | Planejado | — |
| 07 | Projeto Aprovado ↔ Projetos | Não integrado; Projeto exige lead | Separados (lead_id já nulo) | Planejado | — |
| 08 | Dados Gerais (nome empreendimento, responsável por ID, remover campos) | Existe; responsável texto livre | Existe; responsável texto | Planejado | — |
| 09 | Redesign Incorporação | Grade de botões, 5 fases | 5 fases/22 etapas | Planejado | — |
| 10 | Estudo de Massa Generativa | Existe com geometria real (turf) | Existe (turf, genético) | Planejado | — |
| 11 | Estudos Salvos | Persistência simples, sem versões/UX | JSON sobrescreve | Planejado | — |
| 12 | Orçamento Parametrizado + import Excel | Parcial (sem import) | Parcial (sem import) | Planejado | — |
| 13 | Negociação responsiva | Existe (cartões) | Existe | Planejado | — |
| 14 | Projeto Aprovado responsivo | Existe (tabela) | Existe | Planejado | — |
| 15 | Unidades do cenário + comprador CRM | Parcial (manual, comprador texto) | Parcial (manual) | Planejado | — |
| 16 | Máscara R$ + editar/excluir unidade | Faltante | Faltante | Planejado | — |
| 17 | Planejamento responsivo | Existe | Existe | Planejado | — |
| 18 | Fornecedores R$ + Orçado vs Contratado | Parcial | Parcial | Planejado | — |
| 19 | Indicadores Fornecedores/Material/Atendimento | Parcial | Parcial | Planejado | — |
| 20 | Viabilidade Terreno ↔ cenário | Parcial (% fixos) | % fixos 10/5/25 | Planejado | — |
| 21 | Componente global de valor BRL | Fragmentado (≥7 padrões) | ≥10 padrões; formatCurrency centavos×reais | Planejado | — |
| 22 | Relatórios da Viabilidade → Relatório Executivo | Duplicado (2 executivos) | Duplicado | Planejado | — |

## Próximo passo exato
Onda 1 em execução (agentes aiox-dev, cada um faz o grupo nos DOIS repos). Progresso por grupo em `agentes/<grupo>.md`.
