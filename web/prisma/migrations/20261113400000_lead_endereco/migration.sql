-- Paridade pendências antigas (13/11) — EPIC-017 da Prospecta: endereço do cliente no lead.
-- Só aditiva e idempotente: colunas opcionais, nenhum dado existente é alterado.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "endereco" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "bairro" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "uf" VARCHAR(2);
