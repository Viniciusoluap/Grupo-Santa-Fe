"use client";
// Lote 2, correção 04 (AD-02): dados profissionais e documentos do Engenheiro, em
// Configurações › Usuários. Só o admin edita; o próprio usuário pode consultar.
import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileArchive, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { excluirDocumentoUsuario, obterPerfilEngenheiro, salvarPerfilEngenheiro } from "@/lib/actions/engenheiro";
import { baixarDocumentoUsuario, baixarTodosDocumentosUsuario, enviarDocumentoUsuario, visualizarDocumentoUsuario } from "@/lib/documentos-usuario-cliente";
import {
  ACCEPT_DOCUMENTO_USUARIO, CATEGORIAS_DOCUMENTO_USUARIO, LIMITE_DOCUMENTO_USUARIO_BYTES, ROTULO_CATEGORIA_DOCUMENTO, UFS,
  type CategoriaDocumentoUsuario,
} from "@/lib/engenheiro";

type Dados = Exclude<Awaited<ReturnType<typeof obterPerfilEngenheiro>>, { erro: string }>;
type Form = { telefone: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; crea: string; creaUf: string; creasAdicionais: { numero: string; uf: string }[] };
const VAZIO: Form = { telefone: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", crea: "", creaUf: "", creasAdicionais: [] };
const rotulo = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";
const campo = "w-full border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand-yellow)] disabled:bg-gray-50";
const botao = "inline-flex items-center gap-1 border border-gray-200 px-2 py-1 text-xs font-bold text-[var(--brand-dark)] hover:bg-gray-50 disabled:opacity-50";
const tamanho = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export function PerfilEngenheiro({ usuarioId }: { usuarioId: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(VAZIO);
  const [categoria, setCategoria] = useState<CategoriaDocumentoUsuario>("documento_pessoal");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await obterPerfilEngenheiro(usuarioId);
    if ("erro" in r) { setErro(r.erro ?? "Falha ao carregar."); return; }
    setDados(r);
    const p = r.perfil;
    setForm({ telefone: p.telefone ?? "", cep: p.cep ?? "", logradouro: p.logradouro ?? "", numero: p.numero ?? "", complemento: p.complemento ?? "", bairro: p.bairro ?? "", cidade: p.cidade ?? "", uf: p.uf ?? "", crea: p.crea ?? "", creaUf: p.creaUf ?? "", creasAdicionais: p.creasAdicionais });
  }, [usuarioId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function executar(texto: string, fn: () => Promise<unknown>) {
    setOcupado(texto); setMsg(null);
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Falha na operação."); } finally { setOcupado(null); }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    await executar("Salvando…", async () => {
      const r = await salvarPerfilEngenheiro(usuarioId, { ...form, creasAdicionais: form.creasAdicionais.filter((c) => c.numero.trim() || c.uf) });
      if ("erro" in r) throw new Error(r.erro);
      await carregar();
      setMsg("Dados do engenheiro salvos.");
    });
  }

  async function enviar(arquivos: File[], cat: CategoriaDocumentoUsuario, substituirId?: string) {
    if (!arquivos.length) return;
    const grandes = arquivos.filter((f) => !f.size || f.size > LIMITE_DOCUMENTO_USUARIO_BYTES);
    if (grandes.length) { setMsg(`Envie arquivos de até 15 MB: ${grandes.map((f) => f.name).join(", ")}`); return; }
    const falhas: string[] = [];
    let ok = 0;
    for (let i = 0; i < arquivos.length; i++) {
      const f = arquivos[i];
      try {
        await enviarDocumentoUsuario(usuarioId, cat, f, substituirId, (p, t) => setOcupado(`Enviando ${i + 1}/${arquivos.length}: ${f.name} (${p}/${t})`));
        ok++;
      } catch (e) { falhas.push(`${f.name}: ${e instanceof Error ? e.message : "falha"}`); }
    }
    setOcupado(null);
    await carregar();
    setMsg([ok ? (substituirId ? "Documento substituído." : `${ok} documento(s) enviado(s).`) : "", ...falhas].filter(Boolean).join(" "));
  }

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!dados) return <p className="text-sm text-gray-600">Carregando dados do engenheiro…</p>;
  const pode = dados.podeGerenciar;
  const docs = dados.documentos;

  return (
    <div className="w-full space-y-4 border-t border-gray-100 pt-3 mt-1">
      <form onSubmit={salvar} className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase">Dados do engenheiro</p>
        <p className="text-xs text-gray-600">Nome e e-mail vêm do cadastro do usuário ({dados.usuario.nome} · {dados.usuario.email}).</p>
        <fieldset disabled={!pode} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div><label className={rotulo}>Telefone</label><input value={form.telefone} onChange={set("telefone")} inputMode="tel" className={campo} /></div>
          <div><label className={rotulo}>Nº do CREA</label><input value={form.crea} onChange={set("crea")} className={campo} /></div>
          <div><label className={rotulo}>UF do CREA</label><select aria-label="UF do CREA" value={form.creaUf} onChange={set("creaUf")} className={campo}><option value="">—</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div><label className={rotulo}>CEP</label><input value={form.cep} onChange={set("cep")} inputMode="numeric" placeholder="00000-000" className={campo} /></div>
          <div className="sm:col-span-2"><label className={rotulo}>Logradouro</label><input value={form.logradouro} onChange={set("logradouro")} className={campo} /></div>
          <div><label className={rotulo}>Número</label><input value={form.numero} onChange={set("numero")} className={campo} /></div>
          <div><label className={rotulo}>Complemento</label><input value={form.complemento} onChange={set("complemento")} className={campo} /></div>
          <div><label className={rotulo}>Bairro</label><input value={form.bairro} onChange={set("bairro")} className={campo} /></div>
          <div><label className={rotulo}>Cidade</label><input value={form.cidade} onChange={set("cidade")} className={campo} /></div>
          <div><label className={rotulo}>UF</label><select aria-label="UF do endereço" value={form.uf} onChange={set("uf")} className={campo}><option value="">—</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
          <div className="sm:col-span-3 space-y-1">
            <label className={rotulo}>CREAs adicionais (outros estados)</label>
            {form.creasAdicionais.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Nº do CREA adicional ${i + 1}`} value={c.numero} placeholder="Número" onChange={(e) => setForm((f) => ({ ...f, creasAdicionais: f.creasAdicionais.map((x, j) => j === i ? { ...x, numero: e.target.value } : x) }))} className={campo} />
                <select aria-label={`UF do CREA adicional ${i + 1}`} value={c.uf} onChange={(e) => setForm((f) => ({ ...f, creasAdicionais: f.creasAdicionais.map((x, j) => j === i ? { ...x, uf: e.target.value } : x) }))} className={`${campo} max-w-[6rem]`}><option value="">UF</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
                <button type="button" aria-label="Remover CREA adicional" onClick={() => setForm((f) => ({ ...f, creasAdicionais: f.creasAdicionais.filter((_, j) => j !== i) }))} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
            <button type="button" className={botao} onClick={() => setForm((f) => ({ ...f, creasAdicionais: [...f.creasAdicionais, { numero: "", uf: "" }] }))}><Plus size={12} /> Adicionar CREA de outro estado</button>
          </div>
        </fieldset>
        {pode && <button type="submit" disabled={!!ocupado} className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold px-3 py-1.5 disabled:opacity-50">Salvar dados do engenheiro</button>}
      </form>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-500 uppercase">Documentos</p>
          <button type="button" className={botao} disabled={!docs.length || !!ocupado} onClick={() => void executar("Montando o ZIP…", () => baixarTodosDocumentosUsuario(usuarioId, dados.usuario.nome, docs))}><FileArchive size={12} /> Baixar todos (ZIP)</button>
        </div>
        {pode && (
          <div className="flex flex-wrap items-end gap-2">
            <div><label className={rotulo}>Categoria</label><select aria-label="Categoria do documento" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumentoUsuario)} className={campo}>{CATEGORIAS_DOCUMENTO_USUARIO.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA_DOCUMENTO[c]}</option>)}</select></div>
            <label className="inline-flex cursor-pointer items-center gap-1 bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold px-3 py-2"><Upload size={12} /> Enviar arquivos<input type="file" multiple className="sr-only" accept={ACCEPT_DOCUMENTO_USUARIO} disabled={!!ocupado} onChange={(e) => { const lista = Array.from(e.target.files ?? []); e.currentTarget.value = ""; void enviar(lista, categoria); }} /></label>
            <p className="text-xs text-gray-500">PDF, imagem, Word ou Excel · até 15 MB cada · vários de uma vez.</p>
          </div>
        )}
        {ocupado && <p role="status" className="text-xs font-bold text-[var(--brand-dark)]">{ocupado}</p>}
        {msg && <p role="status" className="text-xs text-blue-800">{msg}</p>}
        {!docs.length && <p className="text-xs text-gray-500">Nenhum documento enviado.</p>}
        {CATEGORIAS_DOCUMENTO_USUARIO.filter((c) => docs.some((d) => d.categoria === c)).map((c) => (
          <div key={c} className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{ROTULO_CATEGORIA_DOCUMENTO[c]}</p>
            {docs.filter((d) => d.categoria === c).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 px-2 py-1.5 text-xs">
                <div className="min-w-0"><p className="break-all font-bold text-[var(--brand-dark)]">{d.nome}</p><p className="text-gray-500">{tamanho(d.tamanho)} · {new Date(d.enviadoEm).toLocaleString("pt-BR")}{d.enviadoPorNome ? ` · por ${d.enviadoPorNome}` : ""}</p></div>
                <div className="flex flex-wrap gap-1">
                  {d.visualizavel && <button type="button" className={botao} disabled={!!ocupado} onClick={() => void executar("Abrindo…", () => visualizarDocumentoUsuario(usuarioId, d))}><Eye size={12} /> Visualizar</button>}
                  <button type="button" className={botao} disabled={!!ocupado} onClick={() => void executar("Baixando…", () => baixarDocumentoUsuario(usuarioId, d))}><Download size={12} /> Baixar</button>
                  {pode && <label className={`${botao} cursor-pointer`}><RefreshCw size={12} /> Substituir<input type="file" className="sr-only" accept={ACCEPT_DOCUMENTO_USUARIO} disabled={!!ocupado} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f && window.confirm(`Substituir "${d.nome}" por "${f.name}"? O arquivo anterior será descartado.`)) void enviar([f], c, d.id); }} /></label>}
                  {pode && <button type="button" className={`${botao} text-red-600`} disabled={!!ocupado} onClick={() => { if (window.confirm(`Excluir "${d.nome}"? O arquivo será apagado definitivamente.`)) void executar("Excluindo…", async () => { const r = await excluirDocumentoUsuario(usuarioId, d.id); if ("erro" in r) throw new Error(r.erro); await carregar(); setMsg("Documento excluído."); }); }}><Trash2 size={12} /> Excluir</button>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
