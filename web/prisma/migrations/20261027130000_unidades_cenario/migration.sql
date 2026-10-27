-- Lote 2, 15/16: aditiva; exclusão lógica não recria unidades.
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "compradorLeadId" text REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "origemChave" varchar(255);
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "cenarioId" varchar(120);
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "excluidoEm" timestamp(3);
CREATE UNIQUE INDEX IF NOT EXISTS estudo_unidades_origem_idx ON estudo_unidades("estudoId", "origemChave") WHERE "origemChave" IS NOT NULL;
