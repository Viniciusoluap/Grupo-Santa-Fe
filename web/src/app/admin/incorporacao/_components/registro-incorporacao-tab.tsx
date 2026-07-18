"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Loader2, CheckCircle2, FileCheck2 } from "lucide-react";
import {
  resumoRegistro,
  DOCUMENTOS_PADRAO_REGISTRO,
  type DocumentoRegistro,
  type StatusDocumento,
} from "@/lib/incorporacao/registro-incorporacao";
import { salvarRegistroIncorporacao } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Registro da Incorporação (3.4 Incorporação e Produto) — checklist dos
// documentos exigidos pelo art. 32 da Lei 4.591/64, pré-preenchido
// automaticamente (regra do projeto: nada manual quando dá para o sistema
// já entregar pronto).

interface Dados {
  documentos: DocumentoRegistro[];
}

function defaults(): Dados {
  return {
    documentos: DOCUMENTOS_PADRAO_REGISTRO.map((nome, i) => ({
      id: `padrao-${i}`,
      nome,
      status: "pendente" as StatusDocumento,
    })),
  };
}

const STATUS: { value: StatusDocumento; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_providencia", label: "Em providência" },
  { value: "obtido", label: "Obtido" },
];

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function RegistroIncorporacaoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.registroIncorporacaoJson) {
      try {
        const salvo = JSON.parse(estudo.registroIncorporacaoJson) as Partial<Dados>;
        if (salvo.documentos?.length) return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoRegistro(dados.documentos), [dados]);

  function upd(id: string, campo: "status" | "dataObtencao" | "observacoes", valor: string) {
    setDados((d) => ({
      documentos: d.documentos.map((doc) => (doc.id === id ? { ...doc, [campo]: valor } : doc)),
    }));
    setSalvo(false);
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarRegistroIncorporacao(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <FileCheck2 size={13} /> Registro da Incorporação
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Checklist padrão do art. 32 da Lei 4.591/64, já pré-preenchido. A etapa fica concluída quando todos os documentos estiverem marcados como obtidos.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Documentos" valor={String(resumo.total)} />
        <Kpi label="Em providência" valor={String(resumo.emProvidencia)} />
        <Kpi label="Pendentes" valor={String(resumo.pendentes.length)} />
        <Kpi label="Obtidos" valor={`${resumo.pctObtido}%`} destaque />
      </div>

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[760px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-72">Documento</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Data de obtenção</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Observações</th>
              </tr>
            </thead>
            <tbody>
              {dados.documentos.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-1 py-1.5 text-gray-600">{doc.nome}</td>
                  <td className="px-1 py-1">
                    <select value={doc.status} onChange={(e) => upd(doc.id, "status", e.target.value)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="date" value={doc.dataObtencao ?? ""} onChange={(e) => upd(doc.id, "dataObtencao", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1"><input value={doc.observacoes ?? ""} onChange={(e) => upd(doc.id, "observacoes", e.target.value)} className={inputCls} placeholder="Observações" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
