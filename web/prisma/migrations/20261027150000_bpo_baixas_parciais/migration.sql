ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "valorRecebido" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "bpo_lancamentos" SET "valorRecebido" = "valor" WHERE "pago" AND "valorRecebido" = 0;
CREATE TABLE IF NOT EXISTS "bpo_baixas" (
  "id" TEXT PRIMARY KEY,
  "lancamentoId" TEXT NOT NULL REFERENCES "bpo_lancamentos"("id") ON DELETE RESTRICT,
  "requestKey" TEXT NOT NULL UNIQUE,
  "valor" DOUBLE PRECISION NOT NULL CHECK ("valor" > 0),
  "data" TIMESTAMP(3) NOT NULL,
  "motivo" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "bpo_baixas_lancamentoId_data_idx" ON "bpo_baixas"("lancamentoId", "data");
ALTER TABLE "bpo_baixas" ENABLE ROW LEVEL SECURITY;
