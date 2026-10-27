# TEST_RESULTS — Lote 02

(pendente — preenchido nas fases seguintes)

## 27/10 — retomada integrada
- SF: `node node_modules/vitest/vitest.mjs run --root web --maxWorkers=1`: 135 arquivos/944 testes aprovados; 21 arquivos/124 testes ignorados por ambiente específico.
- P: `vitest run server/incorporacao-lancamento-viabilidade.test.ts server/incorporacao-urbanismo-cenario.test.ts server/incorporacao-orcamento-importacao.test.ts --maxWorkers=1 --minWorkers=1`: 7/7.
- SF: `vitest run src/lib/__tests__/lancamento-viabilidade.test.ts src/lib/__tests__/lote2-migrations.test.ts --maxWorkers=1`: 3/3. Migrações reais renumeradas aplicadas duas vezes; dados legados e RLS preservados.
- TypeScript SF sem erros. Prospecta em execução; não contar log geral incompleto como sucesso.
- Manuais/autenticados/produção: pendentes.

## Checkpoint CRM e PCI
- Prospecta geral: `vitest run --maxWorkers=2 --minWorkers=1` — 162 arquivos/1219 testes aprovados, duração 212,71 s. Execução anterior à adição do campo de preço comercial.
- Após campo comercial: P `incorporacao-unidades-cenario.test.ts` + `lead-vgv-cadastro.test.ts` — 17/17; SF `unidades-crm.test.ts` + `lote2-migrations.test.ts` — 4/4. Ambos TypeScript sem erros.
- SF `pci-gerador-acesso-persistencia.test.ts` — 3/3, dependências de banco mockadas: regra de perfis, gravação/recarga de rascunho e isolamento do download pelo par obra/PCI.
