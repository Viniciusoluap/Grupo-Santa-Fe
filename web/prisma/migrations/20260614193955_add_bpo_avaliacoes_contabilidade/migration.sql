-- CreateTable
CREATE TABLE "bpo_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "responsavel" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT NOT NULL,
    "servicos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "honorarios" REAL NOT NULL,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "dataInicio" DATETIME NOT NULL,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "bpo_lancamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "vencimento" DATETIME NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pagoEm" DATETIME,
    "competencia" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bpo_lancamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "bpo_clientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "areaConstruida" REAL,
    "areaTerreno" REAL,
    "quartos" INTEGER,
    "banheiros" INTEGER,
    "vagas" INTEGER,
    "caracteristicas" TEXT NOT NULL DEFAULT '',
    "metodologia" TEXT NOT NULL DEFAULT 'comparativo',
    "valorEstimado" REAL,
    "avaliador" TEXT NOT NULL,
    "dataVistoria" DATETIME,
    "prazoEntrega" DATETIME,
    "dataEntrega" DATETIME,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "laudo" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "data" DATETIME NOT NULL,
    "vencimento" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "formaPagamento" TEXT,
    "referencia" TEXT,
    "competencia" TEXT NOT NULL,
    "fornecedor" TEXT,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_numero_key" ON "avaliacoes"("numero");
