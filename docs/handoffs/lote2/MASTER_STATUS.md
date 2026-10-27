# MASTER STATUS — Lote 02 — 22 correções (Prospecta + Grupo Santa Fé)

- Branch (ambos os repos): `claude/lote2-22-correcoes-20261027`
- Base: Prospecta `08fdd3d` · Santa Fé `a696389` (origin/main em 27/10/2026)
- Agente: Claude Code (orquestração AIOX). Codex trabalha em paralelo em `codex/aiox-16-correcoes-20261026` — **não tocar** nos arquivos dele (ver EXECUTION_LOG).
- Autorização do dono (27/10): execução completa, merge e deploy.

Estados: `Auditoria` · `Planejado` · `Em andamento` · `Implementado` · `Testado` · `Em produção` · `Bloqueado`

| # | Correção | Auditoria SF (origin/main) | Auditoria Prospecta | Estado | SHA |
|---|----------|---------------------------|---------------------|--------|-----|
| 01 | Remover PLS XLS (manter PLS PDF + PCI XLS) | Existe; remover XLS da UI/rota/e-mail/Drive | pendente | Auditoria | — |
| 02 | Fotos por medição em Detalhes da Obra | Parcial (só Editar Obra agrupa) | pendente | Auditoria | — |
| 03 | Gerador de PCI + Sub PCI atual (Integrações) | Parcial (leitor/gravador PLS existem; sem gerador) | pendente | Auditoria | — |
| 04 | Perfil Engenheiro + CREA + documentos | Faltante (sem papel engenheiro, sem docs de usuário) | pendente | Auditoria | — |
| 05 | Mapa Operacional satélite/ruas + cluster | Parcial (OSM, sem cluster) | pendente | Auditoria | — |
| 06 | Incorporação sem KML (checkbox) | Bloqueio por geojson existe | pendente | Auditoria | — |
| 07 | Projeto Aprovado ↔ Projetos | Não integrado; Projeto exige lead | pendente | Auditoria | — |
| 08 | Dados Gerais (nome empreendimento, responsável por ID, remover campos) | Existe; responsável texto livre | pendente | Auditoria | — |
| 09 | Redesign Incorporação | Grade de botões, 5 fases | pendente | Auditoria | — |
| 10 | Estudo de Massa Generativa | Existe com geometria real (turf) | pendente | Auditoria | — |
| 11 | Estudos Salvos | Persistência simples, sem versões/UX | pendente | Auditoria | — |
| 12 | Orçamento Parametrizado + import Excel | Parcial (sem import) | pendente | Auditoria | — |
| 13 | Negociação responsiva | Existe (cartões) | pendente | Auditoria | — |
| 14 | Projeto Aprovado responsivo | Existe (tabela) | pendente | Auditoria | — |
| 15 | Unidades do cenário + comprador CRM | Parcial (manual, comprador texto) | pendente | Auditoria | — |
| 16 | Máscara R$ + editar/excluir unidade | Faltante | pendente | Auditoria | — |
| 17 | Planejamento responsivo | Existe | pendente | Auditoria | — |
| 18 | Fornecedores R$ + Orçado vs Contratado | Parcial | pendente | Auditoria | — |
| 19 | Indicadores Fornecedores/Material/Atendimento | Parcial | pendente | Auditoria | — |
| 20 | Viabilidade Terreno ↔ cenário | Parcial (% fixos) | pendente | Auditoria | — |
| 21 | Componente global de valor BRL | Fragmentado (≥7 padrões) | pendente | Auditoria | — |
| 22 | Relatórios da Viabilidade → Relatório Executivo | Duplicado (2 executivos) | pendente | Auditoria | — |

## Próximo passo exato
1. Receber auditoria do Prospecta e preencher a coluna.
2. Fase 2 (ARCHITECTURE_DECISIONS.md) → Fase 3 fundações (21, 06, 04) em Prospecta, depois porte SF.
