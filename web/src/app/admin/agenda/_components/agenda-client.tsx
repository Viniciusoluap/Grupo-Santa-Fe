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
};

interface Props {
  visitas: VisitaData[];
  corretores: Corretor[];
  imoveis: ImovelItem[];
  leads: LeadItem[];
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

function visitasNoDia(visitas: VisitaData[], ano: number, mes: number, dia: number) {
  return visitas.filter((v) => {
    const d = new Date(v.agendadaPara);
    return d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === dia;
  });
}

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
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded disabled:opacity-40"
    >
      <Trash2 size={14} />
    </button>
  );
}

/* ────────── Calendário ────────── */
function Calendario({
  visitas, ano, mes, diaSelecionado,
  onSelect, onPrev, onNext,
}: {
  visitas: VisitaData[]; ano: number; mes: number;
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
        <button onClick={onPrev} className="p-1.5 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-100 rounded transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-wide">
          {MESES_PT[mes]} {ano}
        </p>
        <button onClick={onNext} className="p-1.5 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-100 rounded transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((dia, idx) => {
          if (!dia) return <div key={`e-${idx}`} className="aspect-square" />;
          const isHoje = hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;
          const isSel = diaSelecionado === dia;
          const vsDia = visitasNoDia(visitas, ano, mes, dia);
          const temAgendada = vsDia.some((v) => v.status === "agendada");
          const temRealizada = vsDia.some((v) => v.status === "realizada");

          return (
            <button
              key={dia}
              onClick={() => onSelect(dia)}
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
            <p className="text-gray-400 text-xs mt-0.5">{tipoLabel}</p>
            {v.imovel && <p className="text-gray-400 text-xs">{v.imovel.titulo}</p>}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${statusStyle}`}>{v.status}</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Clock size={10} />{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          {v.corretor && <span className="flex items-center gap-1"><User size={10} />Corretor: {v.corretor.nome}</span>}
          {v.colaboradorNome && <span className="flex items-center gap-1"><User size={10} />Colaborador: {v.colaboradorNome}</span>}
        </div>

        {v.notas && <p className="text-xs text-gray-400 mt-1 italic">{v.notas}</p>}

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
            <p className="text-xs text-gray-400">{selecionado.telefone}</p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setBusca(""); }}
            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
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
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
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
      <p className="text-[10px] text-gray-400 mt-1">
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
                <span className="text-gray-400 ml-2 text-xs">{l.telefone}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-gray-400">Nenhum lead encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────── Modal de formulário ────────── */
function VisitaModal({
  onClose, visita, corretores, imoveis, leads,
}: {
  onClose: () => void;
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!lead) {
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <form action={isEdit ? editarVisita : criarVisita} onSubmit={handleSubmit} className="p-6 space-y-4">
          {isEdit && <input type="hidden" name="id" value={visita.id} />}
          <input type="hidden" name="leadId" value={lead?.id ?? ""} />

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

            {/* Cliente — obrigatoriamente um lead cadastrado */}
            <div className="sm:col-span-2">
              <LeadSearch
                leads={leads}
                selecionado={lead}
                onChange={(l) => { setLead(l); if (l) setErroLead(false); }}
              />
              {erroLead && (
                <p className="text-xs text-red-500 mt-1">Selecione um lead cadastrado antes de agendar.</p>
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

            {/* Acompanhante */}
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
export function AgendaClient({ visitas, corretores, imoveis, leads }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState<number | null>(hoje.getDate());
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<VisitaData | null>(null);

  function prevMes() {
    if (mes === 0) { setMes(11); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
    setDiaSel(null);
  }
  function nextMes() {
    if (mes === 11) { setMes(0); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
    setDiaSel(null);
  }

  const agora = new Date();
  const proximas = visitas
    .filter((v) => v.status === "agendada" && new Date(v.agendadaPara) >= agora)
    .sort((a, b) => new Date(a.agendadaPara).getTime() - new Date(b.agendadaPara).getTime());

  const visitasDia = diaSel ? visitasNoDia(visitas, ano, mes, diaSel) : [];
  const allSorted = [...visitas].sort(
    (a, b) => new Date(b.agendadaPara).getTime() - new Date(a.agendadaPara).getTime()
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Agenda de Visitas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {proximas.length} visita{proximas.length !== 1 ? "s" : ""} agendada{proximas.length !== 1 ? "s" : ""}
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
        {/* Col esquerda: calendário + visitas do dia + próximas + histórico */}
        <div className="lg:col-span-2 space-y-4">
          <Calendario
            visitas={visitas}
            ano={ano}
            mes={mes}
            diaSelecionado={diaSel}
            onSelect={setDiaSel}
            onPrev={prevMes}
            onNext={nextMes}
          />

          {/* Visitas do dia selecionado */}
          {diaSel !== null && (
            <div className="bg-white border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">
                  {String(diaSel).padStart(2,"0")}/{String(mes+1).padStart(2,"0")}/{ano}
                </p>
                <span className="text-xs text-gray-400">{visitasDia.length} visita(s)</span>
              </div>
              {visitasDia.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  Nenhuma visita neste dia.{" "}
                  <button
                    onClick={() => { setEditando(null); setShowForm(true); }}
                    className="text-[var(--brand-yellow)] font-bold hover:underline"
                  >
                    + Agendar
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 p-3 space-y-2">
                  {visitasDia.map((v) => (
                    <VisitaCard key={v.id} v={v} onEdit={() => { setEditando(v); setShowForm(true); }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Próximas visitas */}
          {proximas.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Próximas Visitas</p>
              {proximas.slice(0, 5).map((v) => (
                <VisitaCard key={v.id} v={v} onEdit={() => { setEditando(v); setShowForm(true); }} />
              ))}
            </div>
          )}

          {/* Histórico */}
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Histórico Completo</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {allSorted.map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--brand-dark)] text-sm">{v.clienteNome}</p>
                    <p className="text-gray-400 text-xs">
                      {TIPO_LABELS[v.tipoVisita] ?? v.tipoVisita} · {new Date(v.agendadaPara).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${STATUS_STYLES[v.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {v.status}
                    </span>
                    <button
                      onClick={() => { setEditando(v); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors rounded"
                    >
                      <Pencil size={13} />
                    </button>
                    <ExcluirVisitaBtn id={v.id} />
                  </div>
                </div>
              ))}
              {allSorted.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma visita registrada.</div>
              )}
            </div>
          </div>
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
              {visitas.length === 0 && <p className="text-xs text-gray-400">Nenhuma visita.</p>}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <VisitaModal
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
