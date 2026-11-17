// Paridade 17/11 bloco 4 — termo de consentimento (gêmeo de Prospecta/shared/termo-consentimento.ts, EPIC-024 S-12).
// Arquivo ÚNICO do termo: para trocar o texto, edite aqui e suba `VERSAO_DO_TERMO` (aceites antigos continuam válidos;
// pedir novo aceite depende da opção CONSENTIMENTO_PEDIR_NO_LOGIN, desligada — ver src/lib/consentimento.ts).
// Texto definitivo (ordem do dono em 17/11/2026), em linguagem simples, com base na LGPD (Lei 13.709/2018). Só afirma o
// que ESTE sistema faz: a seção de IA cita a Central de Vendas (WhatsApp, entra desligada) e a análise de mercado/imóveis
// (sem nome, CPF, telefone ou e-mail). Não há maquete nem assistente da equipe no Santa Fé.
// Sem "server-only": o texto é usado também por componentes do navegador.
import { CONTATOS, ENDERECO_DA_SEDE, NOME_DA_EMPRESA } from "@/lib/empresa";

/** Versão vigente do termo. Mude sempre que o texto mudar (ex.: "2026-11-17.1" → "2026-12-01.1"). */
export const VERSAO_DO_TERMO = "2026-11-17.1";

/** Histórico das versões (a mais nova primeiro). */
export const HISTORICO_DO_TERMO: readonly { versao: string; resumo: string }[] = [
  { versao: "2026-11-17.1", resumo: "Primeiro texto no Grupo Santa Fé, já definitivo: encarregado (canal de atendimento ao titular), prazos de guarda, prazo de resposta de 15 dias, direitos e retirada registrada no sistema." },
];

export const FRASE_CURTA_DO_TERMO =
  "Li e concordo com o tratamento dos meus dados pelo Grupo Santa Fé, inclusive por inteligência artificial no atendimento pelo WhatsApp.";

export const AVISO_SEM_ACEITE = "Para criar a senha, marque a caixa de concordância com o termo.";
export const MENSAGEM_SEM_ACEITE = "Para criar a senha, é preciso marcar que você leu e concorda com o termo de consentimento.";
export const MENSAGEM_VERSAO_ERRADA = "O termo de consentimento foi atualizado. Recarregue a página, leia a versão atual e marque de novo.";
export const MENSAGEM_SEM_CONSENTIMENTO_ATIVO = "Não há consentimento ativo para retirar.";

export const ROTA_DO_TERMO = "/termo-de-consentimento";
export const TITULO_DO_TERMO = "Termo de consentimento para uso dos seus dados";

/** Canal de atendimento ao titular, que faz o papel de encarregado (LGPD, art. 41). */
export const CANAL_DO_TITULAR = { email: CONTATOS.email, telefone: CONTATOS.telefoneEscritorio } as const;
export const PRAZO_DE_RESPOSTA_DIAS = 15;

export type SecaoDoTermo = { titulo: string; paragrafos: string[] };

export const SECOES_DO_TERMO: readonly SecaoDoTermo[] = [
  {
    titulo: "1. Quem cuida dos seus dados",
    paragrafos: [
      `${NOME_DA_EMPRESA}, de Canaã dos Carajás (PA), é o controlador dos seus dados pessoais.`,
      `Endereço: ${ENDERECO_DA_SEDE}.`,
      `Encarregado pelo tratamento de dados pessoais (LGPD, art. 41): o canal de atendimento ao titular do ${NOME_DA_EMPRESA}, pelo e-mail ${CANAL_DO_TITULAR.email} ou pelo telefone ${CANAL_DO_TITULAR.telefone}.`,
    ],
  },
  {
    titulo: "2. Quais dados",
    paragrafos: [
      `Os dados que você ou a equipe informam no sistema: nome, CPF ou CNPJ, telefone, e-mail, endereço, documentos enviados, dados do imóvel, da obra, do financiamento e dos pagamentos, e as mensagens trocadas com o ${NOME_DA_EMPRESA} (inclusive pelo WhatsApp).`,
      "Também registramos a data e a hora em que você aceita este termo, a versão aceita e o tipo de aparelho usado (celular, tablet ou computador). Se você retirar o consentimento, registramos a data e a hora da retirada e quem a registrou.",
    ],
  },
  {
    titulo: "3. Para que usamos",
    paragrafos: [
      "Para fazer o seu cadastro e o seu acesso; para o atendimento; para acompanhar avaliações, projetos, regularizações, financiamentos e obras; para cobrança e pagamentos; e para falar com você (WhatsApp, e-mail ou telefone).",
    ],
  },
  {
    titulo: "4. Inteligência artificial",
    paragrafos: [
      `O ${NOME_DA_EMPRESA} usa inteligência artificial de duas formas:`,
      `Atendimento inicial pelo WhatsApp: quando essa função está ligada pela equipe (ela vem desligada), as primeiras respostas a quem fala com o ${NOME_DA_EMPRESA} pelo WhatsApp podem ser dadas por um atendente automático, que cumprimenta, pede o seu consentimento, tira dúvidas sobre os imóveis cadastrados e anota o que você procura. Se você pedir para falar com uma pessoa, ou se o atendente automático não conseguir ajudar, a conversa passa para alguém da equipe. Nesse uso, as mensagens trocadas, o que você informa na conversa (por exemplo: nome, cidade, renda e o que procura) e o nome e o tipo dos arquivos que você envia são enviados a um prestador de serviço de inteligência artificial, atualmente a Anthropic, que processa os dados para gerar a resposta. Esse prestador pode ficar fora do Brasil.`,
      "Análise de mercado e de imóveis: para pesquisar anúncios parecidos, sugerir valores de imóveis e estudar empreendimentos, o sistema pode enviar a serviços de inteligência artificial dados do imóvel ou do terreno (por exemplo: endereço, bairro, cidade, tipo, áreas e estado de conservação). Nesse uso o sistema não envia nome, CPF, telefone nem e-mail.",
      `A inteligência artificial pode errar. Propostas, valores, aprovações e contratos são decididos pela equipe do ${NOME_DA_EMPRESA}.`,
    ],
  },
  {
    titulo: "5. Com quem compartilhamos",
    paragrafos: [
      "Com prestadores de serviço de tecnologia que fazem o sistema funcionar (por exemplo: hospedagem, banco de dados, armazenamento de arquivos, envio de e-mail e de mensagens, cobrança e os serviços de inteligência artificial citados acima), e com órgãos públicos, cartórios e bancos quando isso for necessário para o serviço que você contratou ou exigido por lei.",
    ],
  },
  {
    titulo: "6. Por quanto tempo",
    paragrafos: [
      `Enquanto você tiver conta ou relação com o ${NOME_DA_EMPRESA} (cadastro, atendimento, contrato, obra, financiamento ou cobrança em andamento).`,
      "Depois que a relação termina, guardamos só o que a lei manda ou permite guardar, pelos prazos legais: por exemplo, 5 anos para documentos fiscais e contábeis, e o prazo de prescrição que se aplicar para defender direitos em processos judiciais, administrativos ou arbitrais.",
      `Passados esses prazos, o ${NOME_DA_EMPRESA} elimina os dados ou os anonimiza (tira deles o que identifica você). Você também pode pedir a eliminação antes, pelos contatos do item 7; guardamos só o que a lei obrigar.`,
      "O registro do aceite e da retirada deste termo é guardado como prova pelo mesmo tempo.",
    ],
  },
  {
    titulo: "7. Seus direitos e como pedir",
    paragrafos: [
      "Você pode pedir a qualquer momento: a confirmação de que tratamos seus dados; o acesso a eles; a correção de dados incompletos, errados ou desatualizados; a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei; a portabilidade dos seus dados; a eliminação dos dados tratados com o seu consentimento; a informação sobre com quem compartilhamos seus dados; a informação sobre a possibilidade de não consentir e o que acontece se você não consentir; e a retirada deste consentimento.",
      `Para pedir, escreva para ${CANAL_DO_TITULAR.email} ou ligue para ${CANAL_DO_TITULAR.telefone}. A confirmação simples é respondida assim que recebermos o pedido; a declaração completa (origem dos dados, critérios usados e finalidade do tratamento) é entregue em até ${PRAZO_DE_RESPOSTA_DIAS} dias a partir do pedido (LGPD, art. 19, II).`,
      `Retirada do consentimento: se você tem acesso ao sistema, entre com o seu usuário e use o botão "Retirar consentimento" no fim desta página; ou peça pelos mesmos contatos (e-mail ou telefone) e a equipe do ${NOME_DA_EMPRESA} registra a retirada no sistema. A retirada fica registrada com a data, a hora e quem a registrou.`,
      "A retirada vale a partir do registro: não desfaz o que foi feito antes dela, e o sistema volta a pedir o aceite na próxima vez que você entrar (sem ele, a área logada não fica disponível). Os dados que a lei manda guardar, ou que são necessários para cumprir um contrato com você, continuam guardados pelo tempo do item 6.",
      "Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
    ],
  },
  {
    titulo: "8. Mudanças neste termo",
    paragrafos: [
      "Se este termo mudar, a nova versão ficará nesta mesma página. O sistema guarda qual versão você aceitou e quando.",
    ],
  },
];

export const CANAIS_DO_CONSENTIMENTO = ["definir_senha", "login", "admin", "conta"] as const;
export type CanalDoConsentimento = (typeof CANAIS_DO_CONSENTIMENTO)[number];
export const TIPOS_DO_CONSENTIMENTO = ["aceite", "revogacao"] as const;
export type TipoDoConsentimento = (typeof TIPOS_DO_CONSENTIMENTO)[number];
export type AparelhoDoConsentimento = "celular" | "tablet" | "computador" | "desconhecido";
