-- 17/11/2026 — Paridade com a Prospecta (bloco 2, EPIC-024 S-02 / migração 0119 de lá): logotipo próprio de cada
-- empreendimento da Incorporação. Tabela separada (nunca na linha do estudo): a listagem lê o estudo inteiro e as
-- versões do estudo copiam a linha — os bytes do logotipo não podem ir junto. Guarda o arquivo original (PNG, JPG ou
-- SVG) e a imagem de exibição em PNG gerada no navegador, a única servida aos cartões. Um logotipo ativo por estudo
-- ("excluidoEm" nulo); trocar ou excluir só marca "excluidoEm" no anterior.
-- Somente aditiva e idempotente: cria uma tabela e índices novos (IF NOT EXISTS); nada existente é alterado ou apagado.
-- Reversão: DROP TABLE "estudos_incorporacao_logos" (nenhuma outra tabela depende dela).
CREATE TABLE IF NOT EXISTS "estudos_incorporacao_logos" (
  "id" TEXT NOT NULL,
  -- o logotipo sai junto com a exclusão definitiva do estudo
  "estudoId" TEXT NOT NULL,
  "mime" VARCHAR(40) NOT NULL CHECK ("mime" IN ('image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf')),
  "nome" VARCHAR(255) NOT NULL,
  "origem" VARCHAR(10) NOT NULL DEFAULT 'envio' CHECK ("origem" IN ('envio', 'ia')),
  "sha256" VARCHAR(64) NOT NULL,
  "tamanho" INTEGER NOT NULL CHECK ("tamanho" > 0),
  "original" BYTEA NOT NULL,
  "exibicaoPng" BYTEA NOT NULL,
  "exibicaoSha256" VARCHAR(64) NOT NULL,
  "largura" INTEGER,
  "altura" INTEGER,
  "enviadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "excluidoEm" TIMESTAMP(3),
  CONSTRAINT "estudos_incorporacao_logos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estudos_incorporacao_logos_estudoId_fkey" FOREIGN KEY ("estudoId") REFERENCES "estudos_incorporacao"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "estudos_incorporacao_logos_estudoId_idx" ON "estudos_incorporacao_logos" ("estudoId");
CREATE INDEX IF NOT EXISTS "estudos_incorporacao_logos_ativo_idx" ON "estudos_incorporacao_logos" ("estudoId") WHERE "excluidoEm" IS NULL;

-- Supabase: só o servidor (Prisma) lê e grava; a API pública fica sem acesso.
ALTER TABLE "estudos_incorporacao_logos" ENABLE ROW LEVEL SECURITY;
