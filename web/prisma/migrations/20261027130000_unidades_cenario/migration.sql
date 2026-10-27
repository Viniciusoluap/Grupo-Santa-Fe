-- Lote 2, 15/16: aditiva; exclusão lógica não recria unidades.
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "compradorLeadId" text REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "origemChave" varchar(255);
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "cenarioId" varchar(120);
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS "excluidoEm" timestamp(3);
CREATE UNIQUE INDEX IF NOT EXISTS estudo_unidades_origem_idx ON estudo_unidades("estudoId", "origemChave") WHERE "origemChave" IS NOT NULL;
ALTER TABLE estudo_unidades ADD COLUMN IF NOT EXISTS revisao integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION bump_estudo_unidade_revisao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.revisao := OLD.revisao + 1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS estudo_unidade_revisao_trg ON estudo_unidades;
CREATE TRIGGER estudo_unidade_revisao_trg BEFORE UPDATE ON estudo_unidades FOR EACH ROW EXECUTE FUNCTION bump_estudo_unidade_revisao();
