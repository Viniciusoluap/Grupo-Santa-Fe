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
| H6 | PLS fiel à PCI (coordenadas, dados 1x, datas da obra, curva) | ⏳ | ⏳ |

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

## Próximo passo
H6: PLS fiel à PCI — (1) coordenadas `05° 29' 18" S` / `47° 27' 01" W`; (2) nº do contrato, valor do imóvel e
data da contratação perguntados 1x e pré-preenchidos (editáveis); (3) início/término da obra vindos do Editar
Obra; (4) Curva de Evolução pelas datas/cronograma da PCI + medições; (5) validar com PCI real.
