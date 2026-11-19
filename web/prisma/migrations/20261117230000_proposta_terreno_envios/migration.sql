-- 17/11/2026 — Paridade com a Prospecta (bloco 2, EPIC-024 S-06 / migração 0120 de lá): proposta formal de aquisição
-- do terreno enviada por e-mail com o PDF. Registro de cada envio (data, destinatário, situação, motivo da falha, hash
-- do PDF) em tabela própria — fora do JSON da negociação, que a aba reescreve ao salvar.
-- (A Prospecta também acrescenta 'proposta_terreno' ao enum de email_logs; o Santa Fé não tem essa tabela de log de
-- e-mails, então o registro fica só nesta tabela.)
-- Somente aditiva e idempotente: tabela e índice novos (IF NOT EXISTS); nada existente é alterado ou apagado.
-- Reversão: DROP TABLE "estudos_incorporacao_propostas_envios" (nenhuma outra tabela depende dela).
CREATE TABLE IF NOT EXISTS "estudos_incorporacao_propostas_envios" (
  "id" TEXT NOT NULL,
  "estudoId" TEXT NOT NULL,
  -- id da proposta dentro de "negociacaoTerrenoJson"
  "propostaId" VARCHAR(80) NOT NULL,
  "destinatario" VARCHAR(254) NOT NULL,
  "status" VARCHAR(10) NOT NULL CHECK ("status" IN ('enviado', 'falhou')),
  "motivo" VARCHAR(400),
  "dataEmissao" VARCHAR(10) NOT NULL CHECK ("dataEmissao" ~ '^\d{4}-\d{2}-\d{2}$'),
  "pdfSha256" VARCHAR(64) NOT NULL,
  "enviadoPorId" TEXT,
  "enviadoPorNome" VARCHAR(255),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "estudos_incorporacao_propostas_envios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estudos_incorporacao_propostas_envios_estudoId_fkey" FOREIGN KEY ("estudoId") REFERENCES "estudos_incorporacao"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "estudos_incorporacao_propostas_envios_estudoId_propostaId_idx" ON "estudos_incorporacao_propostas_envios" ("estudoId", "propostaId");

-- Supabase: só o servidor (Prisma) lê e grava; a API pública fica sem acesso.
ALTER TABLE "estudos_incorporacao_propostas_envios" ENABLE ROW LEVEL SECURITY;
