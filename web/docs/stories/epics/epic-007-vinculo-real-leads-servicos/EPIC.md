# EPIC-007: Vínculo real CRM/Leads ↔ Serviços operacionais

**Owner:** Claude (AIOX)
**Status:** InReview (PR aberto — aguardando merge por outra sessão)
**Paridade:** mesma regra de negócio implementada em paralelo no Prospecta (épico equivalente lá).

## Problema

Vincular um lead a um serviço (Avaliação, Projeto, Regularização, Obra, Financiamento) era um
vínculo decorativo: o profissional ainda redigitava nome, telefone, e-mail etc. que o CRM já
tinha. O dono pediu que os dados do lead sejam copiados automaticamente para o registro do
serviço — sem recadastro manual.

## Diagnóstico no Grupo Santa Fé (diferente do Prospecta)

O Santa Fé **não tem** as telas citadas no pedido original (lista "vinculados pelo CRM",
status "Aguardando configuração", botão "Abrir cadastro CRM", seção "Serviços do cliente" com
"+Vincular", toast "Serviço criado e sincronizado automaticamente") — tudo isso é do Prospecta
(`LinkedServiceQueue.tsx`, `AdminLeadDetail.tsx`). Aqui o fluxo era:

1. `criarLead` (`src/lib/actions/leads.ts`) criava registros "A definir" nos módulos para os
   serviços marcados, copiando só nome/telefone. Lacunas reais encontradas:
   - Avaliação era criada **sem `leadId`** (vínculo perdido na origem).
   - Financiamento era criado com `tipo` "MCMV"/"Convencional", fora das chaves de
     `TIPO_CONFIG` (`mcmv`, `sbpe`...), e **sem checklist** padrão.
   - `editarLead` **não** criava registros para serviços marcados depois, nem refletia nos
     registros vinculados a correção de nome/telefone/e-mail do lead.
2. Os formulários "Novo X" de cada módulo tinham uma busca de lead que só **pré-preenchia**
   campos editáveis de cliente; dava para ignorar o lead e cadastrar o cliente à mão (avulso).
   Em `criarAvaliacao` o `leadId` nem era lido → toda avaliação aberta pela tela ficava sem vínculo.
3. A página do lead não mostrava nenhum serviço vinculado.

## Solução (regra de negócio)

- **Lead é a fonte única dos dados do cliente.** Todo serviço operacional nasce vinculado a um
  lead do CRM (obrigatório, validado no servidor) e recebe nome/telefone/e-mail copiados do
  lead **no servidor** (o que o formulário mandar nesses campos é ignorado).
- Marcar um serviço no cadastro/edição do lead cria o registro real no módulo (idempotente).
- Abrir um serviço direto no módulo também marca o serviço no lead (vínculo nos dois sentidos).
- Editar nome/telefone/e-mail do lead propaga para todos os registros vinculados.
- Edição de registro vinculado mostra o cliente somente-leitura ("Editar no CRM").
- Página do lead ganhou "Serviços do Cliente" (registros reais + "Vincular novo serviço" que
  abre o formulário do módulo com o lead já selecionado). Sem botão "Desvincular".

## Stories

| Story | Escopo | Status |
|---|---|---|
| [S-01](S-01-avaliacoes-seletor-lead.md) | Avaliações: seletor de lead no lugar do cadastro manual | InReview |
| [S-02](S-02-projetos-vinculo-real.md) | Projetos: sem cadastro avulso, vínculo cria/popula registro | InReview |
| [S-03](S-03-regularizacao-vinculo-real.md) | Regularização: sem processo avulso | InReview |
| [S-04](S-04-obras-vinculo-real.md) | Obras: mesmo princípio | InReview |
| [S-05](S-05-financiamento-vinculo-real.md) | Financiamento: mesmo princípio | InReview |
| [S-06](S-06-lead-renda-corretor.md) | Lead: Renda/Tipo de Renda (não existe aqui) + corretor opcional | InReview (parte n/a) |
| [S-07](S-07-lead-sem-desvincular.md) | Lead: sem "Desvincular" | InReview (n/a — nunca existiu) |
| [S-08](S-08-lead-responsavel-usuarios-reais.md) | Lead: Responsável = usuários reais | InReview (requer migration) |
| [S-09](S-09-bug-voltar-central-administrativa.md) | (EPIC 3 / story 3.1) Bug do "Voltar" na Central Administrativa | Não reproduzível aqui |

## Arquivos centrais

- `src/lib/crm/servicos-lead.ts` — regras puras (mapa serviço→módulo, idempotência, cópia de dados).
- `src/lib/crm/vinculo-lead.ts` — acesso a banco (sincronizar, propagar, carregar lead, responsáveis).
- `src/lib/crm/responsavel.ts` — quem pode ser responsável.
- `src/components/crm/lead-selector.tsx`, `src/components/crm/cliente-vinculado-info.tsx`.
- Migration `prisma/migrations/20261011160000_lead_responsavel/migration.sql`.

## Pendência de produção (passo de deploy)

A migration `20261011160000_lead_responsavel` (aditiva: coluna nula + FK `ON DELETE SET NULL`)
**precisa ser aplicada no banco de produção antes/junto do merge** — o build não roda
`prisma migrate deploy`, e o histórico deste projeto é aplicado via `apply_migration` (MCP do
Supabase), como nas S-01/S-03 do EPIC-006. Sem ela, o Prisma Client novo falha em qualquer
consulta de `leads`. Por ser aditiva, aplicá-la antes do merge não afeta o código atual.
