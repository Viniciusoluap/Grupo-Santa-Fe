"use client";
// Lote 23/10, etapa 2C — "Solicitar revisão" de projeto: pedido, histórico e entrega
// da versão revisada no próprio card.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarRevisaoProjeto } from "@/lib/actions/projetos";
import { exigirResultado } from "@/lib/acao-resultado";
import { uploadProjectDocument } from "@/lib/project-upload";
import { LIMITE_PEDIDO_REVISAO, ROTULO_SITUACAO_REVISAO, rotuloCanal, validarPedidoRevisao, type EntregaRevisao, type SituacaoRevisao } from "@/lib/projeto-revisao";
import { Modal } from "@/components/ui/modal";

export type RevisaoView = { id: string; texto: string; status: string; solicitadoPorNome: string; criadoEm: string; situacaoNotificacao: string; situacaoEmail: string; entregas: EntregaRevisao[] };

const dataHora = (v: string) => new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function ProjetoRevisoes({ projetoId, projetoNome, engenheiro, revisoes, abrirPedido = false }: { projetoId: string; projetoNome: string; engenheiro: string | null; revisoes: RevisaoView[]; abrirPedido?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(abrirPedido);
  const [texto, setTexto] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "aviso" | "erro"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);

  function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        validarPedidoRevisao(texto);
        const r = exigirResultado(await solicitarRevisaoProjeto(projetoId, texto));
        setMensagem(r.mensagem);
        setTexto(""); setAberto(false);
        router.refresh();
      } catch (error) {
        setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível salvar o pedido." });
      }
    });
  }

  return (
    <section className="space-y-3 rounded border border-gray-200 bg-white p-5 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Revisões</h2>
        <button type="button" onClick={() => setAberto(true)} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">Solicitar revisão</button>
      </div>
      {mensagem && <p role="status" className={`rounded px-3 py-2 text-sm ${mensagem.tipo === "ok" ? "bg-emerald-50 text-emerald-900" : mensagem.tipo === "aviso" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{mensagem.texto}</p>}
      {!revisoes.length && <p className="text-sm text-gray-600">Nenhuma revisão solicitada.</p>}
      {revisoes.map(r => (
        <article key={r.id} className="space-y-1 rounded border border-gray-200 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.status === "entregue" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{ROTULO_SITUACAO_REVISAO[r.status as SituacaoRevisao] ?? r.status}</span>
            <span>Pedido por {r.solicitadoPorNome} em {dataHora(r.criadoEm)}</span>
          </p>
          <p className="whitespace-pre-wrap">{r.texto}</p>
          <p className="text-xs text-gray-600">{rotuloCanal("notificacao", r.situacaoNotificacao)} · {rotuloCanal("email", r.situacaoEmail)}</p>
          {r.entregas.length > 0 && <ul className="space-y-0.5">{r.entregas.map(d => <li key={d.driveFileId}><a className="underline" href={d.url} target="_blank" rel="noopener noreferrer">{d.tipo === "pdf" ? "PDF" : "Editável"}: {d.nome}</a> — entregue por {d.enviadoPor} em {dataHora(d.enviadoEm)}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            {(["editable", "pdf"] as const).map(kind => (
              <label key={kind} className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-xs">
                {kind === "pdf" ? "Entregar PDF revisado" : "Entregar editável revisado"}
                <input className="hidden" type="file" accept={kind === "pdf" ? ".pdf,application/pdf" : undefined} disabled={!!enviando} onChange={async e => {
                  const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
                  setEnviando(`${r.id}-${kind}`); setProgresso(0); setMensagem(null);
                  try {
                    await uploadProjectDocument(`/api/projetos/${projetoId}/documentos`, file, `revisao-${r.id}`, kind, setProgresso, { revisionId: r.id });
                    setMensagem({ tipo: "ok", texto: "Versão revisada salva no Google Drive." });
                    router.refresh();
                  } catch (error) { setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Falha no envio." }); }
                  finally { setEnviando(null); }
                }} />
              </label>
            ))}
          </div>
        </article>
      ))}
      {enviando && <p role="status" className="text-sm">Enviando ao Google Drive: {progresso}%</p>}
      {aberto && (
        <Modal rotulo="Solicitar revisão" onFechar={() => !pending && setAberto(false)} tamanho="xl" className="rounded text-gray-900">
          <form onSubmit={enviarPedido} className="space-y-3 p-6">
            <h2 className="text-xl font-bold">Solicitar revisão — {projetoNome}</h2>
            <p className="text-sm text-gray-600">Colaborador vinculado: {engenheiro?.trim() || "nenhum (o pedido será salvo, mas ninguém será notificado)"}</p>
            <label className="block text-sm font-semibold" htmlFor="pedido-revisao">Modificação solicitada</label>
            <textarea id="pedido-revisao" className="min-h-40 w-full rounded border border-gray-300 p-2 text-sm" maxLength={LIMITE_PEDIDO_REVISAO} value={texto} onChange={e => setTexto(e.target.value)} required />
            <p className="text-xs text-gray-500">{texto.length}/{LIMITE_PEDIDO_REVISAO}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm" onClick={() => setAberto(false)}>Cancelar</button>
              <button type="submit" disabled={pending} className="rounded bg-[var(--brand-dark)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvando…" : "Enviar pedido"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
