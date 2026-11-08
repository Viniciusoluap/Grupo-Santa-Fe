import { prisma } from "@/lib/db";
import type { DadosPci } from "@/lib/caixa/pci";
import { vgvSimuladoDoLead } from "@/lib/financeiro/vgv-lead";
import { cnpjValido, type OpcoesContrato } from "./modelos";

export async function opcoesModelosContrato(obraId?: string): Promise<OpcoesContrato> {
  const [obras, corretores, empreiteiros, configs] = await Promise.all([
    prisma.obra.findMany({
      where: { id: obraId, leadVinculado: { is: { excluidoEm: null } }, imovelId: { not: null } },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, endereco: true, area: true, custoTerreno: true, financiamentoCef: true, fgts: true, subsidio: true,
        orcamentoPrevisto: true, comissaoPercentual: true, empreiteiroId: true,
        leadVinculado: { select: { id: true, nome: true, cpf: true, orcamento: true, corretorId: true } },
        imovel: { select: { id: true, rua: true, bairro: true, cidade: true, estado: true } },
        pci: { select: { versao: { select: { parsed: true } } } },
      },
    }),
    prisma.corretor.findMany({
      where: { ativo: true }, orderBy: { nome: "asc" },
      select: { id: true, nome: true, creci: true, regraComissao: { select: { percentual: true } } },
    }),
    prisma.usuario.findMany({
      where: { papel: "empreiteiro", ativo: true }, orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.configuracao.findMany({
      where: { chave: { in: ["razao_social", "empresa_nome", "cnpj", "empresa_cnpj", "rua", "bairro", "cidade", "estado", "cep", "empresa_endereco"] } },
    }),
  ]);
  const cfg = Object.fromEntries(configs.map(({ chave, valor }) => [chave, valor.trim()]));
  const cnpj = [cfg.cnpj, cfg.empresa_cnpj].find((v) => v && cnpjValido(v));
  return {
    empresa: {
      nome: cfg.razao_social || cfg.empresa_nome || "Grupo Santa Fé",
      documento: cnpj || "",
      endereco: cfg.rua ? [cfg.rua, cfg.bairro, cfg.cidade, cfg.estado, cfg.cep].filter(Boolean).join(", ") : cfg.empresa_endereco || "",
    },
    obras: obras.flatMap((o) => {
      const lead = o.leadVinculado;
      const imovel = o.imovel;
      if (!lead || !imovel) return [];
      const dados = o.pci?.versao.parsed as DadosPci | undefined;
      const local = dados?.identificacao;
      const endereco = imovel.rua || o.endereco || local?.endereco;
      const foro = [imovel.cidade, imovel.estado].filter(Boolean).join("/");
      return [{
        id: o.id, nome: o.nome, leadId: lead.id, cliente: lead.nome, cpfCliente: lead.cpf ?? "",
        enderecoCliente: "", conjuge: "", imovelId: imovel.id,
        enderecoImovel: endereco ? [endereco, imovel.bairro || local?.bairro, foro].filter(Boolean).join(", ") : "",
        foro, area: String(o.area ?? ""), matricula: local?.matricula ?? "", cartorio: local?.cartorio ?? "", prazo: String(dados?.prazoMeses ?? ""),
        vgv: vgvSimuladoDoLead(lead), financiamento: o.financiamentoCef?.toString() ?? null,
        fgts: o.fgts?.toString() ?? null, subsidio: o.subsidio?.toString() ?? null, terreno: o.custoTerreno?.toString() ?? null,
        valorExecucao: o.orcamentoPrevisto?.toString() ?? null, percentualObra: o.comissaoPercentual?.toString() ?? null,
        corretorId: lead.corretorId ?? "", empreiteiroId: o.empreiteiroId ?? "",
      }];
    }),
    corretores: corretores.map(({ regraComissao, ...c }) => ({ ...c, percentualPadrao: regraComissao?.percentual.toString() ?? null })),
    empreiteiros: empreiteiros.map((e) => ({ ...e, documento: "", endereco: "" })),
  };
}
