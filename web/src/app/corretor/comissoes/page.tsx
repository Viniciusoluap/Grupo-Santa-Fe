import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/modulos";
import { listarComissoesDeObras } from "@/lib/comissoes/obras";
import { comissoesDoPortal } from "@/lib/corretor/portal";
import { formatCurrency } from "@/lib/utils";
import { rotulo } from "@/lib/rotulos";

const STATUS_OBRA: Record<string, string> = {
  dados_incompletos: "Dados incompletos",
  pendente: "Pendente",
  parcial: "Paga parcialmente",
  paga: "Paga",
};

// Minhas Comissões do Portal do Corretor (igual à Prospecta): comissões das obras
// dos leads dele (VGV × %, as mesmas do painel) e as cadastradas para ele.
export default async function CorretorComissoesPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  const [deObras, manuais] = await Promise.all([
    u.corretorId ? listarComissoesDeObras(u.corretorId) : Promise.resolve([]),
    comissoesDoPortal(u.corretorId),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-black">Minhas Comissões</h1>
        <p className="text-slate-600">Somente comissões vinculadas ao seu cadastro.</p>
      </div>
      <div className="space-y-3">
        {deObras.map((item) => (
          <div key={`obra-${item.obraId}`} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-5">
            <div>
              <p className="text-xs text-slate-600">Obra · cliente</p>
              <p className="font-semibold">{item.obra}</p>
              <p className="text-xs text-slate-600">{item.cliente}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">VGV · %</p>
              <p>{item.vgv ? formatCurrency(Number(item.vgv)) : "VGV não informado"}</p>
              <p className="text-xs text-slate-600">
                {item.calculo.percentual ? `${Number(item.calculo.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%` : "sem percentual"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Comissão</p>
              <p className="font-semibold">{item.calculo.valorCentavos === null ? "—" : formatCurrency(item.calculo.valorCentavos / 100)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Pago · saldo</p>
              <p>{formatCurrency(item.calculo.pagoCentavos / 100)}</p>
              <p className="text-xs text-slate-600">saldo {item.calculo.saldoCentavos === null ? "—" : formatCurrency(item.calculo.saldoCentavos / 100)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Situação</p>
              <span className="inline-block rounded-md bg-[var(--brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{STATUS_OBRA[item.calculo.status] ?? rotulo(item.calculo.status)}</span>
            </div>
          </div>
        ))}
        {manuais.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-slate-600">Imóvel</p>
              <p className="font-semibold">{item.imovel}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Valor</p>
              <p className="font-semibold">{formatCurrency(item.valor)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Vencimento</p>
              <p>{item.vencimento.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Status</p>
              <span className="inline-block rounded-md bg-[var(--brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{rotulo(item.status)}</span>
            </div>
          </div>
        ))}
        {deObras.length === 0 && manuais.length === 0 && (
          <div className="rounded-xl border bg-white p-10 text-center text-slate-600">Nenhuma comissão vinculada ao seu cadastro.</div>
        )}
      </div>
    </>
  );
}
