# Handoff — Paridade 17/11, bloco 3 (financeiro) com a Prospecta

Pedido (autorizado pelo dono em 17/11): portar para o Grupo Santa Fé, com a MESMA regra de negócio, o "Bloco 3":
(1) Conta Azul — reimportação segura; (2) Gerador de PCI; (3) painel Anthropic em Integrações; (4) BPO — as duas
diferenças que ficaram de 13/11. Branch `claude/paridade17-b3-financeiro` (worktree `/home/user/sf-b3-financeiro`,
a partir de `origin/main` 98f9778). Sem merge, sem PR, sem deploy, sem banco real, nenhum dado apagado.

## Migração (NÃO aplicada em banco real)
`web/prisma/migrations/20261117300000_paridade_b3_financeiro/migration.sql` — só aditiva e idempotente
(CREATE TABLE/INDEX IF NOT EXISTS; RLS ligado + REVOKE de anon/authenticated, como `bpo_centros_custo`).
Aplicar no Supabase ANTES do deploy do código. Conteúdo por item está comentado no arquivo.
Schema Prisma: blocos `// ── Paridade 17/11 bloco 3 ──`. `prisma migrate diff` (banco com a migração × schema) = vazio.

## Item 1 — Conta Azul: reimportação segura (Prospecta EPIC-024 S-01, `794feca`) — concluído
- `web/src/lib/financeiro/conta-azul.ts`: `PREFIXO_CHAVE_CONTA_AZUL`, `CONFIRMACAO_LIBERAR_REIMPORTACAO` ("LIBERAR").
- `web/src/lib/bpo-conta-azul.ts`: a prévia separa "já importados (ativos)" de `arquivados` (bloqueando, liberáveis,
  com vínculo, de outra origem, exemplos com o motivo); a importação devolve `lancamentosArquivadosBloqueando`;
  `liberarReimportacaoContaAzul` (transação, travas `bpo_exclusao_lote` → `bpo_importar_conta_azul`, `FOR UPDATE`,
  cópia em `bpo_lancamentos_expurgo` com lote/usuário, histórico por lançamento, DELETE revalidando todos os vínculos:
  movimentação bancária, Asaas, baixa, obra, regularização, combinação nos dois sentidos; divergência = nada apagado).
  Só alcança os arquivados que seguram as chaves DO BACKUP enviado; ativos e outras origens nunca.
- `web/src/lib/actions/bpo-paridade.ts`: `liberarReimportacaoContaAzulAcao` — `exigirAdminAtivo` (perfil admin ativo)
  + módulo BPO; confirmação conferida no servidor.
- `web/src/lib/bpo-restauracao.ts` + `web/src/lib/actions/bpo-lote.ts`: restaurar não duplica — chave do Conta Azul em
  uso por outro lançamento → "já existe" (aviso diferente se o outro está arquivado); limpeza de ajustes cujo lançamento
  foi expurgado → aviso próprio; apagado fora do sistema → "não existe mais (foi apagado em definitivo)"; sem a tabela
  (antes da migração) confere com `to_regclass` e não aborta a transação.
- Tela `web/src/app/admin/bpo/_components/importar-conta-azul.tsx`: cartão "Já importados (ativos)", aviso dos
  arquivados que bloqueiam, botão "Liberar reimportação" com digitação de LIBERAR, prévia refeita depois.
- Diferença de permissão que já existia (mantida): no Santa Fé prévia e importação já exigiam o perfil admin; na
  Prospecta só o módulo BPO. Liberar exige admin nos dois.
- Sem FK de `expurgadoPorUsuarioId` para `usuarios` (padrão dos backups do BPO no Santa Fé; na Prospecta há FK SET NULL).

## Testes
- (a) automáticos:
  - `web/src/lib/__tests__/bpo-paridade.db.test.ts`: +8 cenários (Postgres 16 local com o schema + migrações
    20261113100000 e 20261117300000): arquivados à parte na prévia/importação; liberar só os sem vínculo, com cópia e
    histórico, legado intacto, confirmação errada recusada, segunda vez nada; reimportar depois de liberar (4 uma vez,
    transferência fora, centro de custo sem dobrar, A classificar preservado, clientes reaproveitados) e restaurar a
    limpeza antiga sem duplicar; exclusão JSON antiga pula a linha reimportada (ativa e arquivada); não-admin barrado;
    outra origem nunca removida; combinada/baixa mantidas; apagados fora do sistema. 28/28 no arquivo.
    O mock de `@/lib/auth/modulos` virou `vi.fn` (mesmo comportamento) para simular o não-admin.
  - `bpo-restauracao.test.ts` +1 (regra pura); `paridade-b3-migracao.test.ts` (PGlite: duas vezes, RLS, REVOKE, sem DML).
  - Junto: `bpo-restaurar-exclusao`, `bpo-limpeza-ajustes`, `bpo-lote3` (db) passam — 43/43. `tsc` ok; ESLint 0.
- (b) manuais: nenhum ainda.
- (c) produção: aplicar a migração; enviar o ZIP real; conferir o aviso dos arquivados e, se houver, LIBERAR.

## Próximo passo exato
Item 2 (Gerador de PCI, Prospecta `95f60bf`).
