ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "identificador_bancario" TEXT;
CREATE INDEX IF NOT EXISTS "transacoes_bancarias_identificador_bancario_idx" ON "transacoes_bancarias" ("identificador_bancario");
