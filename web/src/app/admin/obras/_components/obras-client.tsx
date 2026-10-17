"use client";

import { HardHat } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ListaObras, type ObraDaLista } from "@/components/obras/lista-obras";

interface Props {
  obras: ObraDaLista[];
}

export function ObrasClient({ obras }: Props) {
  const emAndamento = obras.filter((o) => o.status === "em_andamento").length;
  // EPIC-020 Lote 2: volume pelo VGV (Valores da Operação); valorTotal antigo
  // só entra como referência legada quando a obra ainda não tem VGV.
  const totalValue = obras.reduce((s, o) => s + (o.vgv ?? 0), 0);
  const semVgv = obras.filter((o) => o.vgv == null).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Obras e Reformas</h1>
          <p className="text-gray-600 text-sm mt-0.5">{obras.length} projetos cadastrados</p>
        </div>
        <Link href="/admin/leads" className="text-sm font-bold text-[var(--brand-dark)]">Abrir CRM</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em Andamento", value: emAndamento, sub: "obras ativas" },
          { label: "Concluídas", value: obras.filter((o) => o.status === "concluida").length, sub: "no histórico" },
          { label: "VGV Total", value: formatCurrency(totalValue), sub: semVgv ? `${semVgv} sem VGV informado` : "todas com VGV" },
          { label: "Sem VGV", value: semVgv, sub: "preencher em Valores da Operação" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</span>
              <HardHat size={15} className="text-[var(--brand-yellow)]" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{value}</p>
            <p className="text-gray-600 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <ListaObras obras={obras} base="/admin/obras" podeExcluir />
    </div>
  );
}
