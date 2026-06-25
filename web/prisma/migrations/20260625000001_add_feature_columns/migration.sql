-- Visita: tipoVisita + colaboradorNome
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "tipoVisita" TEXT NOT NULL DEFAULT 'imovel';
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "colaboradorNome" TEXT;

-- Lead: senhaAcesso
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "senhaAcesso" TEXT;

-- Corretor: senhaAcesso
ALTER TABLE "corretores" ADD COLUMN IF NOT EXISTS "senhaAcesso" TEXT;

-- Comissao: beneficiario, tipoNegocio, corretorId nullable
ALTER TABLE "comissoes" ADD COLUMN IF NOT EXISTS "beneficiario" TEXT NOT NULL DEFAULT 'corretor';
ALTER TABLE "comissoes" ADD COLUMN IF NOT EXISTS "tipoNegocio" TEXT NOT NULL DEFAULT 'venda_imovel';
ALTER TABLE "comissoes" ALTER COLUMN "corretorId" DROP NOT NULL;

-- Projeto: checklist JSON
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "checklist" TEXT NOT NULL DEFAULT '[]';

-- Contrato: contratoAssinadoUrl
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "contratoAssinadoUrl" TEXT;

-- Usuario: permissoes JSON
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "permissoes" TEXT NOT NULL DEFAULT '[]';
