"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, User, Clock,
  CheckCircle2, XCircle, Home, MapPin, Wrench, Building2, FileText,
  DollarSign, Calendar, Scale, Search, X as XIcon,
} from "lucide-react";
import { criarVisita, editarVisita, excluirVisita, atualizarStatusVisita } from "@/lib/actions/agenda";
import { SubmitButton } from "@/components/ui/submit-button";
import { rotulo } from "@/lib/rotulos";
import { chaveLocalAgenda, registrosAgenda, type FiltroAgenda } from "@/lib/crm/agenda-registros";
import { editarTarefaCrm } from "@/lib/actions/tarefas-crm";

type Corretor = { id: string; nome: string };
type ImovelItem = { id: string; titulo: string };
type LeadItem = { id: string; nome: string; telefone: string };

type VisitaData = {
  id: string;
  tipoVisita: string;
  clienteNome: string;
  clienteTel: string;
  agendadaPara: Date | string;
  status: string;
  notas: string;
  corretorId: string | null;
  corretor: Corretor | null;
  colaboradorNome: string | null;
  imovelId: string | null;
  imovel: ImovelItem | null;
  leadId: string | null;
  responsavelLeadNome?: string | null;
};

interface Props {
  visitas: VisitaData[];
  corretores: Corretor[];
  imoveis: ImovelItem[];
  leads: LeadItem[];
  vencimentos: { id: string; nome: string; vencimentoCard: Date | string | null; responsavel?: { nome: string } | null }[];
  tarefas: { id: string; titulo: string; status: string; prazo: Date | string | null; leadId: string; lead: { nome: string }; responsavelNome?: string | null }[];
  /** Pedido de 15/10: o corretor não escolhe corretor/colaborador (vem da sessão). */
  ehCorretor?: boolean;
}

const TIPO_VISITA_OPTIONS = [
  { value: "imovel",        label: "Visita a Imóvel",            Icon: Home },
  { value: "lote",          label: "Visita a Lote",              Icon: MapPin },
  { value: "obra",          label: "Visita a Obra",              Icon: Wrench },
  { value: "escritorio",    label: "Reunião no Escritório",       Icon: Building2 },
  { value: "regularizacao", label: "Regularização Imobiliária",  Icon: FileText },
  { value: "avaliacao",     label: "Avaliação de Imóvel",        Icon: Scale },
  { value: "financiamento", label: "Financiamento",              Icon: DollarSign },
  { value: "outro",         label: "Outro",                      Icon: Calendar },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_VISITA_OPTIONS.map((t) => [t.value, t.label])
);

const STATUS_STYLES: Record<string, string> = {
  agendada:  "bg-purple-100 text-purple-700",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-500",
};

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function toDatetimeLocal(d: Date | string | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/* ────────── Excluir btn ────────── */
function ExcluirVisitaBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Excluir esta visita?")) return;
        startTransition(async () => { await excluirVisita(id); });
      }}
      disabled={isPending}
      title="Excluir visita"
      className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors rounded disabled:opacity-40"
    >
      <Trash2 size={14} />
    </button>
  );
}

/* ────────── Calendário ────────── */
function Calendario({
  visitas, vencimentos, tarefas, ano, mes, diaSelecionado,
  onSelect, onPrev, onNext,
}: {
  visitas: VisitaData[]; vencimentos: Props["vencimentos"]; tarefas: Props["tarefas"]; ano: number; mes: number;
  diaSelecionado: number | null;
  onSelect: (d: number) => void; onPrev: () => void; onNext: () => void;
}) {
  const hoje = new Date();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white border border-gray-100">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={onPrev} className="p-1.5 text-gray-600 hover:text-[var(--brand-dark)] hover:bg-gray-100 rounded transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-wide">
          {MESES_PT[mes]} {ano}
        </p>
        <button onClick={onNext} className="p-1.5 text-gray-600 hover:text-[var(--brand-dark)] hover:bg-gray-100 rounded transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2 text-center text-[9px] font-bold text-gray-600 uppercase tracking-widest">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((dia, idx) => {
          if (!dia) return <div key={`e-${idx}`} className="aspect-square" />;
          const isHoje = hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;
          const isSel = diaSelecionado === dia;
          const data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const registros = registrosAgenda(visitas, vencimentos, tarefas, "data_selecionada", data, chaveLocalAgenda(hoje));
          const vsDia = registros.flatMap(registro => registro.tipo === "agendamento" ? [registro.item] : []);
          const cardCount = registros.filter(registro => registro.tipo === "lead").length;
          const taskCount = registros.filter(registro => registro.tipo === "tarefa").length;
          const temAgendada = vsDia.some((v) => v.status === "agendada");
          const temRealizada = vsDia.some((v) => v.status === "realizada");

          return (
            <button
              key={dia}
              onClick={() => onSelect(dia)}
              aria-pressed={isSel}
              aria-label={`${dia}/${mes + 1}/${ano}: ${cardCount} leads, ${taskCount} tarefas e ${vsDia.length} agendamentos`}
              className={`aspect-square flex flex-col items-center justify-start pt-1.5 gap-0.5 transition-colors hover:bg-gray-50 ${isSel ? "bg-[var(--brand-yellow)]/20 ring-1 ring-[var(--brand-yellow)] ring-inset" : ""}`}
            >
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center leading-none ${
                isHoje ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)] rounded-full" :
                isSel ? "text-[var(--brand-dark)]" : "text-gray-600"
              }`}>
                {dia}
              </span>
              {vsDia.length > 0 && (
                <div className="flex gap-0.5">
                  {temAgendada && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  {temRealizada && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                </div>
              )}
              {cardCount > 0 && <span className="text-[9px] font-bold text-red-700">{cardCount} lead{cardCount === 1 ? "" : "s"}</span>}
              {taskCount > 0 && <span className="text-[9px] font-bold text-blue-700">{taskCount} tarefa{taskCount === 1 ? "" : "s"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── Card de visita ────────── */
function VisitaCard({ v, onEdit }: { v: VisitaData; onEdit: () => void }) {
  const dt = new Date(v.agendadaPara);
  const tipoLabel = TIPO_LABELS[v.tipoVisita] ?? v.tipoVisita;
  const statusStyle = STATUS_STYLES[v.status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white border border-gray-100 p-4 flex gap-3">
      <div className="w-12 h-12 bg-[var(--brand-yellow)] flex flex-col items-center justify-center shrink-0">
        <span className="font-black text-lg text-[var(--brand-dark)] leading-none">{dt.getDate()}</span>
        <span className="text-[9px] font-bold uppercase text-[var(--brand-dark)]">
          {dt.toLocaleString("pt-BR", { month: "short" })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-[var(--brand-dark)] text-sm">{v.clienteNome}</p>
            <p className="text-gray-600 text-xs mt-0.5">{tipoLabel}</p>
            {v.imovel && <p className="text-gray-600 text-xs">{v.imovel.titulo}</p>}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${statusStyle}`}>{rotulo(v.status)}</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Clock size={10} />{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          {v.corretor && <span className="flex items-center gap-1"><User size={10} />Corretor: {v.corretor.nome}</span>}
          {v.colaboradorNome && <span className="flex items-center gap-1"><User size={10} />Colaborador: {v.colaboradorNome}</span>}
          <span className="flex items-center gap-1"><User size={10} />Responsável: {v.leadId ? v.responsavelLeadNome ?? "Não atribuído" : v.colaboradorNome ?? v.corretor?.nome ?? "Não atribuído"}</span>
        </div>

        {v.notas && <p className="text-xs text-gray-600 mt-1 italic">{v.notas}</p>}

        <div className="flex gap-2 mt-2.5 flex-wrap items-center">
          {v.leadId && (
            <Link href={`/admin/leads/${v.leadId}`} className="text-xs bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-3 py-1.5">
              Ver Lead
            </Link>
          )}
          {v.status === "agendada" && (
            <>
              <form action={atualizarStatusVisita.bind(null, v.id, "realizada")}>
                <button type="submit" className="text-xs bg-green-50 hover:bg-green-100 text-green-600 font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <CheckCircle2 size={10} /> Realizada
                </button>
              </form>
              <form action={atualizarStatusVisita.bind(null, v.id, "cancelada")}>
                <button type="submit" className="text-xs bg-red-50 hover:bg-red-100 text-red-500 font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <XCircle size={10} /> Cancelar
                </button>
              </form>
            </>
          )}
          <button onClick={onEdit} className="text-xs border border-gray-200 hover:border-gray-300 text-gray-500 font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 transition-colors">
            <Pencil size={10} /> Editar
          </button>
          <ExcluirVisitaBtn id={v.id} />
        </div>
      </div>
    </div>
  );
}

/* ────────── Busca de lead (obrigatória — não permite nome avulso) ────────── */
// Componente controlado: o valor selecionado é mantido pelo VisitaModal (que
// também valida no submit), não por um input hidden com `required` — atributo
// que o navegador ignora em campos ocultos.
function LeadSearch({
  leads, selecionado, onChange,
}: {
  leads: LeadItem[];
  selecionado: LeadItem | null;
  onChange: (lead: LeadItem | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads
      .filter((l) => l.nome.toLowerCase().includes(q) || l.telefone.includes(q))
      .slice(0, 8);
  }, [leads, busca]);

  if (selecionado) {
    return (
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente (lead) *</label>
        <div className="flex items-center justify-between gap-2 border border-gray-200 px-3 py-2.5 bg-gray-50">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{selecionado.nome}</p>
            <p className="text-xs text-gray-600">{selecionado.telefone}</p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setBusca(""); }}
            className="shrink-0 text-gray-600 hover:text-red-500 transition-colors"
            title="Trocar cliente"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente (lead) *</label>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar lead cadastrado por nome ou telefone..."
          className="w-full border border-gray-200 pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-1">
        Só é possível agendar visita para um lead já cadastrado. Não encontrou? Cadastre o lead primeiro.
      </p>
      {aberto && busca.trim().length >= 2 && (
        <div className="absolute z-40 left-0 right-0 bg-white border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {filtrados.length > 0 ? (
            filtrados.map((l) => (
              <button
                key={l.id}
                type="button"
                onMouseDown={() => { onChange(l); setBusca(""); setAberto(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <span className="font-medium text-gray-800">{l.nome}</span>
                <span className="text-gray-600 ml-2 text-xs">{l.telefone}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-gray-600">Nenhum lead encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────── Modal de formulário ────────── */
function VisitaModal({
  onClose, visita, corretores, imoveis, leads, ehCorretor = false,
}: {
  onClose: () => void;
  ehCorretor?: boolean;
  visita?: VisitaData;
  corretores: Corretor[];
  imoveis: ImovelItem[];
  leads: LeadItem[];
}) {
  const isEdit = !!visita;
  const [tipoAcomp, setTipoAcomp] = useState<"nenhum" | "corretor" | "colaborador">(
    visita?.corretorId ? "corretor" : visita?.colaboradorNome ? "colaborador" : "nenhum"
  );
  const [lead, setLead] = useState<LeadItem | null>(() => {
    if (!visita?.leadId) return null;
    return leads.find((l) => l.id === visita.leadId) ?? { id: visita.leadId, nome: visita.clienteNome, telefone: visita.clienteTel };
  });
  const [erroLead, setErroLead] = useState(false);

  const [semLead, setSemLead] = useState(() => !!visita && !visita.leadId);
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nomeLivre = String(new FormData(e.currentTarget).get("clienteNome") ?? "").trim();
    if (semLead ? !nomeLivre : !lead) {
      e.preventDefault();
      setErroLead(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">
            {isEdit ? "Editar Visita" : "Nova Visita"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <form action={isEdit ? editarVisita : criarVisita} onSubmit={handleSubmit} className="p-6 space-y-4">
          {isEdit && <input type="hidden" name="id" value={visita.id} />}
          <input type="hidden" name="leadId" value={semLead ? "" : lead?.id ?? ""} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Visita *</label>
              <select name="tipoVisita" required defaultValue={visita?.tipoVisita ?? "imovel"}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {TIPO_VISITA_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Cliente: lead cadastrado ou, sem lead, nome e telefone (pedido de 15/10, igual à Prospecta) */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                <input type="checkbox" checked={semLead} onChange={(e) => { setSemLead(e.target.checked); setErroLead(false); }} />
                Cliente sem lead
              </label>
              {semLead ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do cliente sem lead *</label>
                    <input type="text" name="clienteNome" defaultValue={visita && !visita.leadId ? visita.clienteNome : ""} maxLength={255}
                      className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                    <input type="tel" name="clienteTel" defaultValue={visita && !visita.leadId ? visita.clienteTel : ""} maxLength={40}
                      className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                </div>
              ) : (
                <LeadSearch
                  leads={leads}
                  selecionado={lead}
                  onChange={(l) => { setLead(l); if (l) setErroLead(false); }}
                />
              )}
              {erroLead && (
                <p className="text-xs text-red-500 mt-1">{semLead ? "Informe o nome do cliente sem lead." : "Selecione um lead cadastrado antes de agendar."}</p>
              )}
            </div>

            {/* Data/hora */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data e Hora *</label>
              <input type="datetime-local" name="agendadaPara" required
                defaultValue={toDatetimeLocal(visita?.agendadaPara)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            {/* Imóvel */}
            {imoveis.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Imóvel (opcional)</label>
                <select name="imovelId" defaultValue={visita?.imovelId ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Nenhum</option>
                  {imoveis.map((i) => (
                    <option key={i.id} value={i.id}>{i.titulo}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Acompanhante — o corretor não escolhe: o vínculo vem da sessão. */}
            {!ehCorretor && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Acompanhante</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(["nenhum", "corretor", "colaborador"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setTipoAcomp(v)}
                    className={`py-2 text-xs font-bold border transition-colors capitalize ${
                      tipoAcomp === v
                        ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/10 text-[var(--brand-dark)]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}>
                    {v === "nenhum" ? "Nenhum" : v === "corretor" ? "Corretor" : "Colaborador"}
                  </button>
                ))}
              </div>
              {tipoAcomp === "corretor" && (
                <select name="corretorId" defaultValue={visita?.corretorId ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione um corretor</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              )}
              {tipoAcomp === "colaborador" && (
                <input type="text" name="colaboradorNome" placeholder="Nome do colaborador"
                  defaultValue={visita?.colaboradorNome ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              )}
            </div>
            )}

            {/* Notas */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notas (opcional)</label>
              <textarea name="notas" rows={2} defaultValue={visita?.notas ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Salvando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEdit ? "Salvar Alterações" : "Agendar Visita"}
            </SubmitButton>
            <button type="button" onClick={onClose}
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────── Componente principal ────────── */
export function AgendaClient({ visitas, corretores, imoveis, leads, vencimentos, tarefas, ehCorretor = false }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(hoje.getDate());
  const [filtro, setFiltro] = useState<FiltroAgenda>("data_selecionada");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<VisitaData | null>(null);

  function prevMes() {
    if (mes === 0) { setMes(11); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
    setDiaSel(1);
    setFiltro("data_selecionada");
  }
  function nextMes() {
    if (mes === 11) { setMes(0); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
    setDiaSel(1);
    setFiltro("data_selecionada");
  }

  const dia = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}`;
  const registros = registrosAgenda(visitas, vencimentos, tarefas, filtro, dia, chaveLocalAgenda(hoje));
  const tituloLista = filtro === "data_selecionada" ? `Registros de ${dia.split("-").reverse().join("/")}` : {
    leads_vencidos: "Leads vencidos", leads_do_dia: "Leads do dia", leads_a_vencer: "Leads a vencer", todas_tarefas: "Todas as tarefas",
  }[filtro];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Agenda operacional</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Cards de leads, tarefas e agendamentos em uma única lista.
          </p>
        </div>
        <button
          onClick={() => { setEditando(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors mt-6"
        >
          <Plus size={14} /> Nova Visita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendário e lista do filtro selecionado */}
        <div className="lg:col-span-2 space-y-4">
          <label className="block text-sm font-bold text-[var(--brand-dark)]">
            Exibir
            <select value={filtro} onChange={event => setFiltro(event.target.value as FiltroAgenda)}
              className="mt-1 w-full rounded border border-gray-200 bg-white p-2.5 text-gray-900">
              <option value="data_selecionada">Data selecionada</option>
              {!ehCorretor && <>
                <option value="leads_vencidos">Leads vencidos</option>
                <option value="leads_do_dia">Leads do dia</option>
                <option value="leads_a_vencer">Leads a vencer</option>
                <option value="todas_tarefas">Todas as tarefas</option>
              </>}
            </select>
          </label>
          <Calendario
            visitas={visitas}
            vencimentos={vencimentos}
            tarefas={tarefas}
            ano={ano}
            mes={mes}
            diaSelecionado={filtro === "data_selecionada" ? diaSel : null}
            onSelect={value => { setDiaSel(value); setFiltro("data_selecionada"); }}
            onPrev={prevMes}
            onNext={nextMes}
          />
          <section className="bg-white border border-gray-100" aria-label="Registros da agenda">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm">{tituloLista}</h2>
              <span className="text-xs text-gray-600">{registros.length} registro(s)</span>
            </div>
            <div className="p-3 space-y-2">
              {registros.map(registro => registro.tipo === "agendamento" ? (
                <VisitaCard key={`agendamento-${registro.item.id}`} v={registro.item}
                  onEdit={() => { setEditando(registro.item); setShowForm(true); }} />
              ) : registro.tipo === "lead" ? (
                <div key={`lead-${registro.item.id}`} className="border border-gray-100 p-4 text-sm">
                  <p className="text-xs font-bold text-red-700 mb-1">Lead · {registro.dia.split("-").reverse().join("/")}</p>
                  <Link href={`/admin/leads/${registro.item.id}`} className="underline font-semibold text-[var(--brand-dark)]">{registro.item.nome}</Link>
                  <p className="text-xs text-gray-600">Responsável: {registro.item.responsavel?.nome ?? "Não atribuído"}</p>
                </div>
              ) : (
                <div key={`tarefa-${registro.item.id}`} className="border border-gray-100 p-4 text-sm space-y-2">
                  <p className="text-xs font-bold text-blue-700">Tarefa · {registro.dia ? registro.dia.split("-").reverse().join("/") : "Sem prazo"}</p>
                  <Link href={`/admin/leads/${registro.item.leadId}`} className="block underline font-semibold text-[var(--brand-dark)]">{registro.item.titulo} · {registro.item.lead.nome}</Link>
                  <p className="text-xs text-gray-600">Responsável: {registro.item.responsavelNome ?? "Não atribuído"}</p>
                  <div className="flex flex-wrap gap-2">
                    <select aria-label={`Status de ${registro.item.titulo}`} value={registro.item.status}
                      onChange={event => { editarTarefaCrm(registro.item.id, { status: event.target.value }).catch(error => alert(error.message)); }}
                      className="border p-1 bg-white text-gray-900">
                      <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option>
                    </select>
                    <input type="datetime-local" aria-label={`Prazo de ${registro.item.titulo}`}
                      defaultValue={registro.item.prazo ? toDatetimeLocal(registro.item.prazo) : ""}
                      onChange={event => { editarTarefaCrm(registro.item.id, { prazo: event.target.value ? new Date(event.target.value).toISOString() : null }).catch(error => alert(error.message)); }}
                      className="border p-1 bg-white text-gray-900" />
                  </div>
                </div>
              ))}
              {!registros.length && <p className="px-5 py-8 text-center text-gray-600 text-sm">Nenhum registro encontrado para este filtro.</p>}
            </div>
          </section>
        </div>

        {/* Col direita: resumo + por tipo */}
        <div className="space-y-4">
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-4">Resumo</p>
            {[
              { label: "Agendadas",  value: visitas.filter((v) => v.status === "agendada").length,  color: "text-purple-400" },
              { label: "Realizadas", value: visitas.filter((v) => v.status === "realizada").length, color: "text-green-400" },
              { label: "Canceladas", value: visitas.filter((v) => v.status === "cancelada").length, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">{label}</span>
                <span className={`font-black text-xl ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Por Tipo</p>
            <div className="space-y-1">
              {TIPO_VISITA_OPTIONS.map((tipo) => {
                const count = visitas.filter((v) => v.tipoVisita === tipo.value).length;
                if (count === 0) return null;
                return (
                  <div key={tipo.value} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{tipo.label}</span>
                    <span className="font-bold text-[var(--brand-dark)] text-sm">{count}</span>
                  </div>
                );
              })}
              {visitas.length === 0 && <p className="text-xs text-gray-600">Nenhuma visita.</p>}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <VisitaModal
          ehCorretor={ehCorretor}
          onClose={() => { setShowForm(false); setEditando(null); }}
          visita={editando ?? undefined}
          corretores={corretores}
          imoveis={imoveis}
          leads={leads}
        />
      )}
    </div>
  );
}
