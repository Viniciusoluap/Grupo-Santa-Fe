"use client";

import { useState, useTransition } from "react";
import { Users, Plus, KeyRound, Trash2, ToggleLeft, ToggleRight, X, Shield } from "lucide-react";
import { criarUsuario, alternarAtivo, redefinirSenha, excluirUsuario, salvarPermissoes, alterarPerfilUsuario } from "@/lib/actions/usuarios";
import { MODULOS_PAINEL } from "@/lib/auth/modulos-lista";
import { UFS } from "@/lib/engenheiro";
import { PerfilEngenheiro } from "./perfil-engenheiro";
import { Modal } from "@/components/ui/modal";

// Lote 2, correção 04: "engenheiro" é perfil da tela — no acesso é colaborador + perfil profissional.
type Papel = "admin" | "colaborador" | "engenheiro" | "corretor" | "cliente" | "empreiteiro";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  creci: string | null;
  telefone: string | null;
  permissoes: string | null;  // JSON string
  leadId: string | null;
  leadNome: string | null;
  leadTelefone: string | null;
  engenheiro: boolean;
}

interface LeadOpcao { id: string; nome: string; email: string | null; telefone: string | null }

const PAPEIS: { value: Papel; label: string; cor: string }[] = [
  { value: "admin",       label: "Admin",       cor: "bg-red-100 text-red-700" },
  { value: "colaborador", label: "Colaborador", cor: "bg-purple-100 text-purple-700" },
  { value: "engenheiro",  label: "Engenheiro",  cor: "bg-teal-100 text-teal-800" },
  { value: "corretor",    label: "Corretor",    cor: "bg-blue-100 text-blue-700" },
  { value: "cliente",     label: "Cliente",     cor: "bg-green-100 text-green-700" },
  { value: "empreiteiro", label: "Empreiteiro", cor: "bg-amber-100 text-amber-800" },
];

const MODULOS = MODULOS_PAINEL;

function Badge({ papel }: { papel: string }) {
  const cfg = PAPEIS.find((p) => p.value === papel);
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 ${cfg?.cor ?? "bg-gray-100 text-gray-600"}`}>
      {cfg?.label ?? papel}
    </span>
  );
}

interface Props {
  usuarios: Usuario[];
  /** Clientes do CRM ainda sem conta (para vincular a conta de cliente). */
  leadsSemConta: LeadOpcao[];
}

export function UsuariosClient({ usuarios, leadsSemConta }: Props) {
  const [papelNovo, setPapelNovo] = useState<Papel>("colaborador");
  const [buscaLead, setBuscaLead] = useState("");
  // Item 12 (18/10): conta de cliente com nome e telefone do cadastro no CRM.
  const [nomeNovo, setNomeNovo] = useState("");
  const [foneNovo, setFoneNovo] = useState("");
  const [linkGerado, setLinkGerado] = useState<{ link: string; emailEnviado: boolean } | null>(null);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [aba, setAba] = useState<Papel | "todos">("todos");
  const [showForm, setShowForm] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [permissoesId, setPermissoesId] = useState<string | null>(null);
  const [engenheiroId, setEngenheiroId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const perfilDe = (u: Usuario): Papel => (u.engenheiro ? "engenheiro" : (u.papel as Papel));
  const filtrados = aba === "todos" ? usuarios : usuarios.filter((u) => perfilDe(u) === aba);

  function feedback(texto: string) {
    setMsg(texto);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleCriar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await criarUsuario(fd);
      if (res?.error) { feedback(`Erro: ${res.error}`); return; }
      setShowForm(false);
      if (res && "link" in res && res.link) setLinkGerado({ link: res.link, emailEnviado: Boolean(res.emailEnviado) });
      feedback("Usuário cadastrado com sucesso!");
    });
  }

  async function handleAlterarPerfil(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await alterarPerfilUsuario(id, String(fd.get("papel")), (fd.get("leadId") as string) || null);
      if (res?.error) { feedback(`Erro: ${res.error}`); return; }
      setPerfilId(null);
      feedback("Perfil alterado. A sessão antiga do usuário foi encerrada.");
    });
  }

  async function handleToggle(id: string, ativo: boolean) {
    startTransition(async () => {
      const res = await alternarAtivo(id, !ativo);
      if (res?.error) { feedback(`Erro: ${res.error}`); return; }
      feedback(!ativo ? "Usuário ativado" : "Usuário desativado");
    });
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await redefinirSenha(fd);
      if (res?.error) { feedback(`Erro: ${res.error}`); return; }
      setResetId(null);
      feedback("Senha redefinida!");
    });
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const res = await excluirUsuario(id);
      if (res?.error) { feedback(`Erro: ${res.error}`); return; }
      feedback("Usuário excluído.");
    });
  }

  async function handleTogglePerm(userId: string, moduloId: string, currentPerms: string[]) {
    const newPerms = currentPerms.includes(moduloId)
      ? currentPerms.filter((p) => p !== moduloId)
      : [...currentPerms, moduloId];
    startTransition(async () => {
      await salvarPermissoes(userId, newPerms);
      feedback(`Permissão ${newPerms.includes(moduloId) ? "concedida" : "removida"}`);
    });
  }

  return (
    <div className="bg-white border border-gray-100 p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--brand-dark)]" />
          <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">
            Usuários do Sistema
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold uppercase px-3 py-2 hover:bg-black transition-colors"
        >
          <Plus size={13} /> Novo usuário
        </button>
      </div>

      {linkGerado && (
        <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p className="font-bold">{linkGerado.emailEnviado ? "Link de primeiro acesso enviado por e-mail." : "E-mail não enviado: repasse este link de primeiro acesso ao usuário (vale 7 dias)."}</p>
          <p className="break-all font-mono">{linkGerado.link}</p>
          <button type="button" onClick={() => setLinkGerado(null)} className="text-blue-700 underline">Fechar</button>
        </div>
      )}

      {msg && (
        <div className="bg-[var(--brand-yellow)]/20 border border-[var(--brand-yellow)] px-3 py-2 text-xs font-bold text-[var(--brand-dark)]">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-100 pb-0">
        {(["todos", "admin", "colaborador", "engenheiro", "corretor", "cliente", "empreiteiro"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setAba(p)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
              aba === p
                ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                : "border-transparent text-gray-600 hover:text-gray-600"
            }`}
          >
            {p === "todos" ? "Todos" : PAPEIS.find((x) => x.value === p)?.label}
            <span className="ml-1 text-[10px]">
              ({p === "todos" ? usuarios.length : usuarios.filter((u) => perfilDe(u) === p).length})
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="text-sm text-gray-600 text-center py-6">Nenhum usuário nesta categoria.</p>
        )}
        {filtrados.map((u) => (
          <div key={u.id} className={`border px-4 py-3 flex items-center gap-3 flex-wrap ${u.ativo ? "border-gray-100" : "border-gray-100 bg-gray-50 opacity-60"}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[var(--brand-dark)] text-sm">{u.nome}</span>
                <Badge papel={perfilDe(u)} />
                {!u.ativo && <span className="text-[10px] text-red-500 font-bold uppercase">Inativo</span>}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{u.email}</p>
              {u.papel === "corretor" && u.creci && <p className="text-xs text-gray-600">CRECI: {u.creci}</p>}
              {u.papel === "cliente" && <p className="text-xs text-gray-600">Cliente do CRM: {u.leadNome ? `${u.leadNome}${u.leadTelefone ? ` · ${u.leadTelefone}` : ""}` : "sem vínculo (vincule em Perfil)"}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(u.id, u.ativo)}
                disabled={isPending}
                title={u.ativo ? "Desativar" : "Ativar"}
                className="text-gray-600 hover:text-[var(--brand-dark)] transition-colors"
              >
                {u.ativo ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
              </button>
              <button
                onClick={() => setPerfilId(perfilId === u.id ? null : u.id)}
                title="Alterar perfil"
                className="text-gray-600 hover:text-[var(--brand-dark)] text-[10px] font-bold uppercase"
              >
                Perfil
              </button>
              {u.engenheiro && (
                <button
                  onClick={() => setEngenheiroId(engenheiroId === u.id ? null : u.id)}
                  title="Dados do engenheiro (CREA, endereço) e documentos"
                  className="text-gray-600 hover:text-[var(--brand-dark)] text-[10px] font-bold uppercase"
                >
                  Engenheiro
                </button>
              )}
              <button
                onClick={() => setPermissoesId(permissoesId === u.id ? null : u.id)}
                title="Módulos liberados (só colaborador)"
                disabled={u.papel !== "colaborador"}
                className="text-gray-600 hover:text-purple-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Shield size={15} />
              </button>
              <button
                onClick={() => setResetId(u.id)}
                title="Redefinir senha"
                className="text-gray-600 hover:text-[var(--brand-dark)] transition-colors"
              >
                <KeyRound size={15} />
              </button>
              <button
                onClick={() => handleExcluir(u.id, u.nome)}
                disabled={isPending || u.papel === "admin"}
                title="Excluir"
                className="text-gray-500 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Troca de perfil (item 05/06) */}
            {perfilId === u.id && (
              <form onSubmit={(e) => handleAlterarPerfil(e, u.id)} className="w-full flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-1 items-end">
                <label className="text-xs font-bold text-gray-500 uppercase">Perfil
                  <select name="papel" defaultValue={perfilDe(u)} className="block mt-1 border border-gray-200 px-2 py-1.5 text-xs bg-white font-normal normal-case">
                    {PAPEIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-gray-500 uppercase">Cliente do CRM (se cliente)
                  <select name="leadId" defaultValue={u.leadId ?? ""} className="block mt-1 border border-gray-200 px-2 py-1.5 text-xs bg-white font-normal normal-case max-w-[16rem]">
                    <option value="">—</option>
                    {u.leadId && <option value={u.leadId}>Atual: {u.leadNome ?? "cliente sem nome"}{u.leadTelefone ? ` · ${u.leadTelefone}` : ""}</option>}
                    {leadsSemConta.map((l) => <option key={l.id} value={l.id}>{l.nome}{l.telefone ? ` · ${l.telefone}` : ""}{l.email ? ` · ${l.email}` : ""}</option>)}
                  </select>
                </label>
                <button type="submit" disabled={isPending} className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold px-3 py-1.5">Salvar perfil</button>
                <button type="button" onClick={() => setPerfilId(null)} className="text-xs text-gray-600">Fechar</button>
              </form>
            )}

            {/* Lote 2, correção 04: dados profissionais e documentos do engenheiro */}
            {engenheiroId === u.id && u.engenheiro && <PerfilEngenheiro usuarioId={u.id} />}

            {/* Permissões inline */}
            {permissoesId === u.id && u.papel === "colaborador" && (
              <div className="w-full pt-2 border-t border-gray-100 mt-1">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Permissões de Acesso</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MODULOS.map((m) => {
                    const perms: string[] = (() => { try { return JSON.parse(u.permissoes || "[]"); } catch { return []; } })();
                    const checked = u.papel === "admin" || perms.includes(m.id);
                    const isAdmin = u.papel === "admin";
                    return (
                      <label key={m.id} className={`flex items-center gap-1.5 text-xs cursor-pointer ${isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isAdmin}
                          onChange={() => handleTogglePerm(u.id, m.id, perms)}
                          className="accent-[var(--brand-yellow)]"
                        />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPermissoesId(null)}
                  className="mt-2 text-xs text-gray-600 hover:text-gray-600"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* Reset senha inline */}
            {resetId === u.id && (
              <form onSubmit={handleReset} className="w-full flex gap-2 pt-2 border-t border-gray-100 mt-1">
                <input type="hidden" name="id" value={u.id} />
                <input
                  name="novaSenha"
                  type="password"
                  minLength={6}
                  required
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className="flex-1 border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--brand-yellow)]"
                />
                <button type="submit" disabled={isPending} className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold px-3 py-1.5 hover:bg-black">
                  Salvar
                </button>
                <button type="button" onClick={() => setResetId(null)} className="text-gray-500 hover:text-gray-600">
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Modal novo usuário */}
      {showForm && (
        <Modal rotulo="Novo Usuário" onFechar={() => setShowForm(false)} tamanho="md">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">Novo Usuário</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCriar} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome completo *</label>
                <input name="nome" type="text" required value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do usuário" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail *</label>
                <input name="email" type="email" required placeholder="email@exemplo.com" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Perfil *</label>
                <select name="papel" required value={papelNovo} onChange={(e) => setPapelNovo(e.target.value as Papel)} className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
                  {PAPEIS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Senha inicial</label>
                <input name="senha" type="password" minLength={8} placeholder="Em branco: envia link de primeiro acesso" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone{papelNovo === "corretor" ? " *" : ""}</label>
                <input name="telefone" type="tel" required={papelNovo === "corretor"} value={foneNovo} onChange={(e) => setFoneNovo(e.target.value)} placeholder="(00) 9 0000-0000" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              {papelNovo === "corretor" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CRECI *</label>
                  <input name="creci" type="text" required placeholder="CRECI do corretor" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
                </div>
              )}
              {papelNovo === "engenheiro" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nº do CREA</label>
                    <input name="crea" type="text" maxLength={40} className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">UF do CREA</label>
                    <select name="creaUf" defaultValue="" className="w-full border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand-yellow)]">
                      <option value="">—</option>
                      {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">Engenheiro tem os mesmos acessos do colaborador (módulos abaixo). Endereço, CREAs de outros estados e documentos ficam no botão &quot;Engenheiro&quot; do usuário, depois de criado.</p>
                </div>
              )}
              {papelNovo === "cliente" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente do CRM *</label>
                  <input type="search" value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder="Pesquisar cliente" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
                  <select
                    name="leadId"
                    required
                    aria-label="Cliente do CRM"
                    onChange={(e) => {
                      const lead = leadsSemConta.find((l) => l.id === e.target.value);
                      if (lead) { setNomeNovo(lead.nome); setFoneNovo(lead.telefone ?? ""); }
                    }}
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] mt-1 bg-white"
                  >
                    <option value="">Selecione</option>
                    {leadsSemConta.filter((l) => !buscaLead.trim() || `${l.nome} ${l.email ?? ""}`.toLowerCase().includes(buscaLead.trim().toLowerCase())).slice(0, 200)
                      .map((l) => <option key={l.id} value={l.id}>{l.nome}{l.telefone ? ` · ${l.telefone}` : ""}{l.email ? ` · ${l.email}` : ""}</option>)}
                  </select>
                </div>
              )}
              {(papelNovo === "colaborador" || papelNovo === "engenheiro") && (
                <fieldset>
                  <legend className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Módulos liberados</legend>
                  <div className="grid grid-cols-2 gap-1">
                    {MODULOS.map((m) => (
                      <label key={m.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="permissoes" value={m.id} className="accent-[var(--brand-yellow)]" />{m.label}</label>
                    ))}
                  </div>
                </fieldset>
              )}
              {papelNovo === "empreiteiro" && <p className="text-xs text-gray-500">O empreiteiro vê só as obras em que for escolhido como empreiteiro (na tela da obra).</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isPending} className="flex-1 bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-sm uppercase py-2 hover:bg-black disabled:opacity-50 transition-colors">
                  {isPending ? "Cadastrando..." : "Cadastrar"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-500 font-bold text-sm uppercase py-2 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
