-- Lote 1 (32 implementações) — item 05: temperatura do lead.
-- Aditiva e idempotente: leads existentes recebem "frio" (mesmo padrão da Prospecta).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "temperatura" TEXT NOT NULL DEFAULT 'frio';
