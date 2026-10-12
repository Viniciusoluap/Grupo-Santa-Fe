# HANDOFF — 32 implementações auditadas (Prospecta ↔ Grupo Santa Fé)

> Documento de continuidade. **Idêntico nos dois repositórios** (`Prospecta/HANDOFF-32-IMPLEMENTACOES.md`
> e `Grupo-Santa-Fe/HANDOFF-32-IMPLEMENTACOES.md`). Qualquer agente (Claude, Codex, humano) que
> retome o trabalho deve ler este arquivo inteiro primeiro, depois a matriz em
> `Prospecta/docs/stories/epics/epic-020-32-implementacoes-paridade/MATRIZ-PARIDADE.md` (cópia em `Grupo-Santa-Fe/docs/epic-020/MATRIZ-PARIDADE.md`).
> **Ao terminar cada lote, atualize a seção "Estado atual" deste arquivo nos dois repositórios.**

Última atualização: 12/10/2026 — fim do Lote 1 (PRs abertas, aguardando preview/merge/deploy).

---

## 1. Regras que não podem ser quebradas

1. **Regra máxima do dono (12/10/2026): ao término de cada lote, fazer o MERGE e o DEPLOY.** O lote
   só está "publicado" quando o deploy de produção da Vercel estiver `READY` no commit do merge,
   nos dois projetos.
2. **Paridade absoluta** (CLAUDE.md dos dois repos): toda regra de negócio tem que existir e se
   comportar igual nos dois sistemas. Exceções permitidas apenas: landing/layout público,
   ecossistema de sorteios da Prospecta, diferenças de stack. Fórmulas financeiras **idênticas**.
3. **Isolamento entre empresas:** paridade ≠ compartilhar dados. Nunca copiar clientes, leads,
   obras, corretores, credenciais ou bancos de uma empresa para a outra.
4. **Identidade visual:** marca Prospecta só na Prospecta; marca Grupo Santa Fé só no Santa Fé
   (ex.: "Contrato Prospecta" ↔ "Contrato Grupo Santa Fé"; "Lucro Prospecta" ↔ "Lucro Grupo Santa Fé").
5. **Decisão anterior do Santa Fé (lote `codex/santa-fe-limpeza-crm-20261011`, PR #158):** módulos
   Dashboard, Central de Gestão, Relatórios, Feeds XML, Agregador, Contabilidade e Contratos
   independente foram REMOVIDOS; serviços (Financiamento/Obra/Projeto/Regularização/Avaliação)
   nascem só pelo CRM com estado inicial `aguardando_configuracao`. **Não reintroduzir nada disso.**
   Se algum item das 32 conflitar, registrar o conflito e pedir orientação ao dono antes.
6. **Nunca mexer em branches `codex/*` diretamente.**
7. **Automação primeiro:** migrations aplicadas por código/MCP, nunca pedir SQL manual ao dono.
   Relatar com honestidade: (a) testado automaticamente, (b) testado manualmente, (c) depende de
   validação em produção.
8. Fórmulas da seção 4 **não podem ser alteradas por interpretação**. Contradição técnica/legal →
   documentar e pedir decisão.
9. Não apagar histórico financeiro; cancelamento/estorno preserva o movimento original.
10. Commits e PRs com rodapé de atribuição (ver PRs anteriores). PR sempre em rascunho, depois
    merge squash após validação.

## 2. Ambientes (descobertos no Lote 0)

| | Prospecta | Grupo Santa Fé |
|---|---|---|
| Repo | `Viniciusoluap/Prospecta` | `Viniciusoluap/Grupo-Santa-Fe` (app em `web/`) |
| Stack | Vite + Express + tRPC + Drizzle | Next.js 16 + Prisma 7 (ler `web/node_modules/next/dist/docs/` antes de usar APIs do Next) |
| Banco produção | Neon, projeto `SiteProspecta` (id `plain-cake-26372935`) | Supabase, projeto `grupo-santa-fe` (id `giulchozonhzyopmgmkv`) |
| Vercel | projeto `site-prospecta` (`prj_hVT5OCL8S5GbJ5L0GArH9aDxbFHR`) | projeto `grupo-santa-f` (`prj_W8c9sow2dxFO5GDfqABwlKWodI1v`) — time `team_0ACtTLoM4VLMrijmyLUPafHy` |
| Deploy | automático ao mesclar no `main` | automático ao mesclar no `main` |
| Migrations | `drizzle/NNNN_*.sql` + entrada em `drizzle/meta/_journal.json`; **aplicar em produção via SQL (MCP Neon) ANTES do merge** — o deploy não roda migrations | `web/prisma/migrations/<timestamp>_*/migration.sql`; o histórico do Prisma está marcado como SQLite, então `prisma migrate deploy` NÃO funciona: **aplicar em produção via SQL (MCP Supabase) ANTES do merge** |
| Testes | `npx vitest run` · `npx tsc --noEmit` · `npm run build` | em `web/`: `npx prisma generate` · `npx vitest run` · `npx tsc --noEmit` (apague `.next/` se der erro de rotas antigas) · `npx eslint <arquivos>` · `npm run build` (precisa de banco: usar Postgres local, ver §6) |
| Neon "grupo-santa-fe-preview" | — | projeto Neon vazio, NÃO é produção |

Branch de trabalho usada nesta sessão nos dois repos: `claude/sync-mirrored-repos-bsqnz3`.
Para lotes seguintes, partir sempre de `origin/main` atualizado.

## 3. As 32 implementações (especificação resumida, mas completa nos pontos de aceite)

**Lotes:** 0 Diagnóstico · 1 CRM/Obras (05,06,07,08,09,15,16,24) · 2 Motor financeiro/BPO
(10,11,12,13,14,17,18,19,20,21,22,23,25,26) · 3 Comissões (32) · 4 Progresso/Fotos/Relatório
(27,28,29) · 5 Incorporação (01,02,03,04) · 6 Regularização (30,31) · 7 Auditoria final.

**Protocolo por lote:** investigar → comparar → planejar → implementar (nos 2) → testar → auditar →
registrar (matriz + este arquivo) → merge + deploy → prosseguir.

**Barreiras antes de merge/deploy:** build ok; testes financeiros, de paridade, de API e de
permissões ok; migrações verificadas; backup quando muda dado; auditoria de duplicidade financeira;
registros legados verificados; repos corretos; sem falha crítica; estratégia de rollback;
autorização de publicação (já dada pela regra máxima).

### Incorporação
- **01** Situações dos estudos: só Em estudo, Inviável, Em andamento, Concluído (remover
  "Rascunho"); migração segura dos estudos antigos; formulário/filtro/lista/API/persistência.
- **02** Página de Incorporação com navegação em grid no topo (Dados Gerais, Terreno, Topografia,
  Inteligência de Mercado, Estudo de Massa Generativa, Orçamento Parametrizado, Negociação do
  Terreno, Business/Investidores, Projeto Aprovado, etc.); mostra só o módulo escolhido; sem
  recarregar; preserva estado; avisa alterações não salvas; responsivo; nada decorativo.
- **03** Documentos opcionais via Google Drive por item de checklist (vincular, abrir, ver,
  substituir, desvincular); preservar status/data/observações; não publicar arquivos privados;
  salvar sem anexo continua funcionando; cada empresa usa o próprio Drive.
- **04** Campo "Tipo de Incorporação": Desmembramento Simples, Residencial, Vertical, Loteamento.
  Residencial/Vertical/Loteamento mantêm fluxos atuais. Desmembramento Simples com 17 módulos
  operacionais: Dados Gerais, Due Diligence, Terreno, Topografia, Inteligência de Mercado, Estudo de
  Massa Generativa, Orçamento Parametrizado, Negociação do Terreno, Business/Investidores, Projeto
  Aprovado, Unidades à Venda, Planejamento do Lançamento, Contratação de Fornecedores, Material
  Publicitário, Atendimento aos Clientes, Relatório Executivo, Viabilidade Econômica.
  **04.1 Due Diligence:** etapas ilimitadas, nomes editáveis, excluir, reordenar, documentos
  exigidos, procedimentos, tarefas, observações, links de arquivos, progresso, visão mapa
  mental/fluxograma. **04.2 Unidades à Venda:** total de unidades, nomenclatura (Lote/Casa/
  Terreno/…), identificação individual, compradores, reservas, vendas, contagens
  vendidas/disponíveis/reservadas; impedir venda simultânea da mesma unidade.

### CRM e Obras
- **05** Temperatura "🤝 Negócio fechado" além de Frio/Morno/Quente; emoji na identificação do lead;
  criação/edição/lista/filtro; independente da etapa. ✅ Lote 1.
- **06** Seletor de classificação da Obra só com Planejamento, Aprovação, Contrato Prospecta/Grupo
  Santa Fé, Laudo CEF, Conformidade CEF; remover Em Andamento, Pausada, Concluída, Cancelada,
  Atendimento, Proposta, Documentos, Vistoria CEF, Assinaturas Fichas; sem apagar histórico. ✅ Lote 1.
- **07** Corrigir `invalid_value` ao salvar Obras (causa raiz). ✅ Lote 1.
- **08** Nome do Cliente em Valores da Operação vem do lead, somente leitura; excluir "Título CF
  (CEF)". ✅ Lote 1.
- **09** Tipo de Projeto vem do CRM, somente leitura, sem caminho de edição na API. ✅ Lote 1.
- **15** Remover botões do topo "Ver Medições"/"Salvar Alterações"; único "Salvar" inferior direito
  persiste tudo; medições preservadas. ✅ Lote 1.
- **16** "MCMV/CEF" → "Valores da Operação". ✅ Prospecta; Santa Fé nasce com o nome no Lote 2.
- **24** Nome do Corretor vem do lead, somente leitura, oculto sem corretor; remover "Corretor
  Pago?" (pagamento vem do financeiro). ✅ Lote 1.

### Motor financeiro (Lote 2) — Valores da Operação e Custos
- **10** Moeda R$ 1.000.000,00 em todos os valores monetários (não em %, quantidades, áreas, prazos,
  datas); sem alterar valores armazenados.
- **11** Entrada Paga: somente leitura; botão "Adicionar Entrada" (manual: valor/data/observação, ou
  vincular recebimento do BPO); vários recebimentos parciais; histórico; reage a
  cancelamento/estorno. Aceite: 2.000 + 4.000 = **R$ 6.000,00**; transação duplicada não altera.
- **12** Entrada Total = VGV − Financiamento CEF − FGTS − Subsídio (somente leitura). Aceite: 170.000 −
  140.000 − 0 − 8.234 = **R$ 21.766,00**.
- **13** Saldo da Entrada = Entrada Total − Entrada Paga. Aceite: **R$ 15.766,00**; negativo é mostrado
  e sinalizado (pagamento a maior).
- **14** Valor Recebido CEF = soma dos recebimentos CEF confirmados (manual ou BPO, histórico, edição
  auditada, desvincular sem apagar o BPO); não misturar com entrada.
- **17** Aba Custos na ordem: Orçamento Previsto → Empreiteiro → Custo do Terreno → Comissão →
  Corretor vinculado → Adicionar Pagamento → Histórico de Pagamentos → Total Gasto na Obra → Saldo
  Restante. 17.1 "Valor Total do Contrato" vira "Orçamento Previsto" (editável). 17.2 "Tipo de
  Contrato" vira seleção de Empreiteiro cadastrado + nova categoria de usuário **Empreiteiro**
  (acesso próprio, permissões no backend). 17.3 Custo do Terreno preservado (previsto, não pago).
  17.4 Comissão ligada ao corretor do CRM e ao módulo Comissões. 17.5 Pagamentos (descrição, valor,
  data, observação, manual/BPO). 17.6 **Total Gasto = soma dos pagamentos efetivamente realizados**.
  17.7 **Saldo Restante = VGV − Total Gasto**. 17.8 Remover campos Pagamento Empreiteiro, Custo de
  Material, Custos Extras, Manutenção, Seguro.
- **18** Em Valores da Operação: Custo Construção = Orçamento Previsto; Gasto Obra Realizado = Total
  Gasto (ambos somente leitura, sem fonte paralela).
- **19** Valor a Receber do Banco = Financiamento + Subsídio + FGTS − Terreno − Recebido CEF. Aceite:
  140.000 + 8.234 + 0 − 10.000 − 102.817,42 = **R$ 35.416,58**.
- **20** Lucro Estimado = VGV − Terreno − Comissão − Orçamento Previsto (nunca usar Total Gasto).
  Aceite: 170.000 − 10.000 − 5.000 − 110.000 = **R$ 45.000,00**.
- **21** Investidor vinculado + % (editável) → Lucro Investidor = Lucro Estimado × % / 100. Aceite:
  30% → **R$ 13.500,00**. Vários investidores individualizados; soma ≤ 100%.
- **22** Empreiteiro vinculado + % → Base = Lucro Estimado − Lucro Investidor; Lucro Empreiteiro =
  Base × % / 100. Aceite: base **R$ 31.500,00**, 20% → **R$ 6.300,00**. Empreiteiro vê o próprio
  lucro no acesso dele, sem editar percentuais.
- **23** Lucro da Empresa ("Lucro Prospecta" / "Lucro Grupo Santa Fé") = Estimado − Investidor −
  Empreiteiro = **R$ 25.200,00**. Os 4 indicadores são distintos.
- **25** Pró-Soluto = Saldo da Entrada; Taxa Mensal (%) e Qtde Parcelas editáveis; **PMT = PV × i /
  [1 − (1+i)^(−n)]** (HP 12C, modo END). Aceite validado pelo dono: PV 12.000, 1,50%, 20 →
  698,9488304935… → **R$ 698,95**. Taxa zero → PV/n; n=0 não calcula; prazo negativo rejeita; dado
  faltante → "cálculo indisponível"; Pró-Soluto negativo → sinaliza pagamento a maior, sem parcela
  negativa; zero → sem dívida fictícia; parcelamento formalizado preserva condições.
- **26** Dias de Obra = Término Previsto − Início (dias corridos, sem bug de fuso). Aceite:
  01/10/2026 → 31/12/2026 = **91 dias**. PLS Real (%) = Recebido CEF × 100 / T, com T =
  Financiamento + Subsídio + FGTS − Terreno. Aceite: T = 138.234,00 → 74,3792554653…% → **74,38%**;
  T ≤ 0 invalida.

### Comissões (Lote 3)
- **32** Comissões nascem automaticamente das obras com corretor no CRM: **Comissão = VGV × % / 100**
  (aceite 230.000 × 5% = **R$ 11.500,00**). Sincronizar novas, reconciliar antigas, sem duplicar,
  não inventar percentual, sinalizar dados incompletos, pagamentos vindos do BPO.
  **Prospecta: investigar o corretor "Chaleilson"** (cadastro, leads, obras, percentuais, VGV,
  comissões existentes, pagamentos, problemas de integração, duplicidades) e **relatar
  explicitamente as obras e dados inconsistentes**. Santa Fé: mesma lógica com corretores próprios;
  nunca levar dados da Prospecta.

### Progresso, fotos e relatório (Lote 4)
- **27** Tabela de Progresso com 20 serviços e incidências (soma 100,00%): Serviços Preliminares e
  Gerais 3,10 · Infraestrutura 7,00 · Supra estrutura 12,50 · Paredes e Painéis 8,00 · Esquadrias
  4,50 · Vidros e Plásticos 0,00 · Coberturas 5,00 · Impermeabilizações 9,00 · Revestimentos Internos
  6,90 · Forros 1,00 · Revestimentos Externos 4,00 · Pintura 3,70 · Pisos 8,50 · Acabamentos 1,11 ·
  Inst. Elétricas e Telefônicas 3,80 · Instalações Hidráulicas 3,70 · Inst. Esgoto e Águas Pluviais
  3,70 · Louças e Metais 4,20 · Complementos 0,30 · Outros Serviços 9,99. Colunas: Incidência (%)
  editável, Execução do Item (%) 0–100 editável, Execução na Obra = Incidência × Execução / 100.
  Progresso Geral = soma (somente leitura; gráfico do topo usa esse valor). Validações: incidência
  ≥ 0, soma ≤ 100 (avisar se < 100). Aceite: Preliminares 100, Infra 100, Supra 50,
  Impermeabilizações 50, Elétrica 20, Hidráulica 20, Esgoto 50, Outros 40, resto 0 → 28,196% →
  **28,20%**.
- **28** Corrigir upload de fotos que fica "Enviando" para sempre (causa raiz; desktop e iPad/
  iPhone Safari); várias fotos, progresso, legenda, abrir, excluir, inserir no relatório.
- **29** Relatório Executivo da Obra em PDF (diferente do relatório de Incorporação já feito):
  logo da empresa correta, capa, sumário, todos os campos de Informações, **todos** de Valores da
  Operação (inclusive históricos de entrada e CEF, lucros e %, pró-soluto, dias, PLS), **todos** de
  Custos (com histórico de pagamentos e origem manual/BPO), Progresso (20 serviços), fotos com
  legenda/data, gráficos (progresso, PLS, orçamento × gasto, recebimentos, saldos, lucros),
  paginação, cabeçalho/rodapé, moeda BR. Teste automatizado que falha se um campo obrigatório não
  estiver no relatório.

### Regularização (Lote 6)
- **30** "Etapa do Processo" vira "Status do Processo" (Em análise, Em andamento, Concluído) + seção
  "Etapas do Processo" livre por processo (criar, nomear, editar, excluir, reordenar, progresso,
  observações). Status geral e etapas independentes.
- **31** Remover "Valor Pago" isolado e "Documentos" antigo. Tabela financeira por processo com 17
  itens iniciais editáveis/extensíveis: Projetos, PCI, Impressões, Água, Despachante, Cert. Inteiro
  Teor, ART, Alvará, Vistoria CEF, Tx Ass CEF, Seguro CEF, ITBI, Registro Cartório, Encargos de Obra
  (grupo **Durante a Obra**, 1–14), Habite-se, CND e CNO, Averbação (grupo **Casa Pronta**, 15–17).
  Colunas: Previsto (editável), Recebido (soma), Saldo = Previsto − Recebido. Recebimentos manuais
  ou BPO, parciais, histórico. Totais por grupo e geral. Sem duplicidade de BPO; preservar dados
  financeiros antigos.

## 4. Matriz definitiva de fórmulas (igual nos dois sistemas)

| Indicador | Fórmula |
|---|---|
| Entrada Total | VGV − Financiamento − FGTS − Subsídio |
| Entrada Paga | Soma das entradas confirmadas |
| Saldo da Entrada | Entrada Total − Entrada Paga |
| Pró-Soluto | Saldo da Entrada |
| Recebido CEF | Soma dos recebimentos CEF confirmados |
| Receber do Banco | Financiamento + Subsídio + FGTS − Terreno − Recebido CEF |
| Total Gasto | Soma dos pagamentos efetivados |
| Saldo Restante | VGV − Total Gasto |
| Lucro Estimado | VGV − Terreno − Comissão − Orçamento Previsto |
| Lucro Investidor | Lucro Estimado × % Investidor / 100 |
| Base Empreiteiro | Lucro Estimado − Lucro Investidor |
| Lucro Empreiteiro | Base Empreiteiro × % Empreiteiro / 100 |
| Lucro Empresa | Lucro Estimado − Lucro Investidor − Lucro Empreiteiro |
| Base PLS | Financiamento + Subsídio + FGTS − Terreno |
| PLS Real | Recebido CEF × 100 / Base PLS |
| Progresso Item | Incidência × Execução / 100 |
| Progresso Geral | Soma das execuções ponderadas |
| Comissão | VGV × % Comissão / 100 |
| Saldo Documento | Previsto − Recebido |
| Dias da Obra | Data Término Prevista − Data Início |

**Engenharia financeira obrigatória:** dinheiro em DECIMAL/NUMERIC ou centavos inteiros (nunca float
como valor definitivo — atenção: o Santa Fé hoje usa `Float` em `Obra`); percentuais com precisão
suficiente (0,50%, 1,375%, 12,3456%); arredondamento **HALF_UP** só no centavo final; fonte única de
cada dado; distinguir zero × não informado × indeterminado × inválido × negativo legítimo; negativos
mostrados e sinalizados, nunca zerados; lançamentos com id, empresa, obra, cliente, natureza,
categoria, valor, data, status, origem manual/BPO, id da transação BPO, usuário, histórico; a mesma
transação BPO não quita duas vezes a mesma obrigação; alocação parcial nunca excede o líquido;
cancelamento/estorno preserva o original e recalcula; vincular BPO não cria transação nova;
desvincular não apaga o movimento do BPO.

**Testes de referência obrigatórios (resultado idêntico nos dois):** A Entrada (21.766,00 / 15.766,00) ·
B CEF (138.234,00 / 35.416,58 / 74,38%) · C Lucros (45.000 / 13.500 / 31.500 / 6.300 / 25.200) ·
D HP 12C (698,95) · E Progresso (28,20%) · F Pagamentos (1.000+2.000+3.000 = 6.000; cancelar o 3º →
3.000; sem duplicidade) · G Comissão (11.500,00) · H Isolamento entre empresas. Mais limites: zero,
negativo legítimo, valores muito grandes, centavos, % decimal, investidor 0% e 100%, incidência < 100
e > 100, parciais, duplicados, estornos, BPO alterado, dado faltante, divisão por zero, campo
calculado alterado via API, arredondamento, operações simultâneas.

## 5. Estado atual (atualizar a cada lote)

| Lote | Estado | Evidência |
|---|---|---|
| 0 Diagnóstico | ✅ Concluído | Matriz EPIC-020; sem PRs abertas nem trabalho concorrente em 12/10 |
| 1 CRM/Obras | 🔶 PRs abertas — aguardando preview Vercel → merge → confirmar deploy `READY` | Prospecta PR #95 · Santa Fé PR #164 · migrations **já aplicadas em produção** (Prospecta `0034`: enums; Santa Fé `20261012130000_lote1_temperatura_lead`: `leads.temperatura`) · testes 584/584 e 456/456 · build ok nos dois |
| 2 Motor financeiro | ⏳ Não iniciado | — |
| 3 Comissões | ⏳ Não iniciado | — |
| 4 Progresso/Fotos/PDF | ⏳ Não iniciado | — |
| 5 Incorporação | ⏳ Não iniciado | — |
| 6 Regularização | ⏳ Não iniciado | — |
| 7 Auditoria final | ⏳ Não iniciado | relatório A–K + matriz de 32 linhas |

### Próximo passo exato
1. Confirmar que os previews da Vercel das PRs #95 (Prospecta) e #164 (Santa Fé) estão `READY`.
2. Tirar as PRs do rascunho, mesclar com **squash** no `main`.
3. Confirmar na Vercel (produção) que o deploy do commit do merge ficou `READY` nos dois projetos.
4. Atualizar a matriz (itens 05–09, 15, 16, 24 → "Publicado") e a seção 5 deste arquivo.
5. Iniciar o Lote 2 (o maior), seguindo §6.

### Achados do diagnóstico que definem o Lote 2
- **Prospecta:** Valores da Operação (VGV, financiamento, FGTS, subsídio, entrada, CEF, lucros,
  pró-soluto, cliente, corretor) é gravado como JSON anexado ao texto de `construction_projects.notes`
  (marcador `__MCMV_META__`), apesar de existirem colunas `decimal(15,2)`. Em produção: 2 de 37
  obras têm o JSON; nenhuma tem as colunas preenchidas. Migrar para colunas/tabelas reais.
- **Prospecta:** campos da aba Custos (`contractorPayment`, `materialCost`, `commissionCost`,
  `extrasCost`, `maintenanceCost`, `insuranceCost`, `balanceAmount`) **nunca foram salvos** (colunas
  inexistentes; o Drizzle descarta). Não há histórico a migrar.
- **Santa Fé:** `Obra` só tem `valorTotal`/`valorPago` (`Float`), sem Valores da Operação, Custos,
  lucros, pró-soluto nem Progresso por incidência — construir do zero, com a seção já nomeada
  "Valores da Operação" (fecha o item 16 no Santa Fé).
- Investigar o BPO de cada sistema (Prospecta tem `bpoLancamentos`/`financialTransactions`; Santa Fé
  teve Contabilidade removida no PR #158 — **verificar o que restou de financeiro/BPO antes de
  projetar recebimentos/pagamentos e registrar conflito se o item exigir algo removido**).
- Novo papel de usuário **Empreiteiro** (17.2/22) nos dois sistemas.

### Inconsistências legadas já registradas (não corrigidas automaticamente)
- Prospecta obra #22: tipo gravado "Vistoria e medição", serviço do CRM `obra_cliente` → a tela
  agora mostra "Obra / reforma". Corrigir no lead se for de fato vistoria.
- Santa Fé: 4 obras com tipo antigo "Obra Nova" — preservado em `obras.tipo`, tipo oficial passa a
  ser o serviço do CRM ("Obra e reforma").

## 6. Como executar um lote (procedimento validado nesta sessão)

1. `git fetch origin main && git checkout -B <branch> origin/main` nos dois repos.
2. Investigar código **e dados reais de produção (somente leitura)** — Neon `plain-cake-26372935`,
   Supabase `giulchozonhzyopmgmkv`.
3. Implementar nos dois, com fonte única das regras (Prospecta: `shared/*.ts`; Santa Fé:
   `web/src/lib/...`) e testes que travam a regra (ver `server/lote1-crm-obras.test.ts` e
   `web/src/lib/__tests__/lote1-crm-obras.test.ts` como modelo; rotas tRPC testadas com
   `appRouter.createCaller` + `vi.spyOn(db, ...)`; actions Next com `vi.mock`).
4. Validar: Prospecta `npx tsc --noEmit && npx vitest run && npm run build`; Santa Fé (em `web/`)
   `npx prisma generate && rm -rf .next && npx tsc --noEmit && npx vitest run && npx eslint <arquivos>`.
   Build do Santa Fé precisa de banco: `pg_ctlcluster 16 main start`, criar banco local, `npx prisma
   db push` com o schema do `main`, aplicar a migration nova com `psql`, conferir
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
   (tem que sair "empty migration"), e `DATABASE_URL=<local> npm run build`.
5. Migrações: só aditivas/idempotentes; aplicar em produção pelo MCP (Neon `run_sql`, Supabase
   `execute_sql`) **antes** do merge; verificar depois com SELECT.
6. Commit, push (sem force), PR em rascunho nos dois, aguardar preview Vercel, mesclar (squash),
   confirmar deploy de produção `READY`, atualizar matriz e este arquivo nos dois repos.
