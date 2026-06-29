# EPIC-002 — Módulos Jurídico, Chat, Portal Real e Relatórios
**Agent:** @pm (Morgan)
**Status:** READY — stories aprovadas por @po
**Sessão:** 2
**Arquitetura de referência:** `docs/architecture/session-2-design.md`

---

## Objetivo

Completar os módulos pendentes do sistema Grupo Santa Fé com foco em qualidade e segurança:

1. **Jurídico** — geração de contratos PDF, armazenamento de documentos, assinaturas MVP
2. **Chat** — atendimento cliente-corretor em tempo quase-real (polling)
3. **Portal do Cliente** — substituir dados mockados por dados reais isolados por cliente
4. **Relatórios** — ampliar cobertura de dados + filtros + exportação CSV

## Requisitos Funcionais

| ID | Requisito | Módulo |
|----|-----------|--------|
| FR-01 | Admin pode gerar PDF de contrato a partir dos dados cadastrados | Jurídico |
| FR-02 | PDF gerado é salvo no Vercel Blob e URL persistida no banco | Jurídico |
| FR-03 | Admin pode fazer upload de contrato já assinado | Jurídico |
| FR-04 | Contrato tem campo `assinaturaStatus` (pendente/solicitado/assinado/rejeitado) | Jurídico |
| FR-05 | Admin e cliente podem trocar mensagens de texto em chat vinculado ao lead | Chat |
| FR-06 | Chat usa polling 4s; mensagens aparecem sem reload manual | Chat |
| FR-07 | Mensagens têm indicador de lido/não lido | Chat |
| FR-08 | Portal exibe dados reais do lead logado (visitas, docs, acompanhamento) | Portal |
| FR-09 | Portal exibe nome real do cliente (não hardcoded "Carlos Mendes") | Portal |
| FR-10 | Cliente não acessa dados de outros clientes | Portal |
| FR-11 | Relatórios exibem dados de avaliações e lançamentos contábeis | Relatórios |
| FR-12 | Relatórios têm filtro por período (data início / data fim) | Relatórios |
| FR-13 | Relatórios permitem exportação em CSV | Relatórios |

## Requisitos Não-Funcionais

| ID | Requisito |
|----|-----------|
| NFR-01 | Todas as novas rotas API têm autenticação obrigatória (padrão Sessão 1) |
| NFR-02 | Consultas do portal filtram por `session.user.leadId` — nunca expor dados de outros leads |
| NFR-03 | PDF gerado server-side (Server Action) — não expor lógica de geração ao cliente |
| NFR-04 | CSV exportado com BOM UTF-8 para compatibilidade com Excel BR |
| NFR-05 | Chat polling usa cleanup de `setInterval` no unmount do componente |
| NFR-06 | Nenhuma nova dependência npm adicionada |

## Constraints

| ID | Constraint | Origem |
|----|-----------|--------|
| CON-01 | Regularização permanece módulo separado — nenhuma relação com Jurídico | Decisão de negócio |
| CON-02 | Gov.br VIDaaS: apenas MVP com fallback manual; integração real no backlog | ADR-002 |
| CON-03 | WebSockets proibidos — Vercel serverless; usar polling | ADR-001 |
| CON-04 | Stack fixo: Next.js 16, Prisma 7, Vercel Blob, jsPDF | Restrição técnica |

---

## Stories

| Story | Título | Agent | Estimativa |
|-------|--------|-------|-----------|
| [S-01](./S-01-schema-juridico.md) | Schema Prisma — modelos Jurídico e Chat | @data-engineer + @dev | 0.5d |
| [S-02](./S-02-juridico-pdf-docs.md) | Jurídico — geração PDF e documentos | @dev | 2d |
| [S-03](./S-03-chat-atendimento.md) | Chat de Atendimento — polling API + UI | @dev | 1d |
| [S-04](./S-04-portal-real.md) | Portal do Cliente — dados reais | @dev | 1d |
| [S-05](./S-05-relatorios.md) | Relatórios — filtros e exportação | @dev | 0.5d |
