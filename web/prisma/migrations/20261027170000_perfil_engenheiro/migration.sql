-- Lote 2, correção 04 (AD-02): perfil Engenheiro = colaborador + dados profissionais
-- e documentos do usuário guardados no próprio banco. Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS "perfis_engenheiro" (
  "usuarioId" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "telefone" VARCHAR(20),
  "cep" VARCHAR(9),
  "logradouro" VARCHAR(255),
  "numero" VARCHAR(20),
  "complemento" VARCHAR(120),
  "bairro" VARCHAR(120),
  "cidade" VARCHAR(120),
  "uf" VARCHAR(2),
  "crea" VARCHAR(30),
  "creaUf" VARCHAR(2),
  "creasAdicionais" JSONB NOT NULL DEFAULT '[]',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "atualizadoPorId" TEXT,
  CONSTRAINT "perfis_engenheiro_pkey" PRIMARY KEY ("usuarioId")
);

CREATE TABLE IF NOT EXISTS "documentos_usuario" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "categoria" VARCHAR(30) NOT NULL,
  "nomeOriginal" VARCHAR(255) NOT NULL,
  "mime" VARCHAR(150) NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "conteudo" BYTEA NOT NULL,
  "enviadoPorId" TEXT,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentos_usuario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documentos_usuario_categoria_check" CHECK ("categoria" IN ('documento_pessoal', 'anuidade_crea', 'carteirinha_crea', 'outros')),
  CONSTRAINT "documentos_usuario_tamanho_check" CHECK ("tamanho" BETWEEN 1 AND 15728640 AND octet_length("conteudo") BETWEEN 1 AND 15728640)
);

CREATE INDEX IF NOT EXISTS "documentos_usuario_usuarioId_categoria_idx" ON "documentos_usuario"("usuarioId", "categoria");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perfis_engenheiro_usuarioId_fkey') THEN
    ALTER TABLE "perfis_engenheiro" ADD CONSTRAINT "perfis_engenheiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_usuario_usuarioId_fkey') THEN
    ALTER TABLE "documentos_usuario" ADD CONSTRAINT "documentos_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_usuario_enviadoPorId_fkey') THEN
    ALTER TABLE "documentos_usuario" ADD CONSTRAINT "documentos_usuario_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Conteúdo privado servido somente pela rota autenticada do aplicativo.
ALTER TABLE "perfis_engenheiro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documentos_usuario" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "perfis_engenheiro", "documentos_usuario" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "perfis_engenheiro", "documentos_usuario" FROM authenticated;
  END IF;
END $$;
