"use client";
import { useState } from "react";
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, ROTULOS_OPERACIONAIS, TIPOS_DESPESA_OBRA, type CatalogoBpo } from "@/lib/bpo-operacional";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

export function CamposOperacionais({ tipo, catalogo, inicial, obrigatorio = true }: { tipo: string; catalogo: CatalogoBpo; obrigatorio?: boolean; inicial?: { categoriaOperacional: string | null; vinculoOperacionalId?: string | null; etapa?: string | null; tipoDespesaObra?: string | null } }) {
  const [categoria, setCategoria] = useState(inicial?.categoriaOperacional ?? "");
  const [registro, setRegistro] = useState(inicial?.vinculoOperacionalId ?? "");
  const [busca, setBusca] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const chave = tipo === "despesa" && categoria === "comissoes" ? "imoveis" : categoria;
  const opcoes = catalogo[chave] ?? [];
  const selecionado = opcoes.find((r) => r.id === registro);
  const categorias = tipo === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
  const cls = "mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900";
  return <fieldset className="space-y-3 rounded border border-gray-200 p-3">
    <legend className="px-1 text-xs font-bold">Vínculo com o serviço</legend>
    <input type="hidden" name="requestKey" value={requestKey}/>
    <label className="block text-xs font-bold">Categoria operacional<select name="categoriaOperacional" required={obrigatorio} value={categoria} onChange={(e) => { setCategoria(e.target.value); setRegistro(""); setBusca(""); }} className={cls}><option value="">Selecione</option>{categorias.map((c) => <option key={c} value={c}>{ROTULOS_OPERACIONAIS[c]}</option>)}</select></label>
    {categoria && <><input aria-label="Buscar registro operacional" placeholder="Buscar registro vinculado" value={busca} onChange={(e) => setBusca(e.target.value)} className={cls}/><label className="block text-xs font-bold">{tipo === "despesa" && categoria === "comissoes" ? "Imóvel vinculado" : categoria === "incorporacao" ? "Empreendimento vinculado" : categoria === "obras" ? "Obra vinculada" : "Registro vinculado"}<select name="vinculoOperacionalId" value={registro} required onChange={(e) => setRegistro(e.target.value)} className={cls}><option value="">Selecione um registro cadastrado</option>{opcoes.filter((r) => r.id === registro || `${r.rotulo} ${r.clienteNome ?? ""}`.toLowerCase().includes(busca.toLowerCase())).map((r) => <option key={r.id} value={r.id}>{r.rotulo}{r.clienteNome ? ` — ${r.clienteNome}` : ""}</option>)}</select></label>{selecionado && <p className="text-xs text-gray-600">{selecionado.clienteNome && <>Cliente: {selecionado.clienteNome} · </>}<a className="underline" href={selecionado.href} target="_blank" rel="noreferrer">Abrir serviço</a></p>}</>}
    {tipo === "despesa" && categoria === "obras" && <><label className="block text-xs font-bold">Tipo de despesa<select name="tipoDespesaObra" required defaultValue={inicial?.tipoDespesaObra ?? ""} className={cls}><option value="">Selecione</option>{TIPOS_DESPESA_OBRA.map((t) => <option key={t}>{t}</option>)}</select></label><label className="block text-xs font-bold">Etapa<select name="etapa" defaultValue={inicial?.etapa ?? ""} className={cls}><option value="">Sem etapa específica</option>{SERVICOS_PROGRESSO.map((s) => <option key={s.chave} value={s.chave}>{s.nome}</option>)}</select></label></>}
  </fieldset>;
}
