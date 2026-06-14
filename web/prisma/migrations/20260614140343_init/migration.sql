-- CreateTable
CREATE TABLE "imoveis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "precoNegociavel" BOOLEAN NOT NULL DEFAULT false,
    "condominio" REAL,
    "iptu" REAL,
    "area" REAL NOT NULL,
    "areaTotal" REAL,
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
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "imoveis_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "servico" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "origem" TEXT NOT NULL DEFAULT 'site',
    "corretorId" TEXT,
    "imovelInteresseId" TEXT,
    "orcamento" REAL,
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "leads_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_imovelInteresseId_fkey" FOREIGN KEY ("imovelInteresseId") REFERENCES "imoveis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT NOT NULL,
    CONSTRAINT "interacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "imovelId" TEXT,
    "corretorId" TEXT,
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "agendadaPara" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "visitas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visitas_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visitas_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "corretores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "creci" TEXT NOT NULL,
    "foto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "especialidades" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corretorId" TEXT NOT NULL,
    "contratoId" TEXT,
    "imovel" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "percentual" REAL NOT NULL DEFAULT 6,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "vencimento" DATETIME NOT NULL,
    "pagamentoEm" DATETIME,
    "notas" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "comissoes_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "comissoes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "financiamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteNome" TEXT NOT NULL,
    "clienteCpf" TEXT,
    "clienteTel" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "imovel" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "valorImovel" REAL NOT NULL,
    "valorFinanciado" REAL NOT NULL,
    "entrada" REAL NOT NULL,
    "taxa" REAL NOT NULL,
    "prazo" INTEGER NOT NULL,
    "parcela" REAL,
    "status" TEXT NOT NULL DEFAULT 'analise_credito',
    "protocolo" TEXT,
    "corretorId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "financiamentos_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "financiamentoId" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "concluidoEm" DATETIME,
    "notas" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "checklist_items_financiamentoId_fkey" FOREIGN KEY ("financiamentoId") REFERENCES "financiamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'orcamento',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "area" REAL NOT NULL,
    "valorTotal" REAL NOT NULL,
    "valorPago" REAL NOT NULL DEFAULT 0,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "engenheiroResp" TEXT NOT NULL,
    "dataInicio" DATETIME,
    "dataPrevisaoFim" DATETIME,
    "dataConclusao" DATETIME,
    "descricao" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "obra_etapas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "percentual" REAL NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_etapas_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "obra_diario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "fotos" TEXT NOT NULL DEFAULT '[]',
    "responsavel" TEXT NOT NULL,
    "clima" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_diario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'orcamento',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "engenheiro" TEXT NOT NULL,
    "valorProjeto" REAL NOT NULL,
    "valorPago" REAL NOT NULL DEFAULT 0,
    "prazoEntrega" DATETIME,
    "descricao" TEXT NOT NULL DEFAULT '',
    "arquivos" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "regularizacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'analise',
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "matricula" TEXT,
    "cartorio" TEXT,
    "responsavel" TEXT NOT NULL,
    "valorServico" REAL NOT NULL,
    "valorPago" REAL NOT NULL DEFAULT 0,
    "previsaoFim" DATETIME,
    "descricao" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reg_documentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regularizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "observacao" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "reg_documentos_regularizacaoId_fkey" FOREIGN KEY ("regularizacaoId") REFERENCES "regularizacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "parteA" TEXT NOT NULL,
    "parteADoc" TEXT,
    "parteB" TEXT NOT NULL,
    "parteBDoc" TEXT,
    "imovelId" TEXT,
    "valor" REAL NOT NULL,
    "vencimento" DATETIME,
    "descricao" TEXT NOT NULL DEFAULT '',
    "clausulas" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "contratos_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agregador_imoveis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" REAL,
    "precoTexto" TEXT,
    "area" REAL,
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
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'geral'
);

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_slug_key" ON "imoveis"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "corretores_email_key" ON "corretores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_chave_key" ON "configuracoes"("chave");
