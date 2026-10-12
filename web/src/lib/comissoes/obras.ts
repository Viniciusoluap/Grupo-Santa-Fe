import { prisma } from "@/lib/db";
import { calcularComissaoObra, type ComissaoObraCalculada } from "@/lib/financeiro/comissao";
import { centavosDe } from "@/lib/financeiro/obra";

// EPIC-020 Lote 3 (item 32), espelhado da Prospecta: toda obra cujo lead tem
// corretor aparece em Comissões, inclusive as antigas. A lista é derivada a
// cada leitura (obra + CRM + pagamentos de categoria "comissão"), então não
// existe registro duplicado para sincronizar. Comissões cadastradas à mão
// para a mesma obra são mostradas lado a lado — nunca sobrescritas.

export interface ComissaoDeObra {
  obraId: string;
  obra: string;
  cliente: string;
  corretorId: string;
  corretor: string;
  vgv: string | null;
  calculo: ComissaoObraCalculada;
  registrosManuais: { id: string; valor: number; percentual: number; status: string }[];
  alertas: string[];
}

export async function listarComissoesDeObras(): Promise<ComissaoDeObra[]> {
  const [obras, manuais] = await Promise.all([
    prisma.obra.findMany({
      where: { leadVinculado: { corretorId: { not: null } } },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, clienteNome: true, vgv: true, comissaoPercentual: true,
        leadVinculado: { select: { nome: true, corretor: { select: { id: true, nome: true, regraComissao: { select: { percentual: true } } } } } },
        movimentos: { where: { status: "confirmado", natureza: "pagamento", categoria: "comissao" }, select: { valor: true } },
      },
    }),
    prisma.comissao.findMany({
      where: { tipoNegocio: "obra", negocioId: { not: null } },
      select: { id: true, negocioId: true, corretorId: true, valor: true, percentual: true, status: true },
    }),
  ]);
  return obras
    .filter((o) => o.leadVinculado?.corretor)
    .map((o) => {
      const c = o.leadVinculado!.corretor!;
      const calculo = calcularComissaoObra({
        corretor: { id: c.id, nome: c.nome, percentualPadrao: c.regraComissao?.percentual.toString() ?? null },
        vgvCentavos: centavosDe(o.vgv?.toString() ?? null),
        percentualObra: o.comissaoPercentual?.toString() ?? null,
        pagoCentavos: o.movimentos.reduce((acc, m) => acc + centavosDe(m.valor.toString())!, 0),
      });
      const registrosManuais = manuais
        .filter((m) => m.negocioId === o.id)
        .map((m) => ({ id: m.id, valor: m.valor, percentual: m.percentual, status: m.status }));
      const alertas = [...calculo.alertas];
      for (const m of manuais.filter((x) => x.negocioId === o.id)) {
        if (m.corretorId !== c.id) alertas.push("Comissão manual desta obra está em nome de outro corretor.");
        if (calculo.valorCentavos !== null && centavosDe(m.valor) !== calculo.valorCentavos)
          alertas.push("Comissão manual desta obra tem valor diferente do calculado (preservada; revise).");
      }
      return {
        obraId: o.id, obra: o.nome, cliente: o.leadVinculado!.nome || o.clienteNome, corretorId: c.id, corretor: c.nome,
        vgv: o.vgv?.toString() ?? null, calculo, registrosManuais, alertas,
      };
    });
}
