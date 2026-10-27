# MASTER STATUS — Lote 02 — 22 correções (Prospecta + Grupo Santa Fé)

- Branch de continuação (ambos): `codex/continuar-lote2-20261027`
- Origem preservada: `claude/lote2-22-correcoes-20261027`
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
| 13 | Negociação responsiva | Existe (cartões) | Existe | Implementada — validar visual/produção | continuação Codex |
| 14 | Projeto Aprovado responsivo | Existe (tabela) | Existe | Implementada — validar visual/produção | continuação Codex |
| 15 | Unidades do cenário + comprador CRM | Parcial (manual, comprador texto) | Parcial (manual) | Em implementação | — |
| 16 | Máscara R$ + editar/excluir unidade | Faltante | Faltante | Em implementação | — |
| 17 | Planejamento responsivo | Existe | Existe | Implementada — validar visual/produção | continuação Codex |
| 18 | Fornecedores R$ + Orçado vs Contratado | Parcial | Parcial | Em implementação | — |
| 19 | Indicadores Fornecedores/Material/Atendimento | Parcial | Parcial | Em implementação | — |
| 20 | Viabilidade Terreno ↔ cenário | Parcial (% fixos) | % fixos 10/5/25 | Em implementação | — |
| 21 | Componente global de valor BRL | Fragmentado (≥7 padrões) | ≥10 padrões; formatCurrency centavos×reais | Testada (auto) — base pronta | 3d0d3fa / 59abb8a |
| 22 | Relatórios da Viabilidade → Relatório Executivo | Duplicado (2 executivos) | Duplicado | Implementada — validar visual/produção | continuação Codex |

## Próximo passo exato (atualizado 27/10 02:15 UTC)
- SHAs na coluna: Prospecta / Santa Fé (checkpoint da Onda 1).
- Agentes interrompidos por limite de uso às ~02:00 (reset 05:40 UTC); trabalho preservado no commit de checkpoint.
- Em execução: incorporacao-core (06/08/10/11 — Prospecta servidor pronto; falta UI Prospecta + porte SF), pci-gerador (03), projetos-aprovacao (07).
- Depois: Onda 2 restante {12,20} {15,16,18,19}; Onda 3 {09,13,14,17} → {22}; build, PRs, migrações prod (Prospecta 0082–0086 via Neon; SF 20261027* via Supabase), merge, deploy.
- Testes (a) automáticos: Prospecta 63/63 (engenheiro, numero-mascara, numero-input, mapa-alfinetes, galeria-detalhes, medicao-solicitacao); SF 51/51 (engenheiro, perfil-engenheiro.db, numero-*) + 87/88 obras-mapa (1 falha pré-existente medicao-drive). (b) manuais: nenhum. (c) produção: pendente.

- 27/10 09:30: 07 concluída (Prospecta 10/10 + vizinhas; SF puros 4/4, db 6/6, vizinhos 40/40). Nota: no banco LOCAL do SF, `prisma db push` deixa `estudos_incorporacao_versoes.id` sem DEFAULT (trigger de versão falha); corrigido localmente com `SET DEFAULT gen_random_uuid()` — não afeta produção (migrações SQL).
- 27/10 ~10:00: 06/08/10/11 concluídas (Prospecta vitest completo 1191/1191; SF 1017/1027 — 10 falhas fora do escopo: pré-existentes + bancos-sync/bpo-extrato do Codex). Iniciados agentes orcamento-viabilidade (12,20) e unidades-lancamento (15,16,18,19). pci-gerador (03) em andamento.

## Retomada Codex — 27/10/2026
- Pedido atual: continuar o trabalho do Claude, reaproveitando os commits e mantendo handoffs e pushes frequentes. Execução autorizada.
- Base recuperada neste repositório: `15e6dd6`. Nenhum arquivo local pendente foi descartado.
- Onda 2 marcada em andamento no status não significa código concluído: auditar cada implementação. PCI SF contém backend, rotas e UI WIP; falta validar/testar.
- (a) Baseline: checagem TypeScript em andamento nos dois; (b) navegador: não executado; (c) produção: nenhuma migração aplicada nesta retomada.
- Próximo passo: validar PCI espelhada e completar testes SF, depois fornecedores/material, unidades, orçamento/viabilidade e responsividade/relatórios. Conciliar origin/main antes de merge (o lote anterior avançou).

### Checkpoint — fornecedores e publicidade
- Correções 18, 19.1 e 19.2 implementadas: valores orçados separados, total orçado em todos os status, total contratado apenas status Contratado conforme prompt, valor orçado por peça. Valores antigos preservados por fallback; campos monetários usam o componente numérico existente.
- Arquivos: bibliotecas fornecedores-lancamento/material-publicitario e suas abas e testes. Nenhuma migração necessária (JSON existente).
- (a) testes: 10/10 em cada repositório; PCI 15/15 Prospecta e 11/11 SF. Typecheck detectou dependência leaflet.markercluster ausente neste ambiente recuperado; instalar dependência já declarada antes de repetir. (b) sem teste visual; (c) sem deploy/migrações.
- 19.3 (Atendimento CRM/unidades) continua pendente; 18 ainda precisa validar integração com Viabilidade. PCI SF ainda precisa testes de persistência/permissões; geração pura validada.
- Push Git por HTTPS sem credencial; checkpoints são publicados pela integração GitHub (API Git Trees/Commits/Refs, sem force). Branch remota de continuação já criada e primeiro checkpoint confirmado.

### Checkpoint — responsividade e relatórios
- 13: Negociação empilha campos no mobile; tablet em duas colunas e desktop em quatro, sem mínimos intrínsecos invadindo células.
- 14/17: Projeto Aprovado e Planejamento usam cartões com campos identificados em telas menores e tabela no desktop amplo; datas e responsáveis com largura limitada. Sem mudar persistência/sincronização da 07.
- 22: removidos os três botões da Viabilidade; seção Relatórios da Viabilidade e Negociação abaixo do Executivo Completo, reutilizando os geradores e o motor atuais. Base é a viabilidade SALVA (instrução na tela); gerador específico do terreneiro mantido intacto.
- (a) 45/45 testes relacionados em cada repositório; TypeScript sem erros nos dois após restaurar a dependência leaflet.markercluster já declarada. (b) sem teste visual/navegador. (c) sem produção/deploy/migrações.
- Próximo passo vigente: concluir unidades 15/16/19.3, orçamento 12 e cenário/viabilidade 20; depois redesign 09 e auditoria ampla, integração com origin/main, migrações e deploy. Gerador PCI SF ainda exige persistência/permissões. Nenhum agente Claude permanece rodando nesta sessão.

### Checkpoint — orçamento e viabilidade (12/20)
- 12 implementada em validação: métodos construção/infraestrutura/Excel, quantidades iniciais reais do cenário para lotes, escolha de aba/cabeçalho/mapeamento, prévia e confirmação, edição/exclusão dos itens, original em base64 preservado no JSON e download. Import até 2 MB; fórmulas usam cache salvo no Excel (sem executar macros), totais/subtotais explícitos excluídos do parser. Apenas o método ativo compõe o orçamento.
- 20 implementada: cenário fornece bruta/institucional/verde/viário/APP e demais restrições sem subtração dupla. Modo automático acompanha cenário/mix; editar áreas ou mix muda para manual. Viabilidades legadas salvas permanecem manuais. Custo pode acompanhar orçamento salvo ou manter ajuste manual; relatórios reconstituem a mesma base.
- Arquivos: orcamento-parametrizado, novo orcamento-importacao (biblioteca + UI), premissas-loteamento, viabilidade-tab; novos testes de importação/cenário.
- (a) 45/45 testes de orçamento/cenário/relatório nos dois; typecheck sem erros. (b) upload/download em navegador e teste visual ainda pendentes. (c) sem produção.
- Pontos para auditoria final: validar importação de arquivo real (linhas totalizadoras com nomes atípicos devem ser removidas na conferência), revisar custos adicionais da Viabilidade contra itens importados para não somar a mesma despesa duas vezes; vínculo fornecedores ↔ Viabilidade ainda pendente.
- Próximo passo: unidades 15/16/19.3 e redesign09, persistência/permissões PCI SF, regressão ampla e integração/deploy.

### Checkpoint WIP — unidades 15/16 e atendimento 19.3
- Em implementação, NÃO pronto para merge: migrações aditivas 0085 / 20261027130000 (origem/cenário, cliente CRM, exclusão lógica); geração idempotente com eventos após salvar/selecionar cenário; UI de inventário agora nos demais tipos também; edição com controle de versão, reserva/venda, tombstone e exclusão bloqueada para histórico comercial.
- Atendimento seleciona CRM ou avulso e unidades reais com status/comprador; valida referências no servidor e só salva JSON de atendimentos. Não modifica status comercial.
- Preservado código/histórico do lançamento legado; inventário exige conciliar vendas antigas antes de operações. CRM só para quem também tem permissão CRM.
- Ainda pendente nesta frente: testes SQL de idempotência/tombstone/concorrência e ações SF; revisão de bloqueios comerciais; preço negociado do CRM não tem campo próprio equivalente nos dois bancos (não usar valor aprovado/simulado como preço de venda). Nome e vínculo CRM estão implementados; preço continua editável.
- Próximo passo imediato: terminar testes desta frente, revisar transações e migrações; não aplicar em produção antes disso. Depois redesign09, regressão e integração com main.

### Retomada após renovação do ambiente — 27/10
- Checkpoints GitHub recuperados: Prospecta 9cea25f / Santa Fé b413c80; nenhuma branch anterior sobrescrita.
- Recuperado o ajuste do controle de concorrência das unidades: revisão inteira incrementada por trigger (independente de timezone), em vez de comparar datas; testes de persistência já haviam identificado e isolado o caso.
- Recuperados também: bloqueio de edição com vendas legadas pendentes, restauração de orçamento importado com lista construída vazia e comparação byte a byte de PCI de 8 MB via Buffer.compare (mesma exigência, sem estouro de memória do deep-equal).
- Última rodada anterior: 158 suítes Prospecta passaram; um worker no teste PCI de 8 MB estourou heap, caso isolado passou 4/4 após Buffer.compare. SF: 125 passaram, 21 ignoradas por ausência de TEST_DATABASE_URL; mesmo caso de 8 MB passou isolado. Os resultados finais precisam ser novamente registrados por comando/commit nesta retomada.
- Neon: nova branch de teste recusada por limite de branches. Branch de testes existente teste-migrations-0024-0026 (br-cold-feather-an7ecnay) consultada, ainda sem unidades; nenhuma migração de produção aplicada.
- Próximo passo: restaurar/validar testes SQL e acabamento visual, integrar origin/main, publicar checkpoints, testar migrações na branch existente sem reset/descarte, então produção/deploy.
