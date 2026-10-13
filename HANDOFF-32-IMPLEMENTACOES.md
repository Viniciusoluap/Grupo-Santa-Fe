# HANDOFF — 32 implementações auditadas (Prospecta ↔ Grupo Santa Fé)

> Documento de continuidade. **Idêntico nos dois repositórios** (`Prospecta/HANDOFF-32-IMPLEMENTACOES.md`
> e `Grupo-Santa-Fe/HANDOFF-32-IMPLEMENTACOES.md`). Qualquer agente (Claude, Codex, humano) que
> retome o trabalho deve ler este arquivo inteiro primeiro, depois a matriz em
> `Prospecta/docs/stories/epics/epic-020-32-implementacoes-paridade/MATRIZ-PARIDADE.md` (cópia em `Grupo-Santa-Fe/docs/epic-020/MATRIZ-PARIDADE.md`).
> **Ao terminar cada lote, atualize a seção "Estado atual" deste arquivo nos dois repositórios.**

Última atualização: 13/10/2026 — Lotes 0–6 publicados. Falta o Lote 7 (auditoria final). Inventário de feito × pendente em §7.

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
| 1 CRM/Obras | ✅ Publicado (12/10/2026) | Prospecta PR #95 → `b29b1d8`, deploy produção `dpl_8qH69ArX1GWKj1EvPw7Ducr9NB4D` READY · Santa Fé PR #164 → `6f9a98f`, deploy produção `dpl_CdJLxNtgoAp8bQHuT3Kbkk57QKYy` READY (o deploy automático falhou com `git_info_fail` da Vercel — erro de infraestrutura antes do build; resolvido com redeploy) · migrations aplicadas em produção antes do merge · testes 584/584 e 456/456 · **pendente: validação manual em navegador** (o ambiente do agente não acessa os domínios) |
| 2 Motor financeiro | ✅ Publicado (12/10/2026) | Prospecta PR #97 → `c348177`, deploy produção `dpl_3coJmPq2bfYWVsiw2MZ268e1ZZuZ` READY · Santa Fé PR #166 → `8effca9`, deploy produção `dpl_2RKZUD1a9vGrBxiMc5mFHjZHMjhj` READY · Motor único `shared/financeiro/obra.ts` (Prospecta) ≡ `web/src/lib/financeiro/obra.ts` (Santa Fé), centavos + HALF_UP, testes A–F · migrations aplicadas em produção em 12/10: Prospecta `0035_lote2_motor_financeiro` (Neon) e Santa Fé `20261012140000_lote2_motor_financeiro` (Supabase; triggers aplicados via `apply_migration` porque `execute_sql` trava com `$$`) · garantias verificadas em produção com rollback (DELETE bloqueado, histórico gravado) · Prospecta obra 35 migrada: VGV 170.000, entrada 6.000, CEF 102.817,42, gastos 57.795 (movimentos `migracao`) · testes Prospecta 613/613, Santa Fé 492/492 · E2E em navegador no Santa Fé com Postgres local (Teste A: 21.766/15.766; lucro 43.000; empreiteiro 30% = 12.900; empresa 30.100; BPO esgotado sai da lista; empreiteiro só vê as próprias obras) · **Prospecta sem teste em navegador** (o ambiente não alcança o Neon) |
| 3 Comissões | ✅ Publicado (12/10/2026) | Prospecta PR #100 → `8156616`, deploy `dpl_8Wt96UfR1PTpj7SbwWk3Y5hgDzoQ` READY · Santa Fé PR #169 → `bb099d6`, deploy `dpl_AL6TPm9vDwzKJyfMLJG2CZgBj1Ln` READY · correções da revisão automática (percentual com ponto, comissão sem regra não reaproveita valor, erro no cadastro do corretor, reconciliação na tela) em PR seguinte · Motor `shared/financeiro/comissao.ts` ≡ `web/src/lib/financeiro/comissao.ts` (Teste G 11.500,00 ✅) · migrations em produção em 12/10: Prospecta `0039_lote3_comissoes` (Neon) e Santa Fé `20261012150000_lote3_comissoes` (Supabase, inclui **RLS nas tabelas do Lote 2 que tinham ficado sem**) · testes Prospecta 634/634, Santa Fé 512/512 · E2E navegador Santa Fé (padrão do corretor 5% → 7.900; 3% da obra → 4.740; pagamento 1.000 → parcial, saldo 3.740) · investigação Chaleilson: `docs/stories/epics/epic-020-32-implementacoes-paridade/RELATORIO-LOTE3-COMISSOES.md` (só na Prospecta) · **Prospecta sem teste em navegador** |
| 4 Progresso/Fotos/PDF | ✅ Publicado (12/10/2026): Prospecta PR #104 → `e20642b`, deploy `dpl_HiZEf6YJvXsCFXKwSkrJ2mebUwVJ` READY · Santa Fé PR #173 → `ea0a745`, deploy `dpl_7tSdsEmwXAZG8xoUjZZq8LQiinEx` READY · achados da revisão do Codex (barra de progresso com largura inválida na lista da Prospecta; relatório mostrava 0% em obra com progresso antigo e sem medição; telefone/e-mail do cliente ausentes; legenda longa podia sair da página) corrigidos em PR seguinte | Motor `shared/financeiro/progresso.ts` ≡ `web/src/lib/financeiro/progresso.ts` (20 serviços, BigInt + HALF_UP, **Teste E = 28,20%** ✅); fotos no próprio banco (Prospecta `construction_photo_files`, Santa Fé `arquivos` + `obra_fotos`), servidas por rota autenticada (`/api/obra-foto/:id` · `/api/obras/fotos/:id`) só para admin ou cliente da obra; relatório PDF por `shared/relatorio-obra.ts` ≡ `web/src/lib/obras/relatorio.ts` com teste de completude · migrations: Prospecta `0040_lote4_progresso_fotos` (validada no branch Neon `teste-migrations-0024-0026`), Santa Fé `20261012170000_lote4_progresso_fotos` (com RLS) · testes Prospecta 663/663, Santa Fé 539/539 · E2E navegador Santa Fé: Teste E na tela, persistido, detalhe/lista 28,20%; soma 101% bloqueia; PNG de 16,5 MB comprimido e gravado; HEIC não decodificável → erro claro, sem travar; foto sem sessão → 401; PDF de 10 páginas com capa/sumário/rodapé "Página X de Y", logo do Grupo Santa Fé e nenhuma menção à Prospecta · **Prospecta sem teste em navegador** (Neon inacessível do ambiente) |
| 5 Incorporação | ✅ Publicado (13/10/2026) — trabalho do Codex (PRs rascunho #105/#174) revisado, corrigido e publicado pelo Claude; merge/deploy na linha do PR | Itens 01–04 nos dois: 4 situações (sem "Rascunho"), grade de módulos, anexos privados por item (Drive), Tipo de Incorporação; Desmembramento Simples com os 17 módulos; Due Diligence (etapas/tarefas/documentos/progresso, gravação com controle de versão); inventário de unidades (código único, reserva/venda/liberação, auditoria, conciliação de vendas antigas, gatilho que impede esconder o inventário ou voltar a gravar vendas no JSON). **Correções do Claude:** primeira tecla de cada campo se perdia (marcação de "alterações" na captura do evento); mensagens de erro do Santa Fé apareciam como texto genérico em inglês (Server Actions agora devolvem o erro como dado — `lib/acao-resultado.ts`); unidade duplicada com mensagem clara; migrations Prospecta com `statement-breakpoint` e idempotentes. **Validação:** Postgres real — 20 vendas simultâneas da mesma unidade → 1 aceita; gatilhos; migrations reaplicáveis · E2E Santa Fé (17 módulos, Due Diligence persistida, venda simultânea em 2 abas → 1 venda + mensagem clara, lista sem "Rascunho") · testes Prospecta 672/672, Santa Fé 553/553 · migrations em produção 13/10: Prospecta 0041–0045 (Neon, registradas em `drizzle.__drizzle_migrations`), Santa Fé `lote5_incorporacao` (Supabase, RLS) · **Pendências:** Prospecta sem teste em navegador (driver neon-http); Drive do Santa Fé não configurado (`SANTA_FE_GOOGLE_DRIVE_*` — sem ele o botão Anexar fica oculto); CSS do Leaflet vem do unpkg (D-07) |
| 6 Regularização | ✅ Publicado (13/10/2026) — merge/deploy na linha do PR | Itens 30 e 31 nos dois. Regras únicas em `shared/financeiro/regularizacao.ts` ≡ `web/src/lib/financeiro/regularizacao.ts` (testes idênticos 10/10). **30:** Status do Processo = Em análise / Em andamento / Concluído (status antigo convertido e preservado em `legacy_status`/`statusLegado`; Santa Fé mantém "Pendente de configuração" da fila do CRM e "Cancelado" da exclusão, fora do seletor). Etapas livres por processo (criar, editar, excluir, reordenar, progresso 0–100%, observações) + média das etapas; status e etapas independentes. **31:** "Valor Pago" e "Documentos" antigos saíram da tela e da API (dados preservados no banco; Valor Pago > 0 vira recebimento `migracao` — 0 casos em produção). Tabela financeira com os 17 itens iniciais semeados por gatilho em todo processo (novo ou existente), itens extras, Previsto editável, Recebido = soma dos recebimentos confirmados, Saldo = Previsto − Recebido, totais por grupo e geral. Recebimentos manuais ou do BPO (só receitas recebidas), parciais, histórico automático, cancelar/reativar, nunca apagados; item com recebimento não é excluído. **Sem duplicidade de BPO:** `bpo_valor_alocado()` soma obras + regularizações sob o mesmo lock — 20 vinculações simultâneas (10 obra, 10 regularização) numa receita de R$ 1.000 → exatamente R$ 1.000 alocados. Migrations: Prospecta `0046_lote6_regularizacao`, Santa Fé `20261013100000_lote6_regularizacao` (RLS), ambas reaplicáveis · testes Prospecta 682/682, Santa Fé 563/563 · E2E Santa Fé (status 3 opções, etapas com reordenação/persistência e média 50%, Projetos 1.500 − 750,25 = 749,75, BPO acima do disponível bloqueado, BPO esgotado e despesas fora da lista, cancelar/reativar, totais por grupo e geral, item novo, nenhum erro de página) · **Prospecta sem teste em navegador** (driver neon-http) |
| 7 Auditoria final | ⏳ Não iniciado | relatório A–K + matriz de 32 linhas |

### Próximo passo exato
1. **Lote 7 (auditoria final):** relatório A–K, matriz de 32 linhas, Teste H (isolamento) formal, D-03
   (remover `broker_commissions`), D-06 (jurídico e portal ainda usam o storage externo na Prospecta),
   D-07 (CSS do Leaflet local), V-04 (portal do cliente Santa Fé). Os PRs rascunho do Codex #105/#174
   ficaram superados e podem ser fechados.
2. Responder ao proprietário P-07, D-04, C-03 (texto pronto em §7.7).

### Decisões do Lote 6 (não reabrir)
- Status do Processo e Etapas são independentes: mudar etapas nunca muda o status, e vice-versa.
- Progresso das etapas = média simples dos progressos (HALF_UP, 2 casas); sem etapas → não mostra.
- Os 17 itens são criados por gatilho no banco (`regularizacao_semear_itens`) para qualquer processo,
  venha do CRM, da fila ou de importação. Itens extras ganham ordem depois do último item normal.
- Recebimento da regularização usa apenas receitas do BPO (tipo ≠ despesa) já recebidas. A soma do
  que obras e regularizações alocam numa transação nunca passa do valor dela (`bpo_valor_alocado`).
- "Valor do serviço" (valor contratado) continua no cadastro do processo; a tabela financeira não o
  substitui nem o recalcula.

### Decisões do Lote 4 (não reabrir)
- Progresso Geral nunca é digitado: soma de Incidência × Execução dos 20 serviços (incidências iniciais da
  Implementação 27, editáveis por obra, até 4 casas). Soma > 100% bloqueia salvar; < 100% só avisa.
  Cada medição salva grava histórico. O inteiro antigo (`progress`/`progresso`) segue arredondado para
  telas antigas; as telas mostram o medido com 2 casas (`progressoDaObra`).
- Causa do "Enviando..." eterno (Prospecta): erro dentro do callback do FileReader fora do try/catch +
  storage externo (Forge) nunca configurado — **nenhuma foto jamais foi gravada em produção**. Agora o
  navegador reduz a foto (≤1920 px, JPEG ≤2,5 MB; respeita o limite de 4,5 MB da Vercel; HEIC abre no
  Safari) e o servidor valida a assinatura real do arquivo (JPG/PNG/WEBP ≤3 MB). Envio com tempo-limite.
- Ver fotos: admin ou cliente da obra. Enviar/editar/excluir: só admin. `uploadPhoto`/`deletePhoto`
  antigos da Prospecta removidos (aceitavam URL arbitrária; o delete nunca achava a foto).
- Relatório: conteúdo montado por função pura com teste de completude (falha se faltar campo
  obrigatório); ausente = "Não informado", indicador sem dados = motivo; gráficos só com dados.
  "Engenheiro responsável" aparece só no Santa Fé (campo que só existe lá).
- Outros usos do storage externo na Prospecta (`storagePut`: regularização, jurídico, portal) não foram
  alterados neste lote — registrado como D-06.

### Trabalho paralelo do Codex (não é escopo deste épico)
O Codex trabalha em paralelo em outras frentes (estudos de incorporação, metadados MCMV/CEF). Em 12/10
ele mesclou Prospecta #99 (migrations 0036–0038) e Santa Fé #168. Por isso a migration do Lote 3 da
Prospecta é a **0039**. Antes de cada lote: `git fetch origin main`, checar PRs `codex/*` abertos que
toquem `drizzle/`, `schema`, obras ou comissões, e nunca alterar branches `codex/*`.

### Decisões do Lote 3 (não reabrir)
- Comissão de obra = VGV × % / 100; % = da obra (aba Custos) ou padrão do corretor
  (Prospecta `broker_profiles.default_commission_pct`; Santa Fé tabela `regras_comissao_corretor`,
  separada para não expor Decimal onde o corretor inteiro é carregado). Sem regra → "Dados
  incompletos", sem valor. Nunca presumir percentual.
- A lista "Comissões de obras" é **derivada** (sem tabela de sincronização): impossível duplicar.
- Comissões manuais existentes não são alteradas; divergências são sinalizadas.
- Obra com corretor: a comissão é SEMPRE o cálculo (VGV × %); sem regra fica indisponível (Lucro Estimado pede a comissão) e nunca reaproveita valor antigo. Obra sem corretor: valor manual.
- Percentuais/taxas digitados: ponto é decimal ("2.345" = 2,345%) — `lerPercentualDigitado`, igual nos dois.
- Pagamento de comissão = lançamento de categoria "comissao" no financeiro da obra (manual ou BPO).

### Decisões do Lote 2 (não reabrir)
- Prospecta: `contract_value` = **Orçamento Previsto** (custo da construção); `lot_cost` = terreno.
- Santa Fé: `valorTotal`/`valorPago` antigos ficam **preservados como referência legada**, fora dos
  cálculos (4 de 5 obras têm `valorTotal`; o dono deve dizer se é VGV ou orçamento e preencher na tela).
- Ausente ≠ zero: indicador mostra "Informe: ..." quando falta entrada.
- Movimentos nunca são apagados (trigger), só cancelados com motivo; reativar revalida o saldo do BPO.
- Vínculo com BPO: só lançamento pago; pagamento ↔ despesa; soma alocada ≤ valor (trigger com lock).
- Papel `empreiteiro` nos dois: vê só as próprias obras (`/empreiteiro`), sem edição.
- Lucro Estimado é estimativa da operação (VGV − terreno − comissão − orçamento), não lucro contábil.

**Supabase MCP:** `execute_sql` trava (timeout) com corpo `$$ ... $$`; usar `$fn$` como delimitador ou `apply_migration` para triggers.

**Se um deploy da Vercel falhar com `git_info_fail`** (falha ao ler o commit, antes do build): não é
erro de código. Refazer pela API/MCP da Vercel com `create_deployment` usando `deploymentId` do
último deploy de produção bom + `withLatestCommit: true` + `target: production`.

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
- Prospecta obra 35: o JSON antigo tinha `downPaymentTotal` 13.766, mas VGV − financiamento − FGTS −
  subsídio = 21.766. A fórmula oficial prevalece; o valor antigo não foi gravado.
- Santa Fé: `valorTotal` legado de 4 obras aguardando classificação do dono (VGV × orçamento).
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

## 7. Inventário consolidado — feito × pendente (12/10/2026, após o Lote 3)

> Lista única para retomar depois. Cada pendência tem um código (P-xx) para ser citada.
> Ao resolver uma, marcar `✅` aqui com data e PR.

### 7.1 Feito e publicado (merge + deploy de produção READY nos dois sistemas)

| Lote | Itens | O que entrou |
|---|---|---|
| 0 | — | Diagnóstico, matriz de paridade, este HANDOFF nos dois repositórios |
| 1 | 05, 06, 07, 08, 09, 15, 16*, 24 | Temperatura do lead separada da etapa; status de obra unificado (causa raiz do `invalid_value`); tipo de projeto vindo do CRM; "Contrato Grupo Santa Fé (CEF)"; botões superiores removidos; corretor automático pelo lead (somente leitura, "Corretor Pago?" removido). *16 no Santa Fé nasceu no Lote 2 |
| 2 | 10–14, 16, 17–23, 25, 26 | Motor financeiro único (centavos, HALF_UP, ausente ≠ zero) igual nos dois; abas Valores da Operação e Custos; histórico de entradas/CEF/pagamentos (manual ou BPO, cancelar/reativar, nunca apagar, alocação do BPO limitada no banco); investidores (soma ≤ 100%); papel Empreiteiro com acesso só às próprias obras; Pró-Soluto/HP 12C; Dias de Obra; PLS Real; JSON antigo da Prospecta migrado (obra 35) |
| 3 | 32 | Comissão = VGV × % (regra da obra ou padrão do corretor, nunca inventada); seção automática "Comissões de obras" em Comissões; pagamentos pela categoria "comissão"; investigação Chaleilson documentada; correções da revisão automática (PR #101/#170); RLS nas tabelas financeiras do Santa Fé |
| 4 | 27, 28, 29 | Progresso por incidência (Teste E 28,20%) com histórico; fotos no próprio banco (várias por envio, progresso, legenda, abrir, "no relatório", excluir; nunca trava em "Enviando"); relatório executivo PDF multipágina com logo de cada empresa |

Testes automáticos atuais: Prospecta 663/663 · Santa Fé 539/539 (inclui testes de referência A–G).

### 7.2 Falta implementar (lotes restantes)

| Lote | Itens | Observação |
|---|---|---|
| ✅ 5 | 01–04 Incorporação | Publicado em 13/10/2026 |
| ✅ 6 | 30, 31 Regularização | Publicado em 13/10/2026 |
| 7 | Auditoria final | Relatório A–K, matriz de 32 linhas, Teste H (isolamento) formal |

### 7.3 Pendências que dependem do proprietário (dados/decisões — nada foi alterado sem autorização)

| Código | Sistema | Pendência |
|---|---|---|
| ✅ P-01 | Santa Fé | **Resolvido 12/10: era VGV** — copiado para `vgv` (migration `20261012160000_ajustes_pos_lote3`, aplicada em produção). Antes: 4 de 5 obras têm `valorTotal` antigo (preservado, fora dos cálculos). Definir se era **VGV** ou **Orçamento** e preencher em Valores da Operação / Custos |
| P-02 | Prospecta | **Decisão 12/10: manter a fórmula; proprietário audita os valores depois.** Obra 35: o JSON antigo dizia Entrada Total 13.766, mas a fórmula oficial (VGV − Financiamento − FGTS − Subsídio) dá 21.766. Conferir os valores digitados |
| ✅ P-03 | Prospecta | **Resolvido 12/10: valor aprovado do lead = VGV** nas obras 17, 18, 27 (`drizzle/manual/0003_vgv_obras_aprovado_lead.sql`, aplicado em produção: 200.000 / 200.000 / 180.000). Ainda faltam VGV e % nas demais. Obras do Chaleilson (3, 4, 5, 6, 10, 12, 17, 18, 22, 27) e do Paulo Gomes (11) sem VGV e sem percentual de comissão → aparecem como "Dados incompletos". Preencher VGV e o percentual (padrão do corretor em Corretores, ou por obra em Custos). Obras 17, 18, 27 têm valor aprovado no lead (200.000 / 200.000 / 180.000) — **confirmar se é o VGV** antes de usar |
| ✅ P-04 | Prospecta | CRECI "0000" é intencional: identifica corretores informais (decisão do proprietário 12/10) |
| P-05 | Prospecta | **Era teste; o proprietário exclui manualmente.** Comissão manual #1 (Paulo Gomes, "Casa lu", R$ 1.000, 5%): tipo obra sem obra vinculada. Vincular ou corrigir |
| P-06 | Prospecta | **Proprietário confere manualmente.** Possíveis obras duplicadas (sem corretor): leads 23 (obras 26 e 35), 25 (28 e 33), 26 (29 e 34). As primeiras vieram da importação de 08/10. Revisar e cancelar a sobra |
| P-07 | Prospecta | **Aguardando resposta (pergunta reformulada em 12/10).** Obra 22 gravada como "Vistoria e medição", mas o serviço do CRM é obra de cliente. Corrigir no lead se for vistoria |
| ✅ P-08 | Santa Fé | Resolvido 12/10: tipo antigo "Obra Nova" passa a ser exibido como "Obra e reforma" (serviço do CRM), igual à Prospecta; valor gravado preservado |

### 7.4 Validação pendente (ambiente do agente não alcança os domínios/banco de produção)

| Código | Pendência |
|---|---|
| V-01 | Prospecta: validar em navegador (produção) as telas dos Lotes 1, 2 e 3 — edição de obra (Valores da Operação, Custos, histórico, BPO, investidores), portal `/empreiteiro`, cadastro de corretor (comissão padrão) e Comissões. Só testes automáticos foram possíveis |
| V-02 | Santa Fé: os fluxos foram testados em navegador com banco local; falta conferência em produção pelo proprietário |
| V-03 | Lote 4 (dois sistemas): enviar fotos reais pelo **iPhone/Safari** (HEIC) e gerar o PDF de uma obra real em produção. Prospecta: primeira validação em navegador de Progresso/Fotos/Relatório |
| V-04 | Santa Fé: o portal do cliente ainda não mostra obras/fotos (a Prospecta mostra). Lacuna de paridade anterior ao Lote 4 — avaliar no Lote 7 |

### 7.5 Configuração / infraestrutura

| Código | Pendência |
|---|---|
| C-01 | **Adiado pelo proprietário.** SMTP (`SMTP_HOST/PORT/USER/PASSWORD`) na Vercel dos dois projetos — e-mails de notificação não saem sem isso |
| ✅ C-02 | Google Drive: credenciais já configuradas pelo proprietário (o agente não tem permissão para listar variáveis na Vercel — 403). Upload/consulta real entra na validação V-01/V-02 |
| C-03 | Integração Git da Vercel instável (`git_info_fail` e deploys sem gatilho): sempre conferir deploy de produção READY; se falhar, redeploy pelo MCP (§5) |

### 7.6 Débitos técnicos registrados (não bloqueiam; corrigir na auditoria final ou quando houver lote relacionado)

| Código | Débito |
|---|---|
| ✅ D-01 | Resolvido 12/10: ponto = milhar, vírgula = decimal nos dois (exceção: um ponto com 1–2 casas = decimal vindo do banco). Antes: Prospecta `parseNumeroBR("1.000")` (sem vírgula) vira 1,00 em campos de dinheiro; no Santa Fé vira 1.000. Unificar (percentuais já foram unificados com `lerPercentualDigitado`) |
| ✅ D-02 | Resolvido 12/10: sugestão de **5% editável** nos dois (Santa Fé: default da coluna também 5). Antes: formulário de comissão **manual** vinha com 6% pré-preenchido (Prospecta e Santa Fé, `Comissao.percentual @default(6)`). As automáticas nunca inventam percentual; avaliar remover o 6% sugerido |
| D-03 | **Autorizado; executar no Lote 7** (toca relatórios/exportação/testes — fazer junto da regressão completa). Verificado 12/10: 0 registros, nenhuma FK, e as colunas antigas de Custos nunca existiram no banco. Tabela legada `broker_commissions` e colunas antigas de Custos — remover na auditoria final após confirmação |
| D-04 | Prospecta: coluna `broker_payment_settled` (criada pelo Codex no #99) preserva o antigo "Corretor Pago?"; o pagamento oficial agora vem do financeiro (item 24) — não reexibir na tela |
| D-06 | Prospecta: **regularização resolvida no Lote 6** (seção Documentos removida, sem upload). Jurídico e portal ainda usam o storage externo (`server/storage.ts`, Forge), que não está configurado em produção. Migrar para armazenamento no banco (como fotos no Lote 4) — avaliar no Lote 6 (regularização) e no Lote 7 |
| D-07 | Santa Fé: o CSS do Leaflet (mapas da Incorporação e Imóveis) é baixado do unpkg.com; se o CDN falhar, os pedaços do mapa se espalham pela página e cobrem botões. Empacotar `leaflet/dist/leaflet.css` localmente (paridade: conferir a Prospecta) |
| ✅ D-05 | Resolvido 12/10: Santa Fé desvia o empreiteiro no proxy antes de renderizar o painel; Prospecta manda o empreiteiro para `/empreiteiro` (antes ia para a home). Antes: log "Não autorizado." quando um empreiteiro abre uma URL de `/admin` (é redirecionado corretamente; só ruído de log) |

### 7.7 Respostas pendentes ao proprietário (preparadas em 12/10, ainda não enviadas)
- **P-07:** a obra 22 tem gravado "Vistoria e medição", mas o serviço vinculado no CRM é obra de cliente; a
  tela mostra o tipo do CRM. Se ela é vistoria, corrigir o serviço no lead; se é obra, nada a fazer.
- **D-04:** "Corretor Pago?" saiu porque o pagamento oficial agora vem do financeiro (lançamentos de categoria
  comissão, inclusive BPO). Reexibir criaria uma segunda fonte que pode contradizer o financeiro; a coluna
  antiga só preserva o histórico.
- **C-03:** na Vercel → Project → Settings → Git: desconectar e reconectar o repositório e revisar/reinstalar
  as permissões do app GitHub da Vercel para os dois repositórios. Enquanto isso, o agente confere cada deploy.

### 7.8 Checkpoint Lote 5 — 12/10/2026 (Prospecta)

Este checkpoint **substitui o status antigo da linha Lote 5 em §5**, escrito antes desta rodada. O código abaixo está no PR rascunho, não em produção.

- Branch isolada `codex/epic020-lote5-20261012`, PR rascunho #105. Nenhuma migration 0041–0045 aplicada; sem merge/deploy deste lote. `main` e produção continuam no Lote 4.
- Itens 01 e 02 e a preparação do item 03 foram commitados anteriormente. Drive privado próprio do site, com metadados/eventos e upload de até 3 MiB. Falta teste real de upload/download no Google Drive e validação autenticada.
- Item 04 agora inclui `due_diligence_json` (migration 0044), editor de etapas reordenáveis, tarefas/documentos, progresso, anexo privado por ID de etapa/documento e atualização CAS (conflito em alteração concorrente). Testes unitários Due Diligence 2/2; TypeScript passou antes da etapa de inventário.
- Inventário de unidades em implementação: migration 0045, tabelas `incorporation_units` e eventos, código único por estudo, CRUD de criação/reserva/venda/liberação, conciliação explícita de vendas antigas com código exato e proteção contra venda duplicada por `UPDATE` condicional + auditoria em uma declaração SQL. Vendas históricas JSON preservadas. `shared/incorporacao/unidades.ts`, `server/incorporacao-unidades-router.ts`, `client/src/components/incorporacao/UnidadesEditor.tsx`. O endpoint antigo `saveLancamentoImobiliario` é bloqueado para Desmembramento Simples. **Ainda requer revisão de concorrência, validação integral e teste em banco de desenvolvimento.**
- Navegação Desmembramento Simples contém os 17 módulos especificados, reutilizando os componentes atuais por seção sem apagar dados de outras tipologias. **Ainda requer validação visual e funcional.**
- Próximo passo: terminar `tsc`, lint/testes de unidade e integração em base isolada; revisar especialidade dos tipos e reconciliação (vendas incompletas bloqueiam movimentação e exigem tratamento humano), fazer backup/pré-flight de migrations, completar Drive real e smoke autenticado. Só então considerar merge/deploy. Não presumir que este checkpoint está pronto para produção.
- Validação após o commit: `tsc` e build passaram; teste Santa Fé 545/545. Na Prospecta 666/667 passaram na suíte completa enquanto o build corria, com timeout de 5s em teste antigo de rotas; reexecutado isoladamente, 7/7 passou. Os dois novos testes de unidades passaram. Neon projeto `SiteProspecta` confirmou ausência das colunas do Lote 5 em produção. Tentativa de criar branch isolada de teste foi recusada com **branches limit exceeded**; não se executou migration em outra branch ou produção. A migration 0045 recebeu trigger para impedir ocultar inventário pela troca de tipo ou voltar a gravar vendas no JSON antigo; essa última alteração ainda requer teste SQL em branch isolada.
- Pré-flight somente leitura no Neon produção confirmou 4 estudos e nenhum JSON de vendas anterior. A rotina de conciliação permanece como proteção para registros que venham de outras bases/ambientes ou alterações legadas posteriores; nenhum dado real foi alterado.

### 7.9 Checkpoint Lote 7 — 13/10/2026 (Codex, em andamento)

- Base conferida no GitHub: `main` Prospecta `e6f90d2` (PR #108) e Santa Fé `3288e51` (PR #177), ambos com Lote 6 publicado. Não há PR/branch de Lote 7 do Claude no remoto. Worktrees isolados `codex/epic020-lote7-20261013`; alterações locais antigas do Santa Fé não foram tocadas. PRs rascunho #105/#174 são anteriores ao merge do Lote 5 e não devem ser mesclados.
- D-07: CSS do Leaflet importado localmente pelo bundle nos dois aplicativos; scripts que injetavam CSS do unpkg removidos. No Santa Fé, ícones de marcador servidos em `/leaflet/` no próprio app. Falta validar visualmente os mapas em preview/produção.
- V-04: Santa Fé ganhou `/portal/obras`, consulta limitada ao `leadId` da sessão com progresso e fotos; link no menu e painel. Os bytes seguem no endpoint existente `/api/obras/fotos/:fotoId`, que checa a posse a cada requisição. Teste novo cobre o filtro e acesso negado a foto de outro lead. Nenhuma migração ou dado real alterado.
- Validação parcial: Santa Fé `prisma generate`, TypeScript e lint dos arquivos alterados passaram; suíte 565/565 (63 arquivos), incluindo 8/8 nos testes de foto/isolamento. Prospecta TypeScript/build passaram. O build webpack Santa Fé nesta worktree com `node_modules` externo por symlink falhou sem diagnóstico detalhado; executar com dependências locais antes de publicar.
- D-03 preflight Neon em produção (somente leitura): `broker_commissions` tem 0 linhas, 0 FKs de entrada, 0 views dependentes. A API, relatórios/exportação e testes **ainda leem essa tabela**. Exclusão não foi executada: exige primeiro trocar leitores, publicar versão compatível e só depois uma migration guardada/testada, com ponto de recuperação.
- D-06 ainda aberto: Jurídico e portal da Prospecta têm fallback para Forge quando o Drive está indisponível; nenhum upload real foi movido neste checkpoint. Teste H formal interempresas e relatório A–K/matriz de 32 linhas ainda pendentes. Sem merge/deploy do Lote 7 até validar os gates.

