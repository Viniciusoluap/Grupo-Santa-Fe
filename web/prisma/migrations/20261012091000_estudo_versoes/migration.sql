CREATE TABLE "estudos_incorporacao_versoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "estudoId" text NOT NULL,
  "numero" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "criadoEm" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "estudos_incorporacao_versoes_estudoId_numero_key" UNIQUE ("estudoId", "numero")
);
CREATE INDEX "estudos_incorporacao_versoes_estudoId_criadoEm_idx"
  ON "estudos_incorporacao_versoes" ("estudoId", "criadoEm");
ALTER TABLE "estudos_incorporacao_versoes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "estudos_incorporacao_versoes" FROM anon, authenticated;

-- Primeiro snapshot histórico: estado conhecido agora, sem inventar versões antigas.
INSERT INTO "estudos_incorporacao_versoes" ("estudoId", "numero", "snapshot")
SELECT "id", 1, to_jsonb(e) FROM "estudos_incorporacao" e;

CREATE FUNCTION registrar_versao_estudo_incorporacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'atualizadoEm') IS NOT DISTINCT FROM (to_jsonb(NEW) - 'atualizadoEm') THEN
    RETURN NEW;
  END IF;
  INSERT INTO "estudos_incorporacao_versoes" ("estudoId", "numero", "snapshot")
  VALUES (NEW."id", COALESCE((SELECT MAX("numero") FROM "estudos_incorporacao_versoes" WHERE "estudoId" = NEW."id"), 0) + 1, to_jsonb(NEW));
  RETURN NEW;
END $$;

CREATE TRIGGER versao_estudo_incorporacao
AFTER INSERT OR UPDATE ON "estudos_incorporacao"
FOR EACH ROW EXECUTE FUNCTION registrar_versao_estudo_incorporacao();

CREATE FUNCTION proteger_versao_estudo_incorporacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de versões do estudo é somente leitura';
END $$;
CREATE TRIGGER estudo_incorporacao_versao_imutavel
BEFORE UPDATE OR DELETE ON "estudos_incorporacao_versoes"
FOR EACH ROW EXECUTE FUNCTION proteger_versao_estudo_incorporacao();
