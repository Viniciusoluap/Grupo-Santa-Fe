export interface TemplateWhatsapp {
  id: string;
  name: string;
  category: string;
  body: string;
}

export const TEMPLATES_WHATSAPP_PADRAO: TemplateWhatsapp[] = [
  { id: "captacao", name: "Boas-vindas ao lead", category: "Captação", body: "Olá, {{nome}}! Tudo bem?\n\nSou {{corretor}}, do Grupo Santa Fé.\n\nRecebemos seu contato e será um prazer ajudar você a encontrar a melhor solução para seu objetivo. Nosso atendimento é personalizado, e quero entender melhor sua necessidade para apresentar as possibilidades mais adequadas e orientar você durante todo o processo.\n\nPodemos começar com algumas perguntas rápidas?" },
  { id: "followup48h", name: "Follow-up 48h", category: "Acompanhamento", body: "Olá, {{nome}}! Tudo bem? Estou retomando nosso atendimento sobre {{servicos}}. Separei algumas possibilidades que podem fazer sentido para você. Podemos conversar por alguns minutos para avançarmos?" },
  { id: "visita", name: "Confirmação de visita", category: "Agenda", body: "Olá, {{nome}}! Sua visita está confirmada para o dia {{dia}}, às {{horario}}. Qualquer dúvida, estou à disposição!" },
  { id: "proposta", name: "Envio de proposta", category: "Negociação", body: "Olá, {{nome}}! Preparei a proposta referente a {{imovel}}, com as condições alinhadas para sua análise. Posso enviar os detalhes e esclarecer os próximos passos com você?" },
  { id: "financiamento", name: "Atualização do financiamento", category: "Financiamento", body: "Olá, {{nome}}! Temos uma atualização sobre seu financiamento junto ao {{banco}}. Quero explicar o status e orientar você sobre a próxima etapa. Qual é o melhor horário para conversarmos?" },
  { id: "documentos", name: "Lembrete de documentos", category: "Documentação", body: "Olá, {{nome}}! Para continuarmos seu atendimento, ainda precisamos destes documentos: {{documentos}}. Assim que você enviar, conseguiremos avançar para a próxima etapa. Se precisar de ajuda, estou à disposição." },
];

export const VARIAVEIS_TEMPLATE_PERMITIDAS = new Set(["nome", "corretor", "servico", "servicos", "imovel", "banco", "dia", "horario", "documentos"]);

export function validarTemplateWhatsapp(conteudo: string) {
  const invalidas = Array.from(conteudo.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g))
    .map((m) => m[1].toLowerCase()).filter((v) => !VARIAVEIS_TEMPLATE_PERMITIDAS.has(v));
  if (invalidas.length) throw new Error(`Variáveis inválidas: ${Array.from(new Set(invalidas)).map((v) => `{{${v}}}`).join(", ")}.`);
}
