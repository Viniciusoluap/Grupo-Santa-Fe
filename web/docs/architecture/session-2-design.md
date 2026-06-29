# Architectural Design — Session 2
## Grupo Santa Fé — Módulos Jurídico, Relatórios e Portal Real
**Agent:** @architect (Aria)
**Date:** 2026-06-29
**Status:** APROVADO — pronto para @pm criar epic

---

## 1. Escopo

Três módulos a implementar nesta sessão:

| Módulo | Situação atual | Objetivo |
|--------|---------------|----------|
| **Jurídico** | Skeleton existente — lista contratos básicos | Geração de contratos PDF, chat de atendimento, armazenamento de documentos, assinatura Gov.br |
| **Relatórios** | Página funcional — dados básicos (leads, comissões) | Adicionar avaliações, contabilidade, filtro por período, exportação CSV |
| **Portal do Cliente** | Dados mockados — hardcoded `Carlos Mendes` | Conectar ao banco real com isolamento por `leadId` |

**Boundary rígido:** Regularização é serviço de despachante imobiliário — modelo `Regularizacao` existente permanece intocado. Nenhum dado de Regularização entra no módulo Jurídico.

---

## 2. Decisões Arquiteturais (ADRs)

### ADR-001 — Chat: Database Polling
**Decisão:** Chat cliente-corretor implementado via polling HTTP (intervalo 4s).

**Contexto:** Vercel serverless tem limite de 30s por função. WebSockets e SSE persistentes não funcionam. O contexto é imobiliário — mensagens com delay de 4s são aceitáveis.

**Implementação:**
- `GET /api/chat/[leadId]?after={timestamp}` — retorna mensagens novas
- `POST /api/chat/[leadId]` — envia nova mensagem
- Cliente React usa `setInterval(fetch, 4000)` + estado local otimista
- Autenticação: corretor acessa qualquer `leadId`; cliente apenas o próprio

**Alternativa rejeitada:** SSE — mesmo timeout de 30s Vercel; sem vantagem real.

---

### ADR-002 — Gov.br Signatures: MVP + Phase 2
**Decisão:** MVP sem VIDaaS; Phase 2 com VIDaaS redirect.

**Contexto:** VIDaaS (ITI) exige conta Gov.br nível Prata/Ouro do signatário e credenciais de integrador aprovadas pelo ITI — processo burocrático. Risco de bloqueio externo ao time.

**MVP (agora):**
1. Admin gera contrato PDF via jsPDF (já instalado)
2. PDF é salvo em Vercel Blob
3. URL do PDF salva em `ContratoDocumento` (tipo: `contrato_gerado`)
4. Campo `assinaturaStatus` no modelo: `pendente | solicitado | assinado | rejeitado`
5. Fallback: upload manual de PDF assinado pelo admin

**Phase 2 (backlog):**
- Integrar VIDaaS OAuth2 quando credenciais ITI forem obtidas
- Webhook callback de status atualiza `assinaturaStatus` + `assinaturaGovId`

---

### ADR-003 — Portal: leadId na session
**Decisão:** Extender JWT token com `leadId` para usuários com role `"cliente"`.

**Implementação:**
- `auth.ts` → callback `jwt`: quando `user.role === "cliente"`, busca `Lead` pelo `email` do usuário e inclui `leadId` no token
- `src/lib/types/next-auth.d.ts` → declarar `leadId` no `Session` e `JWT`
- Todas as queries do portal filtram por `session.user.leadId`
- Admin não tem `leadId` — nunca acessa rotas do portal

**Alternativa rejeitada:** Armazenar `leadId` no modelo `Usuario` — acoplamento desnecessário, email já é a chave de ligação natural.

---

### ADR-004 — PDF Generation: jsPDF + Server Action
**Decisão:** Geração de PDF no servidor via Server Action com jsPDF.

**Fluxo:**
1. Admin preenche dados do contrato (tipo, partes, cláusulas, valor)
2. Server Action `gerarPdfContrato(contratoId)` executa server-side
3. jsPDF monta PDF com template (cabeçalho Grupo Santa Fé, cláusulas, rodapé com espaço para assinatura)
4. `put()` do Vercel Blob salva arquivo, retorna URL pública
5. Cria registro `ContratoDocumento` com tipo `"contrato_gerado"` + URL
6. Retorna URL para o admin baixar/visualizar

---

### ADR-005 — Relatórios: Sem novos modelos
**Decisão:** Todas as melhorias usam queries sobre modelos existentes. Nenhum novo modelo criado para Relatórios.

**Adições:**
- Avaliações: `prisma.avaliacao.groupBy` + `count` + `avg(valor)`
- Contabilidade: `prisma.lancamento.groupBy` por mês + tipo
- Filtro de período: parâmetros `from`/`to` em Server Component (searchParams)
- Export CSV: Server Action gera CSV string → Response com `Content-Disposition: attachment`

---

## 3. Novos Modelos Prisma (para @data-engineer)

### 3.1 ContratoDocumento

```prisma
model ContratoDocumento {
  id         String   @id @default(cuid())
  contratoId String
  contrato   Contrato @relation(fields: [contratoId], references: [id], onDelete: Cascade)
  nome       String
  url        String
  tipo       String   // "contrato_gerado" | "assinado" | "anexo"
  criadoEm  DateTime @default(now())

  @@map("contrato_documentos")
}
```

### 3.2 ChatMensagem

```prisma
model ChatMensagem {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation("ChatLead", fields: [leadId], references: [id], onDelete: Cascade)
  remetente String   // "cliente" | "corretor" | "sistema"
  texto     String
  lido      Boolean  @default(false)
  criadoEm DateTime @default(now())

  @@map("chat_mensagens")
}
```

### 3.3 Contrato — campos adicionais

```prisma
// Adicionar ao modelo Contrato existente:
leadId            String?
lead              Lead?              @relation("ContratoLead", fields: [leadId], references: [id])
assinaturaStatus  String             @default("pendente") // pendente|solicitado|assinado|rejeitado
assinaturaGovId   String?
documentos        ContratoDocumento[]
```

### 3.4 Lead — relações adicionais

```prisma
// Adicionar ao modelo Lead existente:
contratos      Contrato[]     @relation("ContratoLead")
chatMensagens  ChatMensagem[] @relation("ChatLead")
```

---

## 4. Rotas e Server Actions Novas

### Jurídico

| Caminho | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/actions/juridico.ts` | Server Action | `gerarPdfContrato`, `uploadContratoAssinado`, `solicitarAssinatura`, `atualizarStatusAssinatura` |
| `src/app/api/contratos/[id]/pdf/route.ts` | API GET | Retorna PDF gerado (stream) |
| `src/app/api/chat/[leadId]/route.ts` | API GET/POST | Chat polling |
| `src/app/admin/juridico/_components/juridico-client.tsx` | Client Component | Tabs: Contratos, Documentos, Chat, Assinaturas |
| `src/app/admin/juridico/_components/chat-admin.tsx` | Client Component | Interface chat lado admin |
| `src/app/portal/chat/page.tsx` | Page | Chat lado cliente (portal) |

### Portal

| Caminho | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/data/portal-real.ts` | Server Utils | Queries reais por `leadId` |
| `src/app/portal/page.tsx` | Server Component | Reescrever com dados reais |
| `src/app/portal/documentos/page.tsx` | Page | Usar documentos reais do Lead |
| `src/app/portal/acompanhamento/page.tsx` | Page | Usar interações reais do Lead |
| `src/app/portal/visitas/page.tsx` | Page | Usar visitas reais do Lead |
| `src/app/portal/chat/page.tsx` | Page | Chat cliente com corretor |

### Relatórios

| Caminho | Tipo | Descrição |
|---------|------|-----------|
| `src/app/admin/relatorios/page.tsx` | Server Component | Adicionar searchParams para filtro por data |
| `src/app/api/admin/relatorios/export/route.ts` | API GET | Exportação CSV |
| `src/app/admin/relatorios/relatorios-client.tsx` | Client Component | Adicionar DateRangePicker, botão Export CSV |

---

## 5. Extensão do NextAuth Session

```ts
// src/lib/types/next-auth.d.ts (novo arquivo)
import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: "admin" | "corretor" | "colaborador" | "cliente";
      creci?: string;
      corretorId?: string;
      leadId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: string;
    creci?: string;
    corretorId?: string;
    leadId?: string;
  }
}
```

```ts
// src/auth.ts — extensão do callback jwt (adicionar após corretorId):
let leadId: string | undefined;
if (usuario.papel === "cliente") {
  const lead = await prisma.lead.findFirst({
    where: { email: usuario.email },
    select: { id: true },
  });
  leadId = lead?.id;
}
return { ..., leadId };
// E no callback session: session.user.leadId = token.leadId
```

---

## 6. Estrutura de Stories para @sm

Dividir em 4 stories (1 por foco):

| Story | Título | Estimativa |
|-------|--------|-----------|
| S-01 | Schema Prisma — novos modelos Jurídico e Chat | 0.5d |
| S-02 | Módulo Jurídico — geração PDF, documentos, assinaturas MVP | 2d |
| S-03 | Chat de Atendimento — polling API + UI admin + portal | 1d |
| S-04 | Portal do Cliente — dados reais + isolamento por leadId | 1d |
| S-05 | Relatórios — filtros, avaliações, contabilidade, export CSV | 0.5d |

---

## 7. Constraints Técnicos (para @dev)

1. **Next.js 16 App Router** — Server Components por padrão; Client Components apenas onde necessário (interatividade)
2. **Vercel Blob** — usar `@vercel/blob` para PDF storage; variável `BLOB_READ_WRITE_TOKEN` já configurada
3. **Prisma 7** — usar `prisma.$transaction` para operações que criam contrato + documento atomicamente
4. **jsPDF** — já instalado; gerar PDF server-side em Server Action (`"use server"`)
5. **Sem novas dependências** — não adicionar pacotes; usar o que já existe no projeto
6. **Auth em todas as novas rotas API** — padrão já estabelecido na Sessão 1
7. **Polling interval** — 4000ms no chat; usar `useRef` para cleanup de `setInterval` no unmount

---

## 8. Qualidade e Testes (para @qa)

- Chat: testar envio/recebimento entre duas sessões (admin e cliente)
- PDF: verificar que PDF gerado contém dados corretos do contrato
- Portal: verificar que `leadId` null não expõe dados de outros leads (retornar estado vazio, não erro 500)
- Auth isolation: cliente não consegue acessar `/api/chat/[outroLeadId]`
- Relatórios: exportação CSV com dados corretos, encoding UTF-8 com BOM para Excel br

---

*Design produzido por @architect (Aria) — aprovado para iniciar pipeline SDC*
