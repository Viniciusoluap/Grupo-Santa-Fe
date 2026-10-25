"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { excluirImovel } from "@/lib/actions/imoveis";
import { enviarImovelComFotos } from "@/lib/envio-fotos-imovel";
import { DIAS_AVISO_RECUSA, ROTULO_TIPO_IMOVEL, TIPOS_IMOVEL_CORRETOR } from "@/lib/portal-corretor";
import { formatCurrency } from "@/lib/utils";
import { FotoUpload } from "@/app/admin/imoveis/_components/foto-upload";
import { PrecoInput } from "@/app/admin/imoveis/_components/preco-input";
import { AreaInput } from "@/components/ui/area-input";
import type { ImovelDoPortal } from "@/lib/corretor/portal";

const campo = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[var(--brand-yellow)] focus:outline-none";
const SITUACAO: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: "Pendente", cor: "bg-amber-500 text-[var(--brand-dark)]" },
  recusado: { texto: "Recusado", cor: "bg-red-600 text-white" },
  aprovado: { texto: "Aprovado", cor: "bg-emerald-700 text-white" },
};

function Campo({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} className={campo} {...props} />
    </div>
  );
}

export function ImoveisDoCorretor({ imoveis }: { imoveis: ImovelDoPortal[] }) {
  const router = useRouter();
  // Item 3 (18/10): o mesmo formulário cadastra e edita o próprio imóvel.
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ImovelDoPortal | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [excluindo, startExcluir] = useTransition();

  function abrir(imovel: ImovelDoPortal | null) {
    setEditando(imovel);
    setAberto(true);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function fechar() {
    setAberto(false);
    setEditando(null);
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    if (!(Number(dados.get("preco")) > 0)) {
      setMsg({ ok: false, texto: "Informe o preço do imóvel." });
      return;
    }
    if (editando) dados.set("id", editando.id);
    setEnviando(true);
    setMsg(null);
    try {
      await enviarImovelComFotos(dados);
      setMsg({ ok: true, texto: editando ? "Alterações enviadas para revisão." : "Imóvel enviado para revisão." });
      fechar();
      router.refresh();
    } catch (falha) {
      setMsg({ ok: false, texto: falha instanceof Error ? falha.message : "Falha ao enviar o imóvel." });
    } finally {
      setEnviando(false);
    }
  }

  function excluir(imovel: ImovelDoPortal) {
    if (!confirm(`Excluir definitivamente "${imovel.titulo}"? Esta ação não pode ser desfeita.`)) return;
    startExcluir(async () => {
      try {
        await excluirImovel(imovel.id);
        setMsg({ ok: true, texto: "Imóvel excluído." });
        router.refresh();
      } catch (falha) {
        setMsg({ ok: false, texto: falha instanceof Error ? falha.message : "Falha ao excluir o imóvel." });
      }
    });
  }

  const tipoForaDaLista = editando && !TIPOS_IMOVEL_CORRETOR.some((t) => t.value === editando.tipo) ? editando.tipo : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Imóveis</h1>
          <p className="text-slate-600">Consulte o catálogo e envie novos imóveis para revisão.</p>
        </div>
        <button type="button" onClick={() => (aberto ? fechar() : abrir(null))}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-dark)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo imóvel
        </button>
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-md border p-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.texto}
        </p>
      )}

      {aberto && (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{editando ? "Editar imóvel" : "Cadastrar imóvel"}</h2>
          {editando && <p className="text-sm text-slate-600">Ao salvar, o imóvel volta para a revisão da equipe antes de aparecer no site.</p>}
          <form key={editando?.id ?? "novo"} className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={enviar} aria-busy={enviando}>
            <Campo name="titulo" label="Título" required defaultValue={editando?.titulo ?? ""} />
            <div>
              <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo</label>
              <select id="tipo" name="tipo" required defaultValue={editando?.tipo ?? ""} className={campo}>
                <option value="" disabled>Selecione...</option>
                {tipoForaDaLista && <option value={tipoForaDaLista}>{ROTULO_TIPO_IMOVEL[tipoForaDaLista] ?? tipoForaDaLista}</option>}
                {TIPOS_IMOVEL_CORRETOR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Preço</label>
              <PrecoInput name="preco" required defaultValue={editando?.preco} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Área (m²)</label>
              <AreaInput name="area" defaultValue={editando?.area ?? null} className={campo} />
            </div>
            <Campo name="quartos" label="Quartos" type="number" min={0} defaultValue={editando?.quartos ?? ""} />
            <Campo name="banheiros" label="Banheiros" type="number" min={0} defaultValue={editando?.banheiros ?? ""} />
            <Campo name="vagas" label="Vagas" type="number" min={0} defaultValue={editando?.vagas ?? ""} />
            <Campo name="cidade" label="Cidade" required defaultValue={editando?.cidade ?? "Canaã dos Carajás"} />
            <Campo name="estado" label="UF" maxLength={2} defaultValue={editando?.estado ?? "PA"} />
            <Campo name="bairro" label="Bairro" defaultValue={editando?.bairro ?? ""} />
            <div className="md:col-span-2">
              <Campo name="rua" label="Endereço" defaultValue={editando?.rua ?? ""} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="descricao" className="mb-1 block text-sm font-medium">Descrição</label>
              <textarea id="descricao" name="descricao" rows={3} defaultValue={editando?.descricao ?? ""} className={campo} />
            </div>
            <div className="md:col-span-2">
              <FotoUpload name="imagens" defaultValue={JSON.stringify(editando?.fotos ?? [])} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
              <button disabled={enviando} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--brand-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <Upload className="h-4 w-4" />
                {enviando ? "Enviando..." : editando ? "Salvar e enviar para revisão" : "Enviar para revisão"}
              </button>
              <button type="button" onClick={fechar} disabled={enviando} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {imoveis.map((imovel) => {
          const situacao = SITUACAO[imovel.revisaoStatus] ?? SITUACAO.aprovado;
          return (
            <article key={imovel.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex justify-between gap-2">
                <h2 className="text-lg font-semibold">{imovel.titulo}</h2>
                {imovel.meuCadastro && <span className="h-fit shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold">Meu cadastro</span>}
              </div>
              {/* Item 8 (18/10): recusado já excluído mostra só o título e o aviso. */}
              {!imovel.excluido && (
                <>
                  <p className="mt-2 font-bold">{formatCurrency(imovel.preco)}</p>
                  <p className="text-sm text-slate-600">
                    {imovel.bairro ? `${imovel.bairro}, ` : ""}
                    {imovel.cidade}/{imovel.estado}
                  </p>
                </>
              )}
              {imovel.meuCadastro && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span>Revisão:</span>
                  <span className={`rounded-md px-2 py-0.5 font-bold ${situacao.cor}`}>{situacao.texto}</span>
                </div>
              )}
              {imovel.meuCadastro && imovel.revisaoStatus === "recusado" && (
                <p className="mt-1 text-xs text-slate-600">
                  {imovel.excluido ? "Cadastro excluído pela equipe. " : ""}Este aviso some da sua lista em até {DIAS_AVISO_RECUSA} dias.
                </p>
              )}
              {imovel.meuCadastro && !imovel.excluido && (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => abrir(imovel)} disabled={enviando}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button type="button" onClick={() => excluir(imovel)} disabled={excluindo}
                    className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Excluir
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {imoveis.length === 0 && <p className="rounded-xl border bg-white p-10 text-center text-slate-600 md:col-span-2 lg:col-span-3">Nenhum imóvel no catálogo.</p>}
      </div>
    </>
  );
}
