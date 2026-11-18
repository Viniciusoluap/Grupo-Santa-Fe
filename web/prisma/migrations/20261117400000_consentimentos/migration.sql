-- 17/11/2026 — Paridade bloco 4: termo de consentimento (gêmeo de Prospecta/drizzle/0127_consentimentos.sql +
-- 0132_consentimentos_retirada.sql). Uma linha por registro: aceite do termo ou retirada (revogação) do consentimento.
--   - Prova do aceite: SÓ INCLUSÃO. O gatilho recusa UPDATE, DELETE e TRUNCATE; a retirada é uma linha nova
--     (tipo 'revogacao', com quem registrou e quando).
--   - Não guarda IP nem user-agent: só o tipo de aparelho ('celular', 'tablet', 'computador', 'desconhecido') e se a
--     senha foi criada junto. O aceite do primeiro acesso é gravado na MESMA transação que grava a senha.
--   - "usuarioId" SEM chave estrangeira, de propósito: excluir um usuário continua funcionando e a prova permanece.
-- Somente aditiva e idempotente: tabela, índices, função e gatilhos novos (IF NOT EXISTS / OR REPLACE / DROP TRIGGER
-- IF EXISTS + CREATE). Nenhuma tabela existente é alterada. RLS ligado e sem acesso para anon/authenticated (o
-- sistema lê pelo servidor, com o papel do banco). Não aplicada em banco real por esta sessão.
-- Reversão: DROP TABLE "consentimentos"; DROP FUNCTION consentimentos_somente_inclusao().

CREATE TABLE IF NOT EXISTS "consentimentos" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "versaoTermo" VARCHAR(40) NOT NULL,
    "registradoEm" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "canal" VARCHAR(20) NOT NULL,
    "aparelho" VARCHAR(12) NOT NULL DEFAULT 'desconhecido',
    "comSenha" BOOLEAN NOT NULL DEFAULT false,
    "tipo" VARCHAR(12) NOT NULL DEFAULT 'aceite',
    "registradoPor" TEXT,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consentimentos_canal_check" CHECK ("canal" IN ('definir_senha', 'login', 'admin', 'conta')),
    CONSTRAINT "consentimentos_aparelho_check" CHECK ("aparelho" IN ('celular', 'tablet', 'computador', 'desconhecido')),
    CONSTRAINT "consentimentos_tipo_check" CHECK ("tipo" IN ('aceite', 'revogacao')),
    CONSTRAINT "consentimentos_revogacao_com_autor" CHECK ("tipo" = 'aceite' OR ("registradoPor" IS NOT NULL AND "canal" IN ('admin', 'conta')))
);

CREATE INDEX IF NOT EXISTS "consentimentos_usuarioId_registradoEm_idx" ON "consentimentos" ("usuarioId", "registradoEm");
CREATE INDEX IF NOT EXISTS "consentimentos_versaoTermo_idx" ON "consentimentos" ("versaoTermo");

CREATE OR REPLACE FUNCTION consentimentos_somente_inclusao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CONSENTIMENTO_SO_INCLUSAO: o registro do termo não é alterado nem apagado';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "consentimentos_sem_alteracao" ON "consentimentos";
CREATE TRIGGER "consentimentos_sem_alteracao" BEFORE UPDATE OR DELETE ON "consentimentos"
  FOR EACH ROW EXECUTE FUNCTION consentimentos_somente_inclusao();

DROP TRIGGER IF EXISTS "consentimentos_sem_truncate" ON "consentimentos";
CREATE TRIGGER "consentimentos_sem_truncate" BEFORE TRUNCATE ON "consentimentos"
  FOR EACH STATEMENT EXECUTE FUNCTION consentimentos_somente_inclusao();

ALTER TABLE "consentimentos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "consentimentos" FROM anon;
    REVOKE ALL ON SEQUENCE "consentimentos_id_seq" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "consentimentos" FROM authenticated;
    REVOKE ALL ON SEQUENCE "consentimentos_id_seq" FROM authenticated;
  END IF;
END $$;
