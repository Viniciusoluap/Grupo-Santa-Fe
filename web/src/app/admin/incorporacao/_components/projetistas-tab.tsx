"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, HardHat, AlertTriangle } from "lucide-react";
import {
  resumoProjetistas,
  DISCIPLINAS,
  type Disciplina,
  type Projetista,
  type StatusProjetista,
} from "@/lib/incorporacao/projetistas";
import { salvarProjetistas } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Contratação de Projetistas (3.1 Incorporação e Produto) — gestão dos
// projetistas contratados, prazos de entrega e compatibilização técnica
// entre disciplinas antes do projeto seguir para aprovação (3.2).

const STATUS: { value: StatusProjetista; label: string; cor: string }[] = [
  { value: "nao_contratado", label: "Não contratado", cor: "text-gray-400" },
  { value: "contratado", label: "Contratado", cor: "text-blue-600" },
  { value: "em_desenvolvimento", label: "Em desenvolvimento", cor: "text-amber-600" },
  { value: "entregue", label: "Entregue", cor: "text-green-600" },
  { value: "compatibilizado", label: "Compatibilizado", cor: "text-[var(--brand-dark)] font-bold" },
];

interface Dados {
  projetistas: Projetista[];
}

function defaults(): Dados {
  return { projetistas: [] };
}

function novoProjetista(): Projetista {
  return {
    id: Math.random().toString(36).slice(2),
    disciplina: "Arquitetura",
    empresaOuProfissional: "",
    status: "nao_contratado",
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function ProjetistasTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.projetistasJson) {
      try {
        const salvo = JSON.parse(estudo.projetistasJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoProjetistas(dados.projetistas), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addProjetista() {
    setDados((d) => ({ projetistas: [...d.projetistas, novoProjetista()] }));
    marcarAlterado();
  }
  function removerProjetista(id: string) {
    setDados((d) => ({ projetistas: d.projetistas.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof Projetista>(id: string, campo: K, valor: Projetista[K]) {
    setDados((d) => ({ projetistas: d.projetistas.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarProjetistas(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <HardHat size={13} /> Contratação de Projetistas
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um projetista por disciplina. A etapa fica concluída quando todos os projetistas cadastrados estiverem compatibilizados entre si.
        </p>
      </div>

      {dados.projetistas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Projetistas" valor={String(resumo.total)} />
          <Kpi label="Contratados" valor={String(resumo.contratados)} />
          <Kpi label="Entregues" valor={String(resumo.entregues)} />
          <Kpi label="Compatibilizados" valor={`${resumo.pctCompatibilizado}%`} destaque />
        </div>
      )}

      {resumo.atrasados.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            {resumo.atrasados.length} projetista(s) com prazo de entrega vencido: {resumo.atrasados.map((p) => p.empresaOuProfissional || p.disciplina).join(", ")}.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[720px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Disciplina</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-44">Empresa/Profissional</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Contato</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Prazo de entrega</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.projetistas.map((p) => (
                <tr key={p.id}>
                  <td className="px-1 py-1">
                    <select value={p.disciplina} onChange={(e) => upd(p.id, "disciplina", e.target.value as Disciplina)} className={inputCls}>
                      {DISCIPLINAS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={p.empresaOuProfissional} onChange={(e) => upd(p.id, "empresaOuProfissional", e.target.value)} className={inputCls} placeholder="Nome" /></td>
                  <td className="px-1 py-1"><input value={p.contato ?? ""} onChange={(e) => upd(p.id, "contato", e.target.value)} className={inputCls} placeholder="Telefone/e-mail" /></td>
                  <td className="px-1 py-1"><input type="date" value={p.prazoEntrega ?? ""} onChange={(e) => upd(p.id, "prazoEntrega", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1">
                    <select value={p.status} onChange={(e) => upd(p.id, "status", e.target.value as StatusProjetista)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerProjetista(p.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addProjetista} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar projetista
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
