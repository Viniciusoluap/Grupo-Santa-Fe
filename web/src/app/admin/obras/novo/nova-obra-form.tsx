"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { OBRA_TIPO_CONFIG } from "@/lib/types/obra";
import { criarObra } from "@/lib/actions/obras";
import { SubmitButton } from "@/components/ui/submit-button";
import { LeadSelector, type LeadOpcao } from "@/components/crm/lead-selector";
import { maskCurrency, currencyToFloat } from "@/lib/utils";

interface Props {
  leads: LeadOpcao[];
  leadIdInicial?: string;
}

function parseMapsInput(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  const bare = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (bare) {
    const lat = parseFloat(bare[1]), lng = parseFloat(bare[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  return null;
}

export function NovaObraForm({ leads, leadIdInicial = "" }: Props) {
  const [leadId, setLeadId] = useState(leads.some((l) => l.id === leadIdInicial) ? leadIdInicial : "");
  const [leadErro, setLeadErro] = useState(false);

  const [mapsInput, setMapsInput] = useState("");
  const [mapsResult, setMapsResult] = useState<{ lat: number; lng: number } | null>(null);
  const [mapsError, setMapsError] = useState(false);

  const [valorDisplay, setValorDisplay] = useState("");
  const valorRaw = currencyToFloat(valorDisplay);

  async function handleSubmit(formData: FormData) {
    if (!leadId) { setLeadErro(true); return; }
    await criarObra(formData);
  }

  function handleMapsApply() {
    const result = parseMapsInput(mapsInput);
    if (result) {
      setMapsResult(result);
      setMapsError(false);
    } else {
      setMapsError(true);
      setMapsResult(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/obras" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Obras
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Nova Obra / Reforma</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={handleSubmit} className="space-y-5">
          <input type="hidden" name="latitude" value={mapsResult?.lat ?? ""} />
          <input type="hidden" name="longitude" value={mapsResult?.lng ?? ""} />
          <LeadSelector
            leads={leads}
            leadId={leadId}
            onChange={(id) => { setLeadId(id); setLeadErro(false); }}
            erro={leadErro}
          />

          {/* Dados da obra */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Dados da Obra</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome / Descrição *</label>
                <input name="nome" type="text" required placeholder="Ex: Reforma Residencial Rua das Flores"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Obra *</label>
                <select name="tipo" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione...</option>
                  {Object.entries(OBRA_TIPO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área (m²)</label>
                <input name="area" type="number" step="0.01" placeholder="0"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Engenheiro Responsável</label>
                <input name="engenheiroResp" type="text" placeholder="Nome do engenheiro"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Contrato</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="text" inputMode="numeric" value={valorDisplay} placeholder="0,00"
                    onChange={(e) => setValorDisplay(maskCurrency(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  <input type="hidden" name="valorTotal" value={valorRaw} />
                </div>
              </div>
            </div>
          </div>

          {/* Endereço / Localização */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Endereço da Obra</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
                <input name="endereco" type="text" required placeholder="Rua, número, bairro, cidade"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Localização GPS <span className="text-gray-400 normal-case font-normal">(cole link do Google Maps ou coordenadas)</span>
                </label>
                <div className="flex gap-2">
                  <input type="text" value={mapsInput} onChange={(e) => { setMapsInput(e.target.value); setMapsError(false); }}
                    placeholder="-6.4854, -49.8935  ou  https://maps.google.com/..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleMapsApply())}
                    className="flex-1 border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  <button type="button" onClick={handleMapsApply}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity">
                    <MapPin size={12} /> Marcar
                  </button>
                </div>
                {mapsResult && (
                  <p className="text-xs text-green-600 mt-1">✓ Lat: {mapsResult.lat.toFixed(6)}, Lng: {mapsResult.lng.toFixed(6)}</p>
                )}
                {mapsError && (
                  <p className="text-xs text-red-500 mt-1">Formato inválido. Use coordenadas (-6.48, -49.89) ou link do Google Maps.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
            <textarea name="descricao" rows={3} placeholder="Detalhes da obra, escopo de serviços..."
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Cadastrando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cadastrar Obra
            </SubmitButton>
            <Link href="/admin/obras" className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
