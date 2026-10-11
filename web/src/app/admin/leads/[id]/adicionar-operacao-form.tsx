"use client";

import { useRef, useState, useTransition } from "react";
import { adicionarOperacaoLead } from "@/lib/actions/leads";
import { SERVICOS_LEAD, moduloDoServico } from "@/lib/crm/servicos-lead";

export function AdicionarOperacaoForm({ leadId, servicos }: { leadId: string; servicos: string[] }) {
  const [servico, setServico] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pending, startTransition] = useTransition();
  const requestKey = useRef<string | null>(null);
  const servicosOperacionais = SERVICOS_LEAD.filter((s) => servicos.includes(s) && moduloDoServico(s));
  return <form action={() => {
    if (!servico || pending) return;
    requestKey.current ??= crypto.randomUUID();
    const key = requestKey.current;
    setErro(null); setSucesso(false);
    startTransition(async () => {
      try { await adicionarOperacaoLead(leadId, servico, key); requestKey.current = null; setServico(""); setSucesso(true); }
      catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível adicionar a operação."); }
    });
  }} className="mt-4 pt-4 border-t border-gray-100 space-y-2">
    <label className="block text-xs font-bold text-gray-600">Adicionar nova operação para este cliente
      <select required disabled={pending} value={servico} onChange={(e) => { setServico(e.target.value); requestKey.current = null; setSucesso(false); }} className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-xs bg-white font-normal"><option value="">Selecione o serviço</option>{servicosOperacionais.map((s) => <option key={s} value={s}>{s}</option>)}</select>
    </label>
    <p className="text-xs text-gray-600">Cria outro atendimento para um serviço selecionado neste lead. Para incluir um serviço diferente, edite o cadastro do lead.</p>
    <button disabled={pending || !servico} className="rounded bg-[var(--brand-yellow)] px-3 py-2 font-bold text-xs text-[var(--brand-dark)] disabled:opacity-50">{pending ? "Adicionando..." : "Adicionar operação"}</button>
    {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}{sucesso && <p role="status" className="text-xs text-green-700">Operação adicionada.</p>}
  </form>;
}
