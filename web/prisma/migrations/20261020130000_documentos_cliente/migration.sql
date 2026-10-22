ALTER TABLE leads ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS "visivelCliente" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "solicitadoEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "emailSolicitadoEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS legado BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS documentos_cliente (id TEXT PRIMARY KEY, "leadId" TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT, tipo TEXT NOT NULL, "visivelCliente" BOOLEAN NOT NULL DEFAULT true, "solicitadoEm" TIMESTAMP(3), "emailSolicitadoEm" TIMESTAMP(3), "arquivoId" TEXT REFERENCES arquivos(id) ON DELETE RESTRICT, "enviadoEm" TIMESTAMP(3), "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS documentos_cliente_leadId_tipo_key ON documentos_cliente("leadId",tipo);
CREATE INDEX IF NOT EXISTS documentos_cliente_arquivoId_idx ON documentos_cliente("arquivoId");

CREATE TABLE IF NOT EXISTS documentos_cliente_versoes (id TEXT PRIMARY KEY, "leadId" TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT, "tipoChecklist" TEXT NOT NULL, "itemId" TEXT NOT NULL, "arquivoId" TEXT NOT NULL UNIQUE REFERENCES arquivos(id) ON DELETE RESTRICT, "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS documentos_cliente_versoes_leadId_itemId_idx ON documentos_cliente_versoes("leadId","itemId");
ALTER TABLE documentos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente_versoes ENABLE ROW LEVEL SECURITY;
