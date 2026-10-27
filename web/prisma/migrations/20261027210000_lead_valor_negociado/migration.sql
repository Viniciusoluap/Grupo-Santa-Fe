-- Valor comercial próprio: não copiar valores simulados ou de financiamento.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "valorNegociado" numeric(15,2);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leads'::regclass AND conname='leads_valor_negociado_nonnegative') THEN
  ALTER TABLE leads ADD CONSTRAINT leads_valor_negociado_nonnegative CHECK ("valorNegociado" IS NULL OR "valorNegociado" >= 0);
 END IF;
END $$;
