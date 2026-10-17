"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Paperclip } from "lucide-react";
import { criarContratoDoLead } from "@/lib/actions/contratos";
import { marcarAssinaturaStatus } from "@/lib/actions/juridico";
import { enviarFormComProgresso } from "@/lib/envio-progresso";
import { TIPOS_CONTRATO } from "@/lib/juridico/tipos-contrato";
import { rotulo } from "@/lib/rotulos";

type Contrato = {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  assinaturaStatus: string;
  documentos: { id: string; nome: string; url: string; tipo: string }[];
};

const botao = "inline-flex items-center gap-1 border border-[var(--brand-dark)] px-2 py-1 text-[11px] font-bold text-[var(--brand-dark)] hover:bg-[var(--brand-yellow)] disabled:opacity-50";

/**
 * Item 11 (18/10): contratos do cliente — criados no Jurídico (fonte única,
 * numeração do Jurídico) e listados aqui, com assinatura e anexo do PDF.
 */
export function LeadContratos({ leadId, contratos, podeJuridico }: { leadId: string; contratos: Contrato[]; podeJuridico: boolean }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<string>("prestacao_servicos");
  const [valor, setValor] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, start] = useTransition();
  const [anexando, setAnexando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  function criar() {
    start(async () => {
      const r = await criarContratoDoLead(leadId, tipo, Number(valor.replace(/\./g, "").replace(",", ".")) || 0);
      setMsg(r.ok ? { ok: true, texto: `Contrato ${r.numero} criado no Jurídico.` } : { ok: false, texto: r.erro });
      if (r.ok) { setValor(""); router.refresh(); }
    });
  }

  async function anexar(file?: File) {
    if (arquivo.current) arquivo.current.value = "";
    const id = anexando;
    if (!file || !id) return;
    const dados = new FormData();
    dados.set("arquivo", file);
    try {
      await enviarFormComProgresso(`/api/juridico/contratos/${id}/pdf`, dados, { item: "PDF" });
      setMsg({ ok: true, texto: "PDF anexado ao contrato." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "Falha ao anexar o PDF." });
    } finally {
      setAnexando(null);
    }
  }

  return (
    <div className="space-y-3">
      {contratos.length === 0 && (
        <p className="text-xs text-gray-700">Nenhum contrato para este cliente. Contratos criados no Jurídico para ele também aparecem aqui.</p>
      )}
      {contratos.map((c) => (
        <div key={c.id} className="border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-3 py-2">
            <div className="min-w-0">
              <p className="break-words text-xs font-bold text-[var(--brand-dark)]">{c.numero} · {rotulo(c.tipo)}</p>
              <p className="text-[11px] text-gray-700">Situação: {rotulo(c.status)} · Assinatura: {rotulo(c.assinaturaStatus)}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Link href={`/admin/juridico?contrato=${c.id}#contrato-${c.id}`} className={botao}><ExternalLink size={11} /> Abrir no Jurídico</Link>
              <button
                type="button"
                className={botao}
                disabled={pendente || c.assinaturaStatus === "assinado" || c.assinaturaStatus === "solicitado"}
                onClick={() => start(async () => {
                  try { await marcarAssinaturaStatus(c.id, "solicitado"); setMsg({ ok: true, texto: "Assinatura solicitada." }); router.refresh(); }
                  catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : "Falha ao solicitar assinatura." }); }
                })}
              >
                {c.assinaturaStatus === "solicitado" ? "Assinatura solicitada" : "Solicitar assinatura"}
              </button>
              {podeJuridico && (
                <button type="button" className={botao} disabled={anexando !== null} onClick={() => { setAnexando(c.id); arquivo.current?.click(); }}>
                  <Paperclip size={11} /> Anexar PDF
                </button>
              )}
            </div>
          </div>
          {c.documentos.length > 0 && (
            <div className="divide-y divide-gray-100">
              {c.documentos.map((doc) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                  <FileText size={12} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{doc.nome} · {rotulo(doc.tipo)}</span>
                  <Download size={11} className="shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      <input ref={arquivo} type="file" accept="application/pdf" className="sr-only" aria-label="Selecionar PDF do contrato" onChange={(e) => void anexar(e.target.files?.[0])} />
      {podeJuridico && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Novo contrato no Jurídico</p>
          <select aria-label="Tipo de contrato" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-xs text-[var(--brand-dark)]">
            {TIPOS_CONTRATO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input aria-label="Valor do contrato" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor (opcional)" className="w-full border border-gray-300 px-3 py-2 text-xs text-[var(--brand-dark)] placeholder:text-gray-600" />
          <button type="button" onClick={criar} disabled={pendente} className="w-full bg-[var(--brand-yellow)] py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-dark)] disabled:opacity-60">
            Criar contrato no Jurídico
          </button>
          <p className="text-[11px] text-gray-700">Número do Jurídico e nome do cliente preenchidos automaticamente.</p>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.texto}</p>}
    </div>
  );
}
