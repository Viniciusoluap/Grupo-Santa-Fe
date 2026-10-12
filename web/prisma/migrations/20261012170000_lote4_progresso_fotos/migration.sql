-- EPIC-020 Lote 4 (itens 27 e 28) — progresso por incidência e fotos da obra.
-- Somente aditiva e idempotente. Fotos: bytes na tabela "arquivos" (banco
-- próprio, sem storage externo), metadados em "obra_fotos".
ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "progressoMedido" DECIMAL(9,6);

CREATE TABLE IF NOT EXISTS "obra_progresso_itens" (
  "obraId" TEXT NOT NULL,
  "chave" VARCHAR(40) NOT NULL,
  "incidencia" DECIMAL(7,4) NOT NULL,
  "execucao" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "atualizadoPorId" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_progresso_itens_pkey" PRIMARY KEY ("obraId", "chave"),
  CONSTRAINT "obra_progresso_itens_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "obra_progresso_itens_incidencia_range" CHECK ("incidencia" >= 0 AND "incidencia" <= 100),
  CONSTRAINT "obra_progresso_itens_execucao_range" CHECK ("execucao" >= 0 AND "execucao" <= 100)
);

CREATE TABLE IF NOT EXISTS "obra_progresso_historico" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL,
  "progresso" DECIMAL(9,6) NOT NULL,
  "somaIncidencia" DECIMAL(9,4) NOT NULL,
  "itens" JSONB NOT NULL,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_progresso_historico_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obra_progresso_historico_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "obra_progresso_historico_obraId_criadoEm_idx" ON "obra_progresso_historico"("obraId", "criadoEm");

CREATE TABLE IF NOT EXISTS "obra_fotos" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL,
  "arquivoId" TEXT NOT NULL,
  "legenda" TEXT,
  "tiradaEm" TIMESTAMP(3) NOT NULL,
  "incluirNoRelatorio" BOOLEAN NOT NULL DEFAULT true,
  "enviadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_fotos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obra_fotos_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "obra_fotos_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "arquivos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "obra_fotos_arquivoId_key" ON "obra_fotos"("arquivoId");
CREATE INDEX IF NOT EXISTS "obra_fotos_obraId_tiradaEm_idx" ON "obra_fotos"("obraId", "tiradaEm");

-- Padrão do projeto: RLS ligado, sem políticas — acesso só pelo servidor.
ALTER TABLE "obra_progresso_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_progresso_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_fotos" ENABLE ROW LEVEL SECURITY;
