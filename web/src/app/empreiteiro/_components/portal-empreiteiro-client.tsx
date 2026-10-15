"use client";

import { useMemo, useState } from "react";
import { BarChart3, Building2, HardHat, Landmark, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ListaObras, type ObraDaLista } from "@/components/obras/lista-obras";
import { totaisDoEmpreiteiro, type ObraDoEmpreiteiro } from "@/lib/obras/portal-empreiteiro";
import { formatCurrency } from "@/lib/utils";

const CORES = ["#F5C400", "#4F9DDE", "#5CC28F", "#E07A5F", "#9B8DE0", "#F2CC8F", "#81B29A", "#E0A458"];
const reais = (centavos: number) => formatCurrency(centavos / 100);
const reaisCurto = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const moeda = (v: unknown) => formatCurrency(Number(v) || 0);

type Aba = "obras" | "relatorios";

export function PortalEmpreiteiroClient({ obras, indicadores }: { obras: ObraDaLista[]; indicadores: ObraDoEmpreiteiro[] }) {
  const [aba, setAba] = useState<Aba>("obras");
  const totais = useMemo(() => totaisDoEmpreiteiro(indicadores), [indicadores]);
  const comLucro = totais.porObra.filter((o) => o.lucro > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide flex items-center gap-2">
          <HardHat className="text-[var(--brand-yellow)]" /> Acesso do Empreiteiro
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Obras em que você é o empreiteiro vinculado ao Grupo Santa Fé.</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200">
        {([["obras", "Minhas Obras", Building2], ["relatorios", "Relatórios", BarChart3]] as const).map(([id, rotulo, Icone]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider ${aba === id ? "border-b-2 border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "text-gray-400"}`}>
            <Icone size={14} aria-hidden /> {rotulo}
          </button>
        ))}
      </div>

      {aba === "obras" && (
        obras.length === 0
          ? <p className="text-gray-500 text-sm">Nenhuma obra vinculada a você no momento.</p>
          : <div className="space-y-5"><ListaObras obras={obras} base="/empreiteiro/obras" filtroResponsavel={false} /></div>
      )}

      {aba === "relatorios" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Indicador Icone={TrendingUp} titulo="Seu lucro previsto" valor={reais(totais.lucro.centavos)} destaque
              nota={totais.lucro.pendentes ? `${totais.lucro.pendentes} obra(s) ainda sem dados para o cálculo` : "Somente a sua parte, em todas as obras"} />
            <Indicador Icone={Wallet} titulo="VGV total" valor={reais(totais.vgv.centavos)}
              nota={totais.vgv.pendentes ? `${totais.vgv.pendentes} obra(s) sem VGV informado` : `${totais.quantidade} obra(s)`} />
            <Indicador Icone={Landmark} titulo="A receber do banco" valor={reais(totais.receberBanco.centavos)}
              nota={totais.receberBanco.pendentes ? `${totais.receberBanco.pendentes} obra(s) sem dados da CEF` : "Soma do saldo a receber da CEF por obra"} />
          </div>

          {totais.quantidade === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma obra vinculada a você no momento.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <section className="bg-white border border-gray-100 p-5 xl:col-span-3">
                <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Por obra</h2>
                <p className="text-xs text-gray-400 mb-3">VGV, valor a receber do banco e o seu lucro previsto em cada obra.</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totais.porObra} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="nome" tick={{ fill: "#6b7280", fontSize: 11 }} interval={0} />
                      <YAxis tickFormatter={reaisCurto} tick={{ fill: "#6b7280", fontSize: 11 }} width={56} />
                      <Tooltip formatter={moeda} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="vgv" name="VGV" fill="#4F9DDE" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="receberBanco" name="A receber do banco" fill="#5CC28F" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="lucro" name="Seu lucro previsto" fill="#F5C400" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="bg-white border border-gray-100 p-5 xl:col-span-2">
                <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Seu lucro por obra</h2>
                <p className="text-xs text-gray-400 mb-3">Participação de cada obra no seu lucro previsto.</p>
                <div className="h-80">
                  {comLucro.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={comLucro} dataKey="lucro" nameKey="nome" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                          {comLucro.map((o, i) => <Cell key={o.id} fill={CORES[i % CORES.length]} />)}
                        </Pie>
                        <Tooltip formatter={moeda} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-gray-400">Ainda não há lucro previsto calculado nas suas obras.</p>
                  )}
                </div>
              </section>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Lucro previsto: estimativa sobre o lucro da operação após a participação dos investidores, com o seu percentual
            definido pela empresa. A receber do banco: base contratual da CEF menos o que já foi recebido.
          </p>
        </div>
      )}
    </div>
  );
}

function Indicador({ Icone, titulo, valor, nota, destaque = false }: {
  Icone: typeof TrendingUp; titulo: string; valor: string; nota: string; destaque?: boolean;
}) {
  return (
    <div className={`bg-white border p-4 ${destaque ? "border-[var(--brand-yellow)]" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{titulo}</span>
        <Icone size={15} className="text-[var(--brand-yellow)]" aria-hidden />
      </div>
      <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{valor}</p>
      <p className="text-gray-400 text-xs mt-1">{nota}</p>
    </div>
  );
}
