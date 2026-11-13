-- Paridade BPO (13/11) com a Prospecta (0103_bpo_a_classificar + 0104_bpo_centros_custo):
-- importação do backup do Conta Azul, aba "A classificar", dividir pagamentos e centros de custo.
-- Só aditiva e idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING); nenhum UPDATE/DELETE de dados.
-- Não aplicar em produção sem autorização do dono. Aplicar ANTES do deploy do código (ele lê as colunas novas).

-- 1) "A classificar": movimentação do banco sem correspondência segura e lançamento em aberto vindo de fora.
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "aClassificar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "aClassificar" BOOLEAN NOT NULL DEFAULT false;
-- Rastro do Conta Azul (categoria original, conta financeira, forma de pagamento).
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
CREATE INDEX IF NOT EXISTS "transacoes_bancarias_aClassificar_parcial_idx" ON "transacoes_bancarias" ("aClassificar") WHERE "aClassificar";
CREATE INDEX IF NOT EXISTS "bpo_lancamentos_aClassificar_parcial_idx" ON "bpo_lancamentos" ("aClassificar") WHERE "aClassificar";

-- 2) Dividir pagamentos: cada baixa pode vir de uma movimentação do banco (1 → N e N → 1).
ALTER TABLE "bpo_baixas" ADD COLUMN IF NOT EXISTS "transacaoId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bpo_baixas_transacaoId_fkey') THEN
    ALTER TABLE "bpo_baixas" ADD CONSTRAINT "bpo_baixas_transacaoId_fkey"
      FOREIGN KEY ("transacaoId") REFERENCES "transacoes_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "bpo_baixas_transacaoId_idx" ON "bpo_baixas" ("transacaoId");

-- 3) Centros de custo. bpo_lancamentos."centroCustos" continua texto (um nome ou "A / B").
CREATE TABLE IF NOT EXISTS "bpo_centros_custo" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_centros_custo_pkey" PRIMARY KEY ("id")
);
-- Nome único sem diferenciar maiúsculas nem acentos (sem depender da extensão unaccent).
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_centros_custo_nome_unico" ON "bpo_centros_custo" (
  lower(translate(btrim("nome"), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
);
-- Semente: os nomes já usados nos lançamentos (os combinados "A / B" viram A e B).
INSERT INTO "bpo_centros_custo" ("id", "nome")
SELECT 'cc_' || md5(nome), nome FROM (
  SELECT DISTINCT ON (lower(translate(nome, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))) nome
  FROM (
    SELECT left(regexp_replace(btrim(parte), '\s+', ' ', 'g'), 100) AS nome
    FROM "bpo_lancamentos" l, regexp_split_to_table(l."centroCustos", ' / ') AS parte
    WHERE l."centroCustos" IS NOT NULL AND btrim(parte) <> ''
  ) partes
  ORDER BY lower(translate(nome, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), nome
) unicos
ON CONFLICT DO NOTHING;
