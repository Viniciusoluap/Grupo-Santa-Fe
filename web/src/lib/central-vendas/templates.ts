// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/shared/central-vendas/templates.ts).
// Textos padrão das mensagens automáticas. A tela grava a versão editada em
// whatsapp_templates (mesmo slug), que passa a valer. Só usam variáveis já aceitas pela Central WhatsApp:
// {{nome}} (primeiro nome), {{documentos}} (lista de pendentes ou pendências do analista) e {{corretor}} (operador).
export type TemplateCentral = { slug: string; nome: string; conteudo: string };

export const CATEGORIA_TEMPLATES_CENTRAL = "Central de Vendas";

export const TEMPLATES_CENTRAL: TemplateCentral[] = [
  { slug: "cv-saudacao", nome: "Saudação e consentimento LGPD", conteudo: "Olá, {{nome}}! Aqui é do Grupo Santa Fé. Para continuar o atendimento, preciso do seu consentimento para usar seus dados pessoais só para este atendimento, conforme a LGPD. Você autoriza? Responda SIM para seguir. Para não receber mais mensagens, responda SAIR." },
  { slug: "cv-documentos-pendentes", nome: "Lista de documentos pendentes", conteudo: "{{nome}}, para seguirmos, envie por aqui foto ou PDF destes documentos: {{documentos}}." },
  { slug: "cv-lembrete-documentos", nome: "Lembrete de documentos", conteudo: "Olá, {{nome}}! Ainda faltam estes documentos para seguirmos: {{documentos}}. Pode enviar por aqui mesmo." },
  { slug: "cv-confirmacao-analise", nome: "Documentação completa — enviada para análise", conteudo: "{{nome}}, recebemos todos os documentos e seu cadastro foi encaminhado para análise. Avisaremos por aqui assim que houver retorno." },
  { slug: "cv-analise-pendente", nome: "Análise com pendências", conteudo: "{{nome}}, a análise apontou estas pendências: {{documentos}}. Envie por aqui assim que puder para continuarmos." },
  { slug: "cv-analise-aprovado", nome: "Análise concluída — resultado positivo", conteudo: "{{nome}}, sua análise foi concluída com resultado positivo! {{corretor}}, da nossa equipe, vai falar com você sobre os próximos passos." },
  { slug: "cv-analise-reprovado", nome: "Análise concluída — retorno neutro", conteudo: "{{nome}}, sua análise foi concluída. {{corretor}}, da nossa equipe, vai conversar com você por aqui sobre as possibilidades." },
  { slug: "cv-transferencia-humano", nome: "Transferência para atendente", conteudo: "{{nome}}, vou passar seu atendimento para {{corretor}}, da nossa equipe, que continua com você por aqui." },
  { slug: "cv-followup-aprovado", nome: "Follow-up após aprovação", conteudo: "Olá, {{nome}}! Passando para saber se ficou alguma dúvida sobre os próximos passos. {{corretor}} está à disposição." },
  { slug: "cv-sem-resposta", nome: "Cliente sem resposta", conteudo: "Olá, {{nome}}! Ainda tem interesse em seguir com o atendimento? É só responder por aqui." },
  { slug: "cv-reativacao", nome: "Reativação de contato", conteudo: "Olá, {{nome}}! Faz um tempo que conversamos. Se ainda pensa em conquistar seu imóvel, podemos retomar por aqui." },
  { slug: "cv-optout-confirmacao", nome: "Confirmação de saída (opt-out)", conteudo: "Pronto, {{nome}}. Você não receberá mais mensagens automáticas. Se precisar, é só chamar." },
];

export const templatePadrao = (slug: string) => TEMPLATES_CENTRAL.find(t => t.slug === slug) ?? null;
