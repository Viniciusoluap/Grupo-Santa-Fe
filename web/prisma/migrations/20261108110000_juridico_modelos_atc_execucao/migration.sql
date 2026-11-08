ALTER TABLE "contratos"
  ADD COLUMN IF NOT EXISTS "dataAssinatura" date,
  ADD COLUMN IF NOT EXISTS "obraId" text REFERENCES "obras"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "empreiteiroId" text REFERENCES "usuarios"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "corretorId" text REFERENCES "corretores"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "assinantes" jsonb;
