import { isValidCPF } from "../cpf.js";
import { calcularComissaoObra } from "../financeiro/comissao.js";
import { centavosDe } from "../financeiro/obra.js";
import { CLAUSULAS_ATC, CLAUSULAS_EXECUCAO } from "./textos.js";

export const MODELOS_CONTRATO = {
  construcao_atc: "CONSTRUÇÃO ATC",
  execucao_obra: "EXECUÇÃO DE OBRA",
} as const;

export type TipoModelo = keyof typeof MODELOS_CONTRATO;
export const modeloNovo = (tipo: string): tipo is TipoModelo => Object.hasOwn(MODELOS_CONTRATO, tipo);

export interface EmpresaContrato {
  nome: string;
  documento: string;
  endereco: string;
}

export interface CorretorContrato {
  id: string;
  nome: string;
  creci: string;
  percentualPadrao: string | null;
}

export interface EmpreiteiroContrato {
  id: string;
  nome: string;
  documento: string;
  endereco: string;
}

export interface ObraContrato {
  id: string;
  nome: string;
  leadId: string;
  cliente: string;
  cpfCliente: string;
  enderecoCliente: string;
  conjuge: string;
  imovelId: string;
  enderecoImovel: string;
  foro: string;
  area: string;
  matricula: string;
  cartorio: string;
  prazo: string;
  vgv: string | null;
  financiamento: string | null;
  fgts: string | null;
  subsidio: string | null;
  terreno: string | null;
  valorExecucao: string | null;
  percentualObra: string | null;
  corretorId: string;
  empreiteiroId: string;
}

export interface OpcoesContrato {
  empresa: EmpresaContrato;
  obras: ObraContrato[];
  corretores: CorretorContrato[];
  empreiteiros: EmpreiteiroContrato[];
}

export const CAMPOS_MODELO = [
  "tipo", "obraId", "empresaNome", "empresaDocumento", "empresaEndereco", "dataAssinatura",
  "empreiteiroId", "empreiteiroDocumento", "empreiteiroEndereco", "empreiteiroRepresentante",
  "corretorId", "matricula", "cartorio", "prazo", "cpfCliente", "enderecoCliente", "cpfConjuge",
  "terrenoTerceiro", "terrenoValor", "terrenistaNome", "terrenistaDocumento", "terrenistaEndereco",
  "outrosTitulares", "prazoTerreno", "nomeConjuge",
] as const;
export type CamposModelo = Record<typeof CAMPOS_MODELO[number], string>;

export function lerCamposModelo(form: FormData): CamposModelo {
  return Object.fromEntries(CAMPOS_MODELO.map((campo) => [campo, String(form.get(campo) ?? "").trim()])) as CamposModelo;
}

export const moedaContrato = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

export function valorComissaoContrato(obra: ObraContrato, corretor: CorretorContrato | null) {
  return calcularComissaoObra({
    corretor, vgvCentavos: centavosDe(obra.vgv),
    percentualObra: obra.corretorId === corretor?.id ? obra.percentualObra : null,
    pagoCentavos: 0,
  });
}

const semMascara = (v: string) => v.replace(/[.\-/\s]/g, "").toUpperCase();
const cpfValido = (v: string) => /^\d{11}$/.test(semMascara(v)) && isValidCPF(v);
export function cnpjValido(v: string) {
  const cnpj = semMascara(v);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const digito = (base: string, pesos: number[]) => {
    // Receita Federal: letras usam o valor ASCII menos 48, mantendo os mesmos pesos do CNPJ numérico.
    const resto = Array.from(base).reduce((total, char, i) => total + (char.charCodeAt(0) - 48) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return Number(cnpj[12]) === digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    && Number(cnpj[13]) === digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}
const documentoValido = (v: string) => cpfValido(v) || cnpjValido(v);
const dataValida = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

export function montarContrato(campos: CamposModelo, opcoes: OpcoesContrato) {
  const tipo = campos.tipo;
  if (!modeloNovo(tipo)) throw new Error("Selecione um modelo de contrato disponível.");
  const obra = opcoes.obras.find((o) => o.id === campos.obraId);
  if (!obra || !obra.leadId || !obra.imovelId) throw new Error("Selecione uma obra com cliente e imóvel vinculados.");
  const atc = tipo === "construcao_atc";
  const empresa = { nome: campos.empresaNome, documento: campos.empresaDocumento, endereco: campos.empresaEndereco };
  if (!empresa.nome || empresa.nome.length > 255 || !cnpjValido(empresa.documento) || !empresa.endereco)
    throw new Error("Confira a razão social, o CNPJ e o endereço da empresa.");
  if (!dataValida(campos.dataAssinatura)) throw new Error("Informe a data de assinatura estipulada.");
  const matricula = campos.matricula || obra.matricula;
  const cartorio = campos.cartorio || obra.cartorio;
  const prazo = campos.prazo || obra.prazo;
  const cpfCliente = obra.cpfCliente || campos.cpfCliente;
  const enderecoCliente = obra.enderecoCliente || campos.enderecoCliente;
  const conjuge = obra.conjuge || campos.nomeConjuge;
  if (!cpfValido(cpfCliente) || !obra.enderecoImovel || !matricula || !cartorio || !obra.foro || !(Number(obra.area) > 0))
    throw new Error("Complete a identificação do cliente e do imóvel, incluindo CPF, matrícula, cartório, endereço e área construída.");
  if (!/^\d{1,3}$/.test(prazo) || Number(prazo) <= 0) throw new Error("Informe o prazo da obra em meses.");
  if (atc && (!enderecoCliente || (conjuge && !cpfValido(campos.cpfConjuge))))
    throw new Error("Complete o endereço do comprador e o CPF do cônjuge quando houver.");
  if (atc && !["sim", "nao"].includes(campos.terrenoTerceiro))
    throw new Error("Indique se o terreno pertence a terceiro ou à empresa.");
  const terceiro = atc && campos.terrenoTerceiro === "sim";
  if (atc && (!dataValida(campos.prazoTerreno) || campos.prazoTerreno < campos.dataAssinatura))
    throw new Error("Informe uma data limite para a compra do lote a partir da data de assinatura.");
  const vgv = centavosDe(obra.vgv);
  const terreno = atc ? centavosDe(campos.terrenoValor || obra.terreno) : null;
  const valorExecucao = centavosDe(obra.valorExecucao);
  if (atc && (vgv === null || vgv <= 0 || terreno === null || terreno <= 0 || terreno >= vgv))
    throw new Error("Confira o VGV simulado e o preço do terreno. O preço do lote deve ser positivo e menor que o VGV.");
  if (!atc && (valorExecucao === null || valorExecucao <= 0))
    throw new Error("Informe o valor de execução em Orçamento Previsto da obra.");
  if (terceiro && (!campos.terrenistaNome || !documentoValido(campos.terrenistaDocumento) || !campos.terrenistaEndereco))
    throw new Error("Informe nome, CPF/CNPJ e endereço do terrenista.");

  const empreiteiro = !atc ? opcoes.empreiteiros.find((e) => e.id === campos.empreiteiroId) : undefined;
  const empreiteiroDoc = empreiteiro?.documento || campos.empreiteiroDocumento;
  const empreiteiroEndereco = empreiteiro?.endereco || campos.empreiteiroEndereco;
  if (!atc && (!empreiteiro || !documentoValido(empreiteiroDoc) || !empreiteiroEndereco))
    throw new Error("Selecione um empreiteiro e complete seu CPF/CNPJ e endereço.");
  if (!atc && cnpjValido(empreiteiroDoc) && !campos.empreiteiroRepresentante)
    throw new Error("Informe o representante legal do empreiteiro pessoa jurídica.");

  const corretor = opcoes.corretores.find((c) => c.id === campos.corretorId) ?? null;
  if ((campos.corretorId && !corretor) || (obra.corretorId && obra.corretorId !== corretor?.id))
    throw new Error("Confira o corretor do cliente no CRM. O contrato deve usar o mesmo corretor quando houver vínculo no CRM.");
  const comissao = valorComissaoContrato(obra, corretor);
  if (corretor && (!corretor.creci || comissao.valorCentavos === null))
    throw new Error("Confira o CRECI e o percentual de comissão na obra ou no cadastro do corretor.");

  const financiamento = centavosDe(obra.financiamento);
  const fgts = centavosDe(obra.fgts) ?? 0;
  const subsidio = centavosDe(obra.subsidio) ?? 0;
  const entrada = (vgv ?? 0) - (financiamento ?? 0) - fgts - subsidio;
  if (atc && (financiamento === null || financiamento <= 0 || entrada < 0))
    throw new Error("Confira o financiamento CAIXA e a composição do VGV em Valores da Operação da obra.");

  const qualificacaoEmpresa = `${empresa.nome}, CNPJ nº ${empresa.documento}, com sede em ${empresa.endereco}`;
  const assinaturas = [`${atc ? "CONSTRUTORA" : "CONTRATANTE"} — ${empresa.nome}`];
  let qualificacaoParteB: string;
  if (atc) {
    qualificacaoParteB = `COMPRADOR — ${obra.cliente}, CPF nº ${cpfCliente}, residente em ${enderecoCliente}`;
    assinaturas.push(`COMPRADOR — ${obra.cliente}`);
    if (conjuge) {
      qualificacaoParteB += `\nCÔNJUGE DO COMPRADOR — ${conjuge}, CPF nº ${campos.cpfConjuge}`;
      assinaturas.push(`CÔNJUGE DO COMPRADOR — ${conjuge}`);
    }
  } else {
    qualificacaoParteB = `EMPREITEIRO CONTRATADO — ${empreiteiro!.nome}, CPF/CNPJ nº ${empreiteiroDoc}, endereço ${empreiteiroEndereco}`;
    if (campos.empreiteiroRepresentante) qualificacaoParteB += `, representado por ${campos.empreiteiroRepresentante}`;
    assinaturas.push(`EMPREITEIRO CONTRATADO — ${empreiteiro!.nome}`);
  }

  const qualificacao = [`${atc ? "CONSTRUTORA" : "CONTRATANTE"} — ${qualificacaoEmpresa}`, qualificacaoParteB];
  if (terceiro) {
    qualificacao.push(`TERRENISTA / PROMITENTE VENDEDOR — ${campos.terrenistaNome}, CPF/CNPJ nº ${campos.terrenistaDocumento}, endereço ${campos.terrenistaEndereco}`);
    assinaturas.push(`TERRENISTA / PROMITENTE VENDEDOR — ${campos.terrenistaNome}`);
    if (campos.outrosTitulares) {
      for (const titular of campos.outrosTitulares.split("\n").map((v) => v.trim()).filter(Boolean)) {
        const [nome, doc, endereco] = titular.split("|").map((v) => v.trim());
        if (!nome || !doc || !documentoValido(doc) || !endereco)
          throw new Error("Informe nome, CPF/CNPJ e endereço de cada cotitular ou cônjuge anuente.");
        qualificacao.push(`COTITULAR OU CÔNJUGE ANUENTE — ${nome}, CPF/CNPJ nº ${doc}, endereço ${endereco}`);
        assinaturas.push(`COTITULAR OU CÔNJUGE ANUENTE — ${nome}`);
      }
    }
  }

  const clausulaCorretagem = corretor && comissao.valorCentavos !== null && comissao.percentual !== null
    ? [
        "DA CORRETAGEM E DA FORMA DE PAGAMENTO",
        `A CONTRATANTE DA CORRETAGEM, ${empresa.nome}, pagará ao CORRETOR INTERVENIENTE ${corretor.nome}, CRECI nº ${corretor.creci}, comissão de ${Number(comissao.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% sobre o VGV de ${moedaContrato(vgv!)}, totalizando ${moedaContrato(comissao.valorCentavos)}.`,
        "A empresa fará o repasse após a aprovação de cada medição e o efetivo recebimento dos recursos da construção liberados pela CAIXA. A cada recebimento, a parcela da comissão corresponde à proporção entre o valor recebido da construção e o total dos recursos da construção previstos no cronograma de desembolsos da CAIXA, aplicada sobre a comissão total. Os repasses já efetuados serão abatidos e eventuais diferenças de arredondamento serão ajustadas na última parcela, até o limite da comissão contratada.",
        ...(atc ? [] : ["A indicação da comissão neste instrumento refere-se à mesma intermediação comercial da obra, sem duplicar a cobrança e sem dedução do valor contratado do empreiteiro."]),
      ] : [];
  if (corretor) {
    qualificacao.push(`CORRETOR INTERVENIENTE — ${corretor.nome}, CRECI nº ${corretor.creci}`);
    assinaturas.push(`CORRETOR INTERVENIENTE — ${corretor.nome}`);
  }

  const limiteTerreno = campos.prazoTerreno.split("-").reverse().join("/");
  const aquisicao = terceiro
    ? [
        "CLÁUSULA OITAVA — DA PROMESSA DE COMPRA E VENDA DO TERRENO",
        `8.1. O TERRENISTA compromete-se a vender diretamente ao COMPRADOR o terreno da matrícula nº ${matricula}, do Registro de Imóveis ${cartorio}, por ${moedaContrato(terreno!)}. Os titulares comprometem-se a manter o lote disponível até ${limiteTerreno}, a não negociá-lo com terceiros nesse prazo, a apresentar os documentos necessários e a assinar o instrumento definitivo quando cumpridas as condições da compra e aprovado o financiamento.`,
        "8.2. A parcela financiada do preço do lote será creditada ao TERRENISTA conforme o instrumento da CAIXA e os requisitos de registro. As partes discriminarão no instrumento definitivo eventual parcela de recursos próprios devida pelo comprador. A CONSTRUTORA responde pelas obrigações de construção que assume neste contrato.",
        "8.3. Se a operação for recusada por falta de titularidade, ônus impeditivo ou falta de documento imputável ao TERRENISTA, o COMPRADOR poderá resolver o compromisso de aquisição do lote e exigir do TERRENISTA a devolução dos valores que lhe tiver pago, sem prejuízo das medidas cabíveis. Se a CAIXA recusar a operação por outro motivo, as partes poderão ajustar por escrito outra forma de pagamento. Sem acordo escrito até a data limite, o compromisso de venda do lote se encerra, com devolução dos valores pagos ao terrenista se não houver inadimplemento imputável ao comprador. As consequências sobre a construção serão apuradas separadamente conforme a lei e as demais cláusulas aplicáveis.",
      ].join("\n")
    : [
        "CLÁUSULA OITAVA — DA AQUISIÇÃO E DO REGISTRO DO TERRENO",
        `8.1. A CONSTRUTORA, na condição de titular da matrícula, promete vender o lote ao COMPRADOR pelo preço previsto na cláusula 1.4 e manterá o terreno disponível até ${limiteTerreno}. A CONSTRUTORA apresentará os documentos de titularidade e assinará com o COMPRADOR o instrumento definitivo após a aprovação da CAIXA e o cumprimento das condições da compra.`,
        "8.2. A parcela financiada do terreno será liberada à vendedora conforme o instrumento da CAIXA e os requisitos do registro imobiliário. Eventual parcela de recursos próprios para o lote será discriminada no instrumento definitivo.",
      ].join("\n");

  const valores: Record<string, string> = {
    area: Number(obra.area).toLocaleString("pt-BR"), enderecoImovel: obra.enderecoImovel, matricula, cartorio,
    prazo, foro: obra.foro, cliente: obra.cliente, cpfCliente,
    vgv: moedaContrato(vgv ?? 0), terreno: moedaContrato(terreno ?? 0), construcao: moedaContrato((vgv ?? 0) - (terreno ?? 0)),
    entrada: moedaContrato(entrada), fgts: moedaContrato(fgts), subsidio: moedaContrato(subsidio),
    financiamento: moedaContrato(financiamento ?? 0), aquisicao, valorExecucao: moedaContrato(valorExecucao ?? 0),
  };
  const base = (atc ? CLAUSULAS_ATC : CLAUSULAS_EXECUCAO).map((l) => l.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave]));
  if (atc && clausulaCorretagem.length) base.splice(base.findIndex((l) => l.startsWith("MEMORIAL DESCRITIVO")), 0, ...clausulaCorretagem);
  else base.push(...clausulaCorretagem);
  const description = atc
    ? `Aquisição do terreno e construção de residência unifamiliar em ${obra.enderecoImovel}, matrícula nº ${matricula}.`
    : `Fornecimento de material e mão de obra para execução e entrega na chave da residência em ${obra.enderecoImovel}, matrícula nº ${matricula}, de ${obra.cliente}.`;

  return {
    tipo, obra, empresa, parteB: empreiteiro?.nome ?? obra.cliente, parteBDoc: atc ? cpfCliente : empreiteiroDoc,
    empreiteiroId: empreiteiro?.id ?? null, corretorId: corretor?.id ?? null,
    dataAssinatura: new Date(campos.dataAssinatura + "T12:00:00.000Z"),
    valor: (atc ? vgv! : valorExecucao!) / 100,
    description, clausulas: [...qualificacao, "", ...base].join("\n"),
    assinaturas: [...assinaturas, "1ª TESTEMUNHA — CPF", "2ª TESTEMUNHA — CPF"],
  };
}
