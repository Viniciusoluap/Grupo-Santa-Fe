"use client";

import { useState, useTransition } from "react";
import { Users, Plus, KeyRound, Trash2, ToggleLeft, ToggleRight, X, Shield } from "lucide-react";
import { criarUsuario, alternarAtivo, redefinirSenha, excluirUsuario, salvarPermissoes } from "@/lib/actions/usuarios";

type Papel = "admin" | "colaborador";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  creci: string | null;
  telefone: string | null;
  permissoes: string | null;  // JSON string
}

const PAPEIS: { value: Papel; label: string; cor: string }[] = [
  { value: "admin",       label: "Admin",       cor: "bg-red-100 text-red-700" },
  { value: "colaborador", label: "Colaborador", cor: "bg-purple-100 text-purple-700" },
];

const MODULOS = [
  { id: "imoveis",        label: "Imóveis" },
  { id: "leads",          label: "Leads / CRM" },
  { id: "agenda",         label: "Agenda de Visitas" },
  { id: "obras",          label: "Obras" },
  { id: "projetos",       label: "Projetos" },
  { id: "regularizacao",  label: "Regularização" },
  { id: "financiamentos", label: "Financiamentos" },
  { id: "contratos",      label: "Contratos" },
  { id: "comissoes",      label: "Comissões" },
  { id: "corretores",     label: "Corretores" },
  { id: "avaliacao",      label: "Avaliações" },
  { id: "bpo",            label: "BPO Financeiro" },
  { id: "contabilidade",  label: "Contabilidade" },
  { id: "banco",          label: "Integração Bancária" },
  { id: "whatsapp",       label: "WhatsApp" },
  { id: "agregador",      label: "Agregador XML" },
  { id: "configuracoes",  label: "Configurações" },
];

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
}

export function UsuariosClient({ usuarios }: Props) {
  const [aba, setAba] = useState<Papel | "todos">("todos");
  const [showForm, setShowForm] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [permissoesId, setPermissoesId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtrados = aba === "todos" ? usuarios : usuarios.filter((u) => u.papel === aba);

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
      feedback("Usuário cadastrado com sucesso!");
    });
  }

  async function handleToggle(id: string, ativo: boolean) {
    startTransition(async () => {
      await alternarAtivo(id, !ativo);
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
      await excluirUsuario(id);
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
            Colaboradores do Sistema
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold uppercase px-3 py-2 hover:bg-black transition-colors"
        >
          <Plus size={13} /> Novo usuário
        </button>
      </div>

      {msg && (
        <div className="bg-[var(--brand-yellow)]/20 border border-[var(--brand-yellow)] px-3 py-2 text-xs font-bold text-[var(--brand-dark)]">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-100 pb-0">
        {(["todos", "admin", "colaborador"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setAba(p)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
              aba === p
                ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {p === "todos" ? "Todos" : PAPEIS.find((x) => x.value === p)?.label}
            <span className="ml-1 text-[10px]">
              ({p === "todos" ? usuarios.length : usuarios.filter((u) => u.papel === p).length})
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum usuário nesta categoria.</p>
        )}
        {filtrados.map((u) => (
          <div key={u.id} className={`border px-4 py-3 flex items-center gap-3 flex-wrap ${u.ativo ? "border-gray-100" : "border-gray-100 bg-gray-50 opacity-60"}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[var(--brand-dark)] text-sm">{u.nome}</span>
                <Badge papel={u.papel} />
                {!u.ativo && <span className="text-[10px] text-red-500 font-bold uppercase">Inativo</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
              {u.creci && <p className="text-xs text-gray-400">CRECI: {u.creci}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(u.id, u.ativo)}
                disabled={isPending}
                title={u.ativo ? "Desativar" : "Ativar"}
                className="text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
              >
                {u.ativo ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
              </button>
              <button
                onClick={() => setPermissoesId(permissoesId === u.id ? null : u.id)}
                title="Gerenciar permissões"
                disabled={u.papel === "admin"}
                className="text-gray-400 hover:text-purple-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Shield size={15} />
              </button>
              <button
                onClick={() => setResetId(u.id)}
                title="Redefinir senha"
                className="text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
              >
                <KeyRound size={15} />
              </button>
              <button
                onClick={() => handleExcluir(u.id, u.nome)}
                disabled={isPending || u.papel === "admin"}
                title="Excluir"
                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Permissões inline */}
            {permissoesId === u.id && (
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
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600"
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
                <button type="button" onClick={() => setResetId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Modal novo usuário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">Novo Usuário</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCriar} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome completo *</label>
                <input name="nome" type="text" required placeholder="Nome do usuário" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail *</label>
                <input name="email" type="email" required placeholder="email@exemplo.com" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Senha inicial *</label>
                <input name="senha" type="password" required minLength={6} placeholder="Mín. 6 caracteres" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Papel *</label>
                <select name="papel" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
                  {PAPEIS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                <input name="telefone" type="tel" placeholder="(00) 9 0000-0000" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>

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
        </div>
      )}
    </div>
  );
}
