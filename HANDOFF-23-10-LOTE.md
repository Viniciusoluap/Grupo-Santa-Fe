# HANDOFF 23/10 — Lote de correções H1–H6 (Prospecta + Grupo Santa Fé)

Branch de trabalho: `claude/sync-mirrored-repos-bsqnz3` (nos dois repositórios).
Ordem aprovada: H1 → H2 → H5 → H3 → H4 → H6. Merge e deploy autorizados pelo dono ao concluir.

## Status por história

| # | História | Prospecta | Santa Fé |
|---|----------|-----------|----------|
| H1 | Fundo sem faixa branca no overscroll (iPad) | ✅ commit | ✅ commit |
| H2 | 🤝 só depois do nome (Negócio fechado) | ✅ commit | ✅ commit |
| H5 | Selo "PCI vinculada" no card da obra | ✅ commit | ✅ commit |
| H3 | Excluir definitivamente lead arquivado | ✅ commit | ✅ commit |
| H4 | Notificações padronizadas | ✅ commit | ✅ commit |
| H6 | PLS fiel à PCI (coordenadas, dados 1x, datas da obra, curva) | ✅ commit | ✅ commit |

## H1 — concluído
- Prospecta: `AdminRoute` marca `<html class="area-escura">`; `index.css` deixa html/body `#0F1419` e
  `overscroll-behavior-x: none`; CRM com `overflow-x-clip` no contêiner e `overscroll-x-contain` no kanban
  (rolagem horizontal só dentro do pipeline).
- Santa Fé: `AdminShell` marca `<html class="area-admin">`; `globals.css` deixa html/body com o cinza do painel
  e `overscroll-behavior-x: none`; kanban com `overscroll-x-contain`.
- Testes: (a) `pnpm check` / `tsc` OK nos dois; Playwright (Prospecta, API simulada) em 820×1180, 1180×820 e
  1024×1366: html/body escuros (antes: body branco), documento sem rolagem horizontal, kanban rola internamente.
  (b) —. (c) Confirmar no iPad real após o deploy (efeito elástico do Safari não é reproduzível no Chromium).

## H2 — concluído
- Removido o 🤝 ANTES do nome nos cards do pipeline e na visão em lista do CRM (Prospecta `AdminCRM.tsx`;
  SF `lead-kanban.tsx` e `leads-client.tsx`). Fica só o indicador de temperatura à direita/abaixo do nome.
- Tela de detalhe do lead não foi alterada (fora do print).
- Testes: (a) `pnpm check` / `tsc` OK. (b) —. (c) conferir card "Negócio fechado" em produção.

## H5 — concluído
- Prospecta: `getAllProjects` (server/db.ts) devolve `pciVinculada` (linha em `construction_pci` com `linked_at`);
  `ListaObras.tsx` mostra o selo verde "PCI vinculada" logo abaixo do selo de situação.
- Santa Fé: `carregarListaObras` devolve `pciVinculada` (`ObraPci.vinculadaEm`); `lista-obras.tsx` mostra o selo
  ao lado do selo de situação. Vale também para o Portal do Empreiteiro (mesma lista).
- Testes: (a) Prospecta: suíte completa 915/915 + `pnpm check`; Playwright (API simulada, iPad e celular): selo
  só na obra com PCI. SF: `tsc` OK; novo teste em `medicoes.db.test.ts` (sem PCI → não; PCI enviada sem vincular →
  não; vinculada → sim) passando com Postgres local. Suíte SF local: 766 ok, 10 falhas pré-existentes do ambiente
  local (gatilhos SQL/Drive ausentes no banco local; as mesmas 10 falham sem esta mudança).
  (b) —. (c) conferir na lista de Obras em produção.

## H3 — concluído
- Regra (igual nos dois): só **admin**, só lead **arquivado** (Prospecta: `deleted_at`; SF: `arquivadoEm` ou
  `excluidoEm`), confirmação explícita e **bloqueio com aviso** quando há vínculos: obras (comissões vêm pela obra),
  financiamentos, regularizações, projetos, avaliações, contratos, documentos enviados e conta de acesso.
  Sem vínculos: apaga lead + histórico + follow-ups/tarefas + serviços + checklist/alertas + chat; visitas e
  mensagens de WhatsApp ficam, só sem o vínculo. Arquivar/recuperar não mudou.
- Prospecta: `shared/lead-exclusao-definitiva.ts`; `server/db.ts` (`getLeadVinculosExclusao`,
  `excluirLeadArquivadoDefinitivamente` — uma única instrução SQL que rechecа as condições); `server/routers.ts`
  (`leads.permanentDeletionContext`, `leads.permanentDelete`, com `exigirAdministrador`); botão
  "Excluir definitivamente" ao lado de "Recuperar" na lista de arquivados (`AdminCRM.tsx`).
- SF: `src/lib/crm/lead-exclusao-definitiva.ts` (mesmo texto); `actions/leads.ts`
  (`consultarExclusaoDefinitivaLead`, `excluirLeadDefinitivamente`, transação serializável); botão no detalhe do
  lead, junto de "Desarquivar" (`lead-status-picker.tsx`), só para admin.
- FKs reais conferidas em produção (somente leitura) antes de escrever o SQL. Nenhum dado de produção foi apagado.
- Testes: (a) Prospecta `server/lead-exclusao-definitiva.test.ts` 5/5 (colaborador barrado, ativo recusado,
  vínculos bloqueiam, corrida devolve conflito); SQL real validado em Postgres local com as mesmas FKs (lead limpo
  apagado com dependentes; ativo, com obra e com documento preservados); Playwright: admin vê botão/confirma/apaga,
  bloqueado mostra aviso sem chamar a exclusão, colaborador não vê o botão. SF
  `lead-exclusao-definitiva.db.test.ts` 4/4 com Postgres local. (b) —. (c) testar em produção com um lead de teste.

## H4 — concluído
- Formatador único (mesmo arquivo nos dois): Prospecta `shared/notificacao-formato.ts`, SF
  `src/lib/notificacao-formato.ts` — ícone por tipo/assunto, título curto ("9 cards com prazo para hoje"),
  um cliente por linha ("NOME — prazo 22/10/2026"), datas BR, "e mais N" (5 no sino, 10 em "Ver todas") e
  botão de ação ("Ver no CRM", "Ver obra", "Abrir no portal"). Notificações antigas já gravadas no formato
  corrido também passam a aparecer padronizadas (conversão na exibição; nenhum dado alterado).
- Geração nova do resumo de prazos (Prospecta `lead-card-due-digest.ts`; SF `avisos-vencimento-card.ts`) já
  grava uma linha por cliente; e-mail com data BR.
- Prospecta: `NotificacaoConteudo.tsx` usado no sino (`Navbar.tsx`) e em `/notificacoes`.
- SF: `components/notificacao-conteudo.tsx` no sino (`admin-shell.tsx`) + link "Ver todas as notificações" +
  nova página `/admin/notificacoes` (não existia; paridade) com "marcar como lida" ao abrir e "Marcar todas".
- Testes: (a) `notificacao-formato.test.ts` 3/3 nos dois; Prospecta suíte 923/923; SF 773 ok (as mesmas 10
  falhas pré-existentes do ambiente local). Playwright Prospecta (iPad e celular, exemplo real de 9 cards):
  título curto, 5 linhas + "e mais 4" no sino, 9 linhas na página, "Ver no CRM". (b) —.
  (c) conferir sino e "Ver todas" nos dois em produção; tela nova do SF sem E2E local (exige login real).

## H6 — concluído
- Núcleo CAIXA igual nos dois (Prospecta `server/caixa/*`, SF `src/lib/caixa/*`; só os imports diferem):
  1. **Coordenadas**: `formatarCoordenada` — 52918 → `05° 29' 18" S`, 472701 → `47° 27' 01" W`; hemisfério lido da
     própria PCI (X58/AC58). PCIs já enviadas (que guardaram "52918 S") saem certas no PDF (formatação na hora).
  2. **Nº do contrato, valor do imóvel e data da contratação** (não estão na PCI): campos novos da PLS
     (`numeroContrato`, `valorImovel`, `dataContratacao`), perguntados no formulário da PLS e pré-preenchidos
     pelas medições seguintes da obra (`dadosFixosDasMedicoes`, campo a campo; PCI como reserva; contrato zerado do
     modelo é ignorado). Editáveis. XLS grava S51/AQ77/AL78; PDF usa os mesmos valores.
  3. **Início e término previsto** vêm do Editar Obra (Prospecta `start_date`/`estimated_end_date`; SF
     `dataInicio`/`dataPrevisaoFim`). Sem data na obra, vale a fórmula do modelo (contratação + 30 dias). XLS grava
     AL79/AL80; etapa da vistoria passa a contar do início real.
  4. **Curva de Evolução** (`curvaDeEvolucao`): Acumul. PLS por etapa (medições), **Acumul. Aferido** fica em branco (ver QA, achado 6), Acumul. Adotado (aferido, senão PLS) e Mês
     referência (início + n meses). Linhas até o prazo/cronograma da PCI. XLS grava AF/AJ/AO/AT.
- Testes: (a) `pls-fiel-pci.test.ts` 9/9 nos dois (coordenadas, pré-preenchimento, normalização/validação, XLS e PDF
  com contrato/valor/contratação, datas da obra, curva). Prospecta 932/932 + `pnpm check`; SF 782 ok (10 falhas
  pré-existentes do ambiente local) + `tsc`. PDF de exemplo conferido visualmente (pág. 1).
  (b) —. (c) **gerar PLS com uma PCI real em produção e conferir no SIOPI — aceitação só o usuário confirma.**

## Revisão @qa (AIOX) — veredito CONCERNS, achados tratados
- 1 MEDIUM (Prospecta): exclusão definitiva deixava tarefas (`tasks` related_type='lead') órfãs → agora apaga
  junto (paridade com SF `tarefaCrm`). SQL revalidado em Postgres local; colunas conferidas em produção (leitura).
- 3 LOW (Prospecta): documentos já excluídos (`deleted_at`) não bloqueiam mais e são apagados com o lead.
- 4 LOW: título do resumo → "N cards com prazo até hoje" (inclui vencidos).
- 5 MEDIUM: XLS gravava "Mês referência" em 73 linhas → limitado ao prazo/cronograma (igual ao PDF).
- 6 MEDIUM (regra de negócio): "Acumul. Aferido" é o % medido pela CAIXA, que o sistema não tem → **coluna fica
  em branco**; Adotado = PLS. **Pendente: decisão do dono** (manter em branco ou criar campo "% aferido pela CAIXA"
  informado ao confirmar o recebimento).
- 7 LOW: AL80 (término) só perde a fórmula quando vem do Editar Obra; senão só o cache é atualizado.
- 8 LOW: com repactuação informada na PLS, término = início + etapas repactuadas (prevalece sobre o Editar Obra).
- 9 LOW: sem ação — a Prospecta já filtra `measurement_type = 'pls'` (mesma regra do SF).
- 2 LOW (Prospecta, **dívida técnica registrada**): corrida residual — se alguém criar obra para o lead arquivado
  no mesmo instante da exclusão, a obra fica sem vínculo (SET NULL). Correção exige transação serializável do
  driver Neon HTTP, não validável localmente; probabilidade muito baixa.
- Testes após correções: Prospecta 933/933 + `pnpm check`; SF caixa/notificações 30/30 + `tsc`.

## Revisão Codex (PR Prospecta #155) — 2 achados P2 tratados
- S51: sem nº de contrato válido o XLS agora apaga o "0.00000000000-0" do modelo (antes ficava). Igual no SF.
- Exclusão definitiva (Prospecta): documentos já excluídos COM arquivo no Drive não são mais apagados do banco
  (o arquivo continuaria no Drive sem referência); só os sem arquivo saem. No SF, documento com arquivo já bloqueia.

## Revisão Codex (PR Santa Fé #218) — 3 achados P2 tratados
- S51 (igual à Prospecta) — já corrigido.
- PDF: a tabela da Curva de Evolução cortava etapas além de ~33; agora as linhas encolhem para caber até 48
  etapas (nos dois). Teste com prazo 48 + conferência visual.
- SF "Ver todas": passa a mostrar os mesmos alertas calculados do sino (cobrança BPO e prazo de obra próximos),
  extraídos para `src/lib/notificacoes-calculadas.ts` e usados pela API do sino e pela página.

## Próximo passo
Merge dos PRs (Prospecta #155, SF #218) → deploy → conferência em produção (sem migração de banco).
