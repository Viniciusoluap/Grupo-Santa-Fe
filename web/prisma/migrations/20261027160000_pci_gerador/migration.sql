-- Lote 2, correção 03 (AD-06): Gerador de PCI. Modelos oficiais da PCI (CAIXA)
-- versionados, rascunho do formulário e PCIs geradas por obra. Arquivos guardados
-- no próprio banco e servidos por rota autenticada. Aditiva e idempotente; o envio
-- de PCI da obra (obra_pci / obra_pci_versoes) não muda.

CREATE TABLE IF NOT EXISTS "pci_modelos" (
  "id" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "formato" VARCHAR(5) NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "hash" VARCHAR(64) NOT NULL,
  "dados" BYTEA NOT NULL,
  "atual" BOOLEAN NOT NULL DEFAULT false,
  "observacao" TEXT,
  "enviadoPorId" TEXT,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pci_modelos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pci_modelos_formato_check" CHECK ("formato" IN ('xls', 'xlsm', 'xlsb')),
  CONSTRAINT "pci_modelos_tamanho_check" CHECK ("tamanho" BETWEEN 1 AND 8388608 AND octet_length("dados") BETWEEN 1 AND 8388608)
);
CREATE UNIQUE INDEX IF NOT EXISTS "pci_modelos_versao_key" ON "pci_modelos"("versao");
-- No máximo um modelo atual.
CREATE UNIQUE INDEX IF NOT EXISTS "pci_modelos_atual_unico" ON "pci_modelos"("atual") WHERE "atual";

CREATE TABLE IF NOT EXISTS "pci_gerador_rascunhos" (
  "obraId" TEXT NOT NULL,
  "dados" JSONB NOT NULL,
  "atualizadoPorId" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pci_gerador_rascunhos_pkey" PRIMARY KEY ("obraId")
);

CREATE TABLE IF NOT EXISTS "pci_geradas" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL,
  "modeloId" TEXT,
  "modeloVersao" INTEGER NOT NULL,
  "dados" JSONB NOT NULL,
  "avisos" JSONB NOT NULL DEFAULT '[]',
  "planilhaNome" VARCHAR(255) NOT NULL,
  "planilhaFormato" VARCHAR(5) NOT NULL,
  "planilha" BYTEA NOT NULL,
  "pdfNome" VARCHAR(255) NOT NULL,
  "pdf" BYTEA NOT NULL,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pci_geradas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pci_geradas_formato_check" CHECK ("planilhaFormato" IN ('xls', 'xlsm'))
);
CREATE INDEX IF NOT EXISTS "pci_geradas_obraId_criadoEm_idx" ON "pci_geradas"("obraId", "criadoEm");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pci_gerador_rascunhos_obraId_fkey') THEN
    ALTER TABLE "pci_gerador_rascunhos" ADD CONSTRAINT "pci_gerador_rascunhos_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pci_geradas_obraId_fkey') THEN
    ALTER TABLE "pci_geradas" ADD CONSTRAINT "pci_geradas_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pci_geradas_modeloId_fkey') THEN
    ALTER TABLE "pci_geradas" ADD CONSTRAINT "pci_geradas_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "pci_modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Conteúdo privado servido somente pelas rotas autenticadas do aplicativo.
ALTER TABLE "pci_modelos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pci_gerador_rascunhos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pci_geradas" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "pci_modelos", "pci_gerador_rascunhos", "pci_geradas" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "pci_modelos", "pci_gerador_rascunhos", "pci_geradas" FROM authenticated;
  END IF;
END $$;
