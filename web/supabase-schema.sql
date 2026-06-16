-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "imoveis" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "precoNegociavel" BOOLEAN NOT NULL DEFAULT false,
    "condominio" DOUBLE PRECISION,
    "iptu" DOUBLE PRECISION,
    "area" DOUBLE PRECISION NOT NULL,
    "areaTotal" DOUBLE PRECISION,
    "quartos" INTEGER,
    "suites" INTEGER,
    "banheiros" INTEGER,
    "vagas" INTEGER,
    "rua" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL DEFAULT 'Canaã dos Carajás',
    "estado" TEXT NOT NULL DEFAULT 'PA',
    "cep" TEXT,
    "features" TEXT NOT NULL DEFAULT '[]',
    "imagens" TEXT NOT NULL DEFAULT '[]',
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "publicadoSite" BOOLEAN NOT NULL DEFAULT true,
    "publicadoZap" BOOLEAN NOT NULL DEFAULT false,
    "publicadoOlx" BOOLEAN NOT NULL DEFAULT false,
    "publicadoViva" BOOLEAN NOT NULL DEFAULT false,
    "corretorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "servico" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "origem" TEXT NOT NULL DEFAULT 'site',
    "corretorId" TEXT,
    "imovelInteresseId" TEXT,
    "orcamento" DOUBLE PRECISION,
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT NOT NULL,

    CONSTRAINT "interacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "imovelId" TEXT,
    "corretorId" TEXT,
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "agendadaPara" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corretores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "creci" TEXT NOT NULL,
    "foto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "especialidades" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corretores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" TEXT NOT NULL,
    "corretorId" TEXT NOT NULL,
    "contratoId" TEXT,
    "imovel" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagamentoEm" TIMESTAMP(3),
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financiamentos" (
    "id" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteCpf" TEXT,
    "clienteTel" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "imovel" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "valorImovel" DOUBLE PRECISION NOT NULL,
    "valorFinanciado" DOUBLE PRECISION NOT NULL,
    "entrada" DOUBLE PRECISION NOT NULL,
    "taxa" DOUBLE PRECISION NOT NULL,
    "prazo" INTEGER NOT NULL,
    "parcela" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'analise_credito',
    "protocolo" TEXT,
    "corretorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financiamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "financiamentoId" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "concluidoEm" TIMESTAMP(3),
    "notas" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'orcamento',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "engenheiroResp" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "dataPrevisaoFim" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "descricao" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_etapas" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obra_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_diario" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "fotos" TEXT NOT NULL DEFAULT '[]',
    "responsavel" TEXT NOT NULL,
    "clima" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obra_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'orcamento',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "engenheiro" TEXT NOT NULL,
    "valorProjeto" DOUBLE PRECISION NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prazoEntrega" TIMESTAMP(3),
    "descricao" TEXT NOT NULL DEFAULT '',
    "arquivos" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regularizacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'analise',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "matricula" TEXT,
    "cartorio" TEXT,
    "responsavel" TEXT NOT NULL,
    "valorServico" DOUBLE PRECISION NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previsaoFim" TIMESTAMP(3),
    "descricao" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regularizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_documentos" (
    "id" TEXT NOT NULL,
    "regularizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "observacao" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reg_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "parteA" TEXT NOT NULL,
    "parteADoc" TEXT,
    "parteB" TEXT NOT NULL,
    "parteBDoc" TEXT,
    "imovelId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "vencimento" TIMESTAMP(3),
    "descricao" TEXT NOT NULL DEFAULT '',
    "clausulas" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agregador_imoveis" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DOUBLE PRECISION,
    "precoTexto" TEXT,
    "area" DOUBLE PRECISION,
    "tipo" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL DEFAULT 'Canaã dos Carajás',
    "estado" TEXT NOT NULL DEFAULT 'PA',
    "fonte" TEXT NOT NULL,
    "urlFonte" TEXT,
    "imagens" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "documentoTipo" TEXT NOT NULL DEFAULT 'nenhum',
    "documentoObs" TEXT,
    "contatoNome" TEXT,
    "contatoTel" TEXT,
    "notas" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agregador_imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'geral',

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpo_clientes" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "responsavel" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT NOT NULL,
    "servicos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "honorarios" DOUBLE PRECISION NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bpo_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpo_lancamentos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pagoEm" TIMESTAMP(3),
    "competencia" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpo_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'solicitada',
    "clienteNome" TEXT NOT NULL,
    "clienteCpf" TEXT,
    "clienteTel" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "endereco" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL DEFAULT 'Canaã dos Carajás',
    "estado" TEXT NOT NULL DEFAULT 'PA',
    "areaConstruida" DOUBLE PRECISION,
    "areaTerreno" DOUBLE PRECISION,
    "quartos" INTEGER,
    "banheiros" INTEGER,
    "vagas" INTEGER,
    "caracteristicas" TEXT NOT NULL DEFAULT '',
    "metodologia" TEXT NOT NULL DEFAULT 'comparativo',
    "valorEstimado" DOUBLE PRECISION,
    "avaliador" TEXT NOT NULL,
    "dataVistoria" TIMESTAMP(3),
    "prazoEntrega" TIMESTAMP(3),
    "dataEntrega" TIMESTAMP(3),
    "observacoes" TEXT NOT NULL DEFAULT '',
    "laudo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "formaPagamento" TEXT,
    "referencia" TEXT,
    "competencia" TEXT NOT NULL,
    "fornecedor" TEXT,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_slug_key" ON "imoveis"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "corretores_email_key" ON "corretores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_chave_key" ON "configuracoes"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_numero_key" ON "avaliacoes"("numero");

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_imovelInteresseId_fkey" FOREIGN KEY ("imovelInteresseId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financiamentos" ADD CONSTRAINT "financiamentos_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_financiamentoId_fkey" FOREIGN KEY ("financiamentoId") REFERENCES "financiamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_diario" ADD CONSTRAINT "obra_diario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_documentos" ADD CONSTRAINT "reg_documentos_regularizacaoId_fkey" FOREIGN KEY ("regularizacaoId") REFERENCES "regularizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpo_lancamentos" ADD CONSTRAINT "bpo_lancamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "bpo_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

