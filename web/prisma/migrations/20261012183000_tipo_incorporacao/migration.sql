-- Estudos legados permanecem sem tipo até classificação administrativa.
ALTER TABLE "estudos_incorporacao" ADD COLUMN "tipoIncorporacao" TEXT;
ALTER TABLE "estudos_incorporacao" ADD CONSTRAINT "estudos_incorporacao_tipo_chk"
  CHECK ("tipoIncorporacao" IS NULL OR "tipoIncorporacao" IN
    ('desmembramento_simples', 'residencial', 'vertical', 'loteamento'));
