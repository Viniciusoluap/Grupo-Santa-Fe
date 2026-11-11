# MATRIZ 16 CORREÇÕES — situação pelo código publicado no GitHub (27/10, auditoria Claude, somente leitura)

Base: Prospecta `eba96f7` / Santa Fé `9ff1e23` (= checkpoint do Codex `dcc2828`/`edea685` + handoff de retomada).
Commits locais do Codex posteriores a esse checkpoint ainda NÃO estão no GitHub (dono vai pedir ao Codex para publicar — opção 1).
Legenda: OK = implementado; PARCIAL = começado; FALTA = sem código; ? = conferir após o push pendente do Codex.

| # | Correção | Prospecta | Santa Fé | Observação |
|---|---|---|---|---|
| 01 | Conexões WhatsApp → Serviços › WhatsApp (sai de Integrações) | FALTA | FALTA | Hoje estão em Integrações (`ConexaoWhatsApp.tsx`, lote 25/10). Inverte o item 12 de 25/10. |
| 02 | Identidade correta das conversas | PARCIAL | ? | `fromMe`/`pushName` do dono da sessão tratado no webhook; falta prioridade CRM > nome público > número na lista/cabeçalho/busca. |
| 03 | Voltar à conversa ao abrir documento | FALTA | ? | Sem visualizador interno. |
| 04 | Reformular os 6 templates ({{empresa}}, captação sem {{servico}}) | PARCIAL | ? | `0079_whatsapp_templates` + `shared/whatsapp/templates.ts`; {{empresa}} ainda não aparece. |
| 05 | Seleção de serviços (checklist) | ? | ? | Codex relatou "seleção múltipla usa a lista real do CRM" (não publicado). |
| 06 | Visita com {{dia}} + {{horario}}, sem endereço | PARCIAL | ? | Texto novo no template; faltam campos no formulário/validação. |
| 07 | Templates como gerenciador (CRUD) | PARCIAL | FALTA | Tabela `whatsapp_templates` criada; UI ainda lista os fixos. |
| 08 | Remover aba Histórico (dados preservados) | PARCIAL | ? | Codex relatou remoção iniciada. |
| 09 | Exclusão consistente de conta bancária (prévia, backup, sem órfãos, preserva Asaas) | PARCIAL | FALTA | `previaExclusao` + `bpo-auditoria.ts` (backup lógico e limpeza atômica) + `0081`. |
| 10 | Pluggy HTTP 410 → `/v2/transactions` | OK (falta validar real) | OK (falta validar real) | `0077_banco_identificador_pluggy_v2`. |
| 11 | Extrato Cora com pagador/favorecido/histórico | OK (falta validar com arquivo real) | OK | Titular/descrição desde 25/10 + ampliação do Codex. |
| 12 | Editar cobrança/despesa com histórico e proteção de conciliação | PARCIAL | FALTA | `0081_bpo_exclusao_edicao_auditavel`. |
| 13 | Categorias de cobrança = 8 módulos + registro vinculado | PARCIAL | FALTA | `shared/financeiro/bpo-operacional.ts` + `0080`. |
| 14 | "IMPORTAR CLIENTES" do CRM (idempotente) + cadastro livre sem Serviços Contratados | PARCIAL | FALTA | Botão + `bpo.clientes.importarCrm`. |
| 15 | Categorias de despesa (Obras/Tarefas/Regularizações/Comissões/Incorporação) + vínculos e Etapa da obra | PARCIAL | FALTA | Mesma base de `bpo-operacional.ts`. |
| 16 | Projetos: revisão prioritária, renomear arquivos, checklist automático | PARCIAL | PARCIAL | `0078` / `20261026170000`; helper de nome; falta UI, prioridade e checklist. |

Próximo passo: após o push pendente do Codex, reauditar as linhas com "?" e executar FASE 2 (BPO 09–15) → FASE 3 (01–08, 16) → FASE 4.
