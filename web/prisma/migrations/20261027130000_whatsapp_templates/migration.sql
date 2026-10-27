CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "finalidade" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_templates_slug_key" ON "whatsapp_templates"("slug");
CREATE INDEX IF NOT EXISTS "whatsapp_templates_finalidade_ativo_idx" ON "whatsapp_templates"("finalidade", "ativo");

INSERT INTO "whatsapp_templates" ("id", "slug", "nome", "finalidade", "conteudo") VALUES
('padrao-captacao','captacao','Boas-vindas ao lead','Captação',E'Olá, {{nome}}! Tudo bem?\n\nSou {{corretor}}, do Grupo Santa Fé.\n\nRecebemos seu contato e será um prazer ajudar você a encontrar a melhor solução para seu objetivo. Nosso atendimento é personalizado, e quero entender melhor sua necessidade para apresentar as possibilidades mais adequadas e orientar você durante todo o processo.\n\nPodemos começar com algumas perguntas rápidas?'),
('padrao-followup48h','followup48h','Follow-up 48h','Acompanhamento','Olá, {{nome}}! Tudo bem? Estou retomando nosso atendimento sobre {{servicos}}. Separei algumas possibilidades que podem fazer sentido para você. Podemos conversar por alguns minutos para avançarmos?'),
('padrao-visita','visita','Confirmação de visita','Agenda','Olá, {{nome}}! Sua visita está confirmada para o dia {{dia}}, às {{horario}}. Qualquer dúvida, estou à disposição!'),
('padrao-proposta','proposta','Envio de proposta','Negociação','Olá, {{nome}}! Preparei a proposta referente a {{imovel}}, com as condições alinhadas para sua análise. Posso enviar os detalhes e esclarecer os próximos passos com você?'),
('padrao-financiamento','financiamento','Atualização do financiamento','Financiamento','Olá, {{nome}}! Temos uma atualização sobre seu financiamento junto ao {{banco}}. Quero explicar o status e orientar você sobre a próxima etapa. Qual é o melhor horário para conversarmos?'),
('padrao-documentos','documentos','Lembrete de documentos','Documentação','Olá, {{nome}}! Para continuarmos seu atendimento, ainda precisamos destes documentos: {{documentos}}. Assim que você enviar, conseguiremos avançar para a próxima etapa. Se precisar de ajuda, estou à disposição.')
ON CONFLICT ("slug") DO NOTHING;
