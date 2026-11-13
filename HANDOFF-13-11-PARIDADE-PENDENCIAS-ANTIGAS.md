# Handoff — Paridade: pendências antigas Prospecta → Grupo Santa Fé (13/11/2026)

Branch: `claude/paridade-legado` (worktree `/home/user/sf-legado`, a partir de `origin/main` 335211a).
Ordem: paridade retomada pelo dono em 13/11 (ver nota no `docs/stories/epics/ROADMAP.md` da Prospecta).
Fora do escopo desta frente (outras sessões em paralelo): BPO (Conta Azul, A classificar, split, centros de
custo, filtros), Central de Vendas, Incorporação (Mercado/IBGE/Tavily/chaves, Negociação, Correções 09–12 da
Viabilidade).

## Passo 1 — Auditoria (conferida no código dos dois repositórios, não só no ROADMAP)

Fontes: Prospecta `docs/stories/epics/ROADMAP.md` (seção "Pendências de paridade… EPIC-017/018/019 — 11/10/2026"),
stories `epic-017-*`, `epic-018-*`, `epic-019-navegacao-central-administrativa`; Santa Fé `CLAUDE.md`,
`HANDOFF-12-11-STANDBY-PARIDADE.md`, `HANDOFF-11-11-PARIDADE-PROSPECTA.md`.

| # | Item | Prospecta | Santa Fé (código atual) | Ação |
|---|------|-----------|-------------------------|------|
| 1 | 017/1.2–1.3: vínculo de Projeto/Regularização no lead cria registro real com dados do lead | `ensureLinkedRecord` (lead-services-router) | `sincronizarServicosDoLead` → `criarRegistro` (`lib/crm/vinculo-lead.ts`) cria Projeto/Regularização/Obra/Financiamento/Avaliação/Tarefa no mesmo commit do lead | já igual |
| 2 | 017/1.1, 1.4, 1.5: Avaliação/Obra/Financiamento só nascem a partir de lead | seletor `LeadPicker` + servidor exige `leadId` | rotas `/admin/*/novo` redirecionam ao CRM; serviços nascem só no lead (lote `codex/santa-fe-limpeza-crm-20261011`, serviços centralizados no CRM) | já igual (regra mais estrita no SF, por exceção de escopo do lote) |
| 3 | 017: nome/telefone/e-mail/CPF migrados e cliente somente leitura/sincronizado | `leadContact`, `avaliacaoClientFields`, `financiamentoFromLeadSchema` | `dadosClienteDoLead`, `propagarDadosClienteDoLead`, `clienteParaRegistro` (nome/tel/e-mail sempre do lead); Financiamento recebe CPF. **Avaliação não recebe o CPF do lead** (nem na criação, nem na propagação) | **alinhar** (CPF na Avaliação) |
| 4 | 017: lead ganha CPF/endereço/bairro (e cidade/UF) que migram aos serviços | `leads.cpf/address/neighborhood` + `city/state`; Avaliação recebe endereço/bairro/cidade/UF; Regularização e Obra recebem o endereço completo (`leadFullAddress`); endereço da Obra continua editável | `Lead.cpf` existe; **não há endereço/bairro/cidade/UF no lead**; Avaliação nasce com "A definir"; Obra e Regularização sem endereço | **portar** (migração aditiva `20261113400000_…`) |
| 5 | 017/1.6: sem Renda/Tipo de Renda; corretor vinculado validado | sem renda; `broker_id` validado como corretor | sem renda no cadastro/edição; "Corretor vinculado" (opcional) vem de `corretores` (FK) | já igual |
| 6 | 017/1.8: responsável = usuários reais admin/colaborador | `leads.assignmentOptions`, `responsible_user_id` | `Lead.responsavelId` + `PAPEIS_RESPONSAVEL = admin, colaborador` validado no servidor (`responsavelValido`) | já igual |
| 7 | 017/1.7: sem botão "Desvincular" em Serviços do cliente | removido | ficha do lead não tem "Desvincular" (só os "Desvincular" de PCI, WhatsApp e anexos, que são outros fluxos) | já igual |
| 8 | 018/2.1: corretor sem foto/especialidades no cadastro | removidos, edição preserva | cadastro/edição sem foto e especialidades (colunas mantidas no banco) | já igual |
| 9 | 018/2.2: comissão com corretor cadastrado; inativos marcados "(inativo)"; aviso sem corretores | `comissoes.formOptions` com inativos marcados, aviso "Nenhum corretor cadastrado em Corretores" | seletor obrigatório de corretor, mas lista **só ativos**: comissão de corretor desativado abre com o campo vazio e não salva sem trocar; sem aviso de lista vazia | **alinhar** |
| 10 | 018/2.3–2.4: imóvel/obra cadastrados (sem texto livre), valor = % × valor | `propertyId`/`constructionProjectId`, valor sugerido editável | `negocioId` + `calcularValorComissao` (venda, aluguel, financiamento, obra), registro antigo preservado | já igual |
| 11 | 018/2.5: "construção" → "Obra" | rótulo "Obra", migração 0031 | `TIPOS_COMISSAO` com `obra` → "Obra"; não há `construcao` no código | já igual |
| 12 | 019/3.1: retorno/layout da Central Administrativa | `/admin/acesso` + `GlobalBackButton` corrigidos | não existe Central Administrativa nem botão global de voltar; `/admin` redireciona ao primeiro módulo do perfil (`destinoDoUsuario`); Dashboard/Central de Gestão removidos pelo lote `codex/santa-fe-limpeza-crm-20261011` | exceção documentada (lote exclusivo do SF) — o defeito não existe aqui; nada a portar |
| 13 | Documentos do cliente no Atendimento → Drive `Clientes/<Nome (nº)>/<Área>` | `lead_documents` + checklist do Financiamento no Portal | `ChecklistDocumentos` na ficha do lead, no Financiamento e no Portal; `/api/clientes/documentos` envia por `uploadDocumentoCliente` (área Atendimento ou Financiamento), versões, solicitação por e-mail, envio em partes (20 MiB) | já igual |
| 14 | DT-2026-10-23-01 (exclusão definitiva de lead arquivado) | dívida só da Prospecta | SF usa transação serializável + `FOR UPDATE` | já igual (sem risco no SF) |

Itens do ROADMAP fora desta frente (não portados aqui, por instrução): Mercado/IBGE/Tavily/chaves,
Negociação, Correções 09–12 da Viabilidade → frente `sf-incorporacao`; Conta Azul e demais itens do BPO → `sf-bpo`;
Central de Vendas → `sf-central-vendas`.

## Passo 2 — Implementação (um commit por item)

| Item | Estado | Commit |
|------|--------|--------|
| 3+4 — endereço/bairro/cidade/UF no lead, migrados para Avaliação/Obra/Regularização; CPF na Avaliação | pendente | — |
| 9 — corretores inativos marcados e aviso de lista vazia na Comissão | pendente | — |

## Testes
- (a) automáticos: ainda não executados (só auditoria).
- (b) manuais: nenhum.
- (c) produção: nada aplicado.

## Próximo passo exato
Implementar o item 3+4 (schema `Lead.endereco/bairro/cidade/uf` no bloco "Paridade pendências antigas (13/11)",
migração `20261113400000_lead_endereco`, formulários de cadastro/edição do lead, `criarRegistro`), com testes.
