-- 13/11/2026 — Paridade Central de Vendas (gêmeo de Prospecta/drizzle/0110_central_vendas.sql).
-- Somente aditiva e idempotente: cria tabelas novas (IF NOT EXISTS) e restrições guardadas; nenhuma
-- tabela ou dado existente é alterado ou apagado. Reversão: DROP TABLE das central_vendas_*.
-- Não aplicada em banco real por esta sessão (o dono aplica no Supabase).

CREATE TABLE IF NOT EXISTS "central_vendas_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "dados" TEXT NOT NULL DEFAULT '{}',
    "atualizadoPor" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_checklists" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "documentos" TEXT NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_produtos" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'empreendimento',
    "descricao" TEXT NOT NULL DEFAULT '',
    "cidade" VARCHAR(100),
    "precoMin" DECIMAL(15,2),
    "precoMax" DECIMAL(15,2),
    "requisitos" TEXT NOT NULL DEFAULT '',
    "condicoes" TEXT NOT NULL DEFAULT '',
    "checklistId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_produtos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_campanhas" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "canal" VARCHAR(60) NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "produtoId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_campanhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_contatos" (
    "chaveTelefone" VARCHAR(20) NOT NULL,
    "leadId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_contatos_pkey" PRIMARY KEY ("chaveTelefone")
);

CREATE TABLE IF NOT EXISTS "central_vendas_leads" (
    "leadId" TEXT NOT NULL,
    "statusAtendimento" VARCHAR(30) NOT NULL DEFAULT 'novo',
    "statusDocumental" VARCHAR(30) NOT NULL DEFAULT 'nao_iniciado',
    "statusAnalise" VARCHAR(20) NOT NULL DEFAULT 'nao_enviado',
    "origem" VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    "idExterno" VARCHAR(160),
    "campanha" VARCHAR(80),
    "produtoId" INTEGER,
    "checklistId" INTEGER,
    "conexaoId" TEXT,
    "cidade" VARCHAR(100),
    "renda" DECIMAL(15,2),
    "tipoRenda" VARCHAR(20),
    "fgts" DECIMAL(15,2),
    "estadoCivil" VARCHAR(40),
    "composicaoRenda" BOOLEAN,
    "lgpdConsentimento" BOOLEAN NOT NULL DEFAULT false,
    "lgpdConsentimentoEm" TIMESTAMP(3),
    "qualificacao" TEXT NOT NULL DEFAULT '{}',
    "operadorId" TEXT,
    "atribuidoEm" TIMESTAMP(3),
    "aguardandoHumanoDesde" TIMESTAMP(3),
    "primeiraMensagemEm" TIMESTAMP(3),
    "primeiraRespostaEm" TIMESTAMP(3),
    "primeiraRespostaHumanaEm" TIMESTAMP(3),
    "ultimaMensagemClienteEm" TIMESTAMP(3),
    "ultimaMensagemEnviadaEm" TIMESTAMP(3),
    "qualificadoEm" TIMESTAMP(3),
    "docsSolicitadosEm" TIMESTAMP(3),
    "docsCompletosEm" TIMESTAMP(3),
    "enviadoAnaliseEm" TIMESTAMP(3),
    "decisaoEm" TIMESTAMP(3),
    "decisaoPor" TEXT,
    "pendenciasAnalise" TEXT,
    "motivoReprovacao" TEXT,
    "motivoTransferencia" VARCHAR(60),
    "resumoTransferencia" TEXT,
    "semProgresso" INTEGER NOT NULL DEFAULT 0,
    "mensagensIa" INTEGER NOT NULL DEFAULT 0,
    "tokensConsumidos" INTEGER NOT NULL DEFAULT 0,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "optOutEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_leads_pkey" PRIMARY KEY ("leadId")
);

CREATE TABLE IF NOT EXISTS "central_vendas_documentos" (
    "id" SERIAL NOT NULL,
    "leadId" TEXT NOT NULL,
    "documentoClienteId" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "mensagemId" TEXT,
    "chave" VARCHAR(60),
    "confianca" DECIMAL(4,3),
    "aConferir" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_documentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_eventos" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "leadId" TEXT,
    "origem" VARCHAR(30) NOT NULL DEFAULT 'sistema',
    "payload" TEXT,
    "resultado" VARCHAR(30) NOT NULL DEFAULT 'ok',
    "erro" TEXT,
    "chave" VARCHAR(200),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_eventos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_fila" (
    "id" SERIAL NOT NULL,
    "chave" VARCHAR(200) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'mensagem',
    "leadId" TEXT,
    "numero" VARCHAR(30),
    "proativa" BOOLEAN NOT NULL DEFAULT false,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoErro" TEXT,
    "mensagemId" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_fila_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_sequencias" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "passos" TEXT NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_sequencias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "central_vendas_limites" (
    "chave" VARCHAR(120) NOT NULL,
    "janela" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "central_vendas_limites_pkey" PRIMARY KEY ("chave","janela")
);

CREATE TABLE IF NOT EXISTS "central_vendas_tokens_mes" (
    "mes" VARCHAR(7) NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_vendas_tokens_mes_pkey" PRIMARY KEY ("mes")
);

CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_checklists_slug_key" ON "central_vendas_checklists"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_produtos_slug_key" ON "central_vendas_produtos"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_campanhas_codigo_key" ON "central_vendas_campanhas"("codigo");
CREATE INDEX IF NOT EXISTS "central_vendas_leads_operadorId_idx" ON "central_vendas_leads"("operadorId");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_documentos_arquivoId_key" ON "central_vendas_documentos"("arquivoId");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_documentos_mensagemId_key" ON "central_vendas_documentos"("mensagemId");
CREATE INDEX IF NOT EXISTS "central_vendas_documentos_leadId_idx" ON "central_vendas_documentos"("leadId");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_eventos_chave_key" ON "central_vendas_eventos"("chave");
CREATE INDEX IF NOT EXISTS "central_vendas_eventos_leadId_idx" ON "central_vendas_eventos"("leadId");
CREATE INDEX IF NOT EXISTS "central_vendas_eventos_criadoEm_idx" ON "central_vendas_eventos"("criadoEm");
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_fila_chave_key" ON "central_vendas_fila"("chave");
CREATE INDEX IF NOT EXISTS "central_vendas_fila_status_proximaTentativaEm_idx" ON "central_vendas_fila"("status", "proximaTentativaEm");
CREATE INDEX IF NOT EXISTS "central_vendas_fila_leadId_idx" ON "central_vendas_fila"("leadId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_produtos_checklistId_fkey') THEN
    ALTER TABLE "central_vendas_produtos" ADD CONSTRAINT "central_vendas_produtos_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "central_vendas_checklists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_campanhas_produtoId_fkey') THEN
    ALTER TABLE "central_vendas_campanhas" ADD CONSTRAINT "central_vendas_campanhas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "central_vendas_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_leadId_fkey') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_produtoId_fkey') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "central_vendas_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_checklistId_fkey') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "central_vendas_checklists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Valores válidos dos status e decisão da análise só com o humano que decidiu (nenhuma automação grava decisaoPor).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_config_unica') THEN
    ALTER TABLE "central_vendas_config" ADD CONSTRAINT "central_vendas_config_unica" CHECK ("id" = 1);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_produtos_tipo') THEN
    ALTER TABLE "central_vendas_produtos" ADD CONSTRAINT "central_vendas_produtos_tipo" CHECK ("tipo" IN ('empreendimento', 'produto'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_status_atendimento') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_status_atendimento" CHECK ("statusAtendimento" IN ('novo', 'em_atendimento_ia', 'em_atendimento_humano', 'aguardando_cliente', 'sem_resposta', 'encerrado'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_status_documental') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_status_documental" CHECK ("statusDocumental" IN ('nao_iniciado', 'aguardando_documentos', 'parcial', 'completo'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_status_analise') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_status_analise" CHECK ("statusAnalise" IN ('nao_enviado', 'em_analise', 'pendente', 'aprovado', 'reprovado'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_leads_decisao_humana') THEN
    ALTER TABLE "central_vendas_leads" ADD CONSTRAINT "central_vendas_leads_decisao_humana" CHECK ("statusAnalise" NOT IN ('pendente', 'aprovado', 'reprovado') OR "decisaoPor" IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_fila_status') THEN
    ALTER TABLE "central_vendas_fila" ADD CONSTRAINT "central_vendas_fila_status" CHECK ("status" IN ('pendente', 'processando', 'concluido', 'falhou', 'descartado', 'incerto'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'central_vendas_sequencias_tipo') THEN
    ALTER TABLE "central_vendas_sequencias" ADD CONSTRAINT "central_vendas_sequencias_tipo" CHECK ("tipo" IN ('followup_aprovado', 'sem_resposta', 'reativacao'));
  END IF;
END $$;

-- A mesma origem + ID externo (site/Logyca) nunca cria dois registros.
CREATE UNIQUE INDEX IF NOT EXISTS "central_vendas_leads_origem_externo_uidx" ON "central_vendas_leads" ("origem", "idExterno") WHERE "idExterno" IS NOT NULL;

-- Dados internos servidos só pelo aplicativo (nunca pela API pública do Supabase).
ALTER TABLE "central_vendas_campanhas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_contatos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_limites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_produtos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_sequencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_vendas_tokens_mes" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "central_vendas_campanhas", "central_vendas_checklists", "central_vendas_config", "central_vendas_contatos", "central_vendas_documentos", "central_vendas_eventos", "central_vendas_fila", "central_vendas_leads", "central_vendas_limites", "central_vendas_produtos", "central_vendas_sequencias", "central_vendas_tokens_mes" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "central_vendas_campanhas", "central_vendas_checklists", "central_vendas_config", "central_vendas_contatos", "central_vendas_documentos", "central_vendas_eventos", "central_vendas_fila", "central_vendas_leads", "central_vendas_limites", "central_vendas_produtos", "central_vendas_sequencias", "central_vendas_tokens_mes" FROM authenticated;
  END IF;
END $$;
