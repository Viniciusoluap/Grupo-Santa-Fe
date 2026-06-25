-- bpo_lancamentos: clienteNomeLivre, centroCustos e clienteId opcional
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "clienteNomeLivre" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "centroCustos" TEXT;

-- Torna clienteId opcional (era NOT NULL na criação original)
ALTER TABLE "bpo_lancamentos" ALTER COLUMN "clienteId" DROP NOT NULL;
