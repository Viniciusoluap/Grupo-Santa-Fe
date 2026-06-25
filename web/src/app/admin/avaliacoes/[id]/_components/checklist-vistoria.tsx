"use client";

import { useState, useTransition, useRef } from "react";
import { salvarChecklistAvaliacao } from "@/lib/actions/avaliacoes";
import { ChevronDown, ChevronRight, X, Plus, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface Props {
  avaliacaoId: string;
  initialData: string;
}

type ItemState = { ok: boolean | null; nota: string };

type ChecklistData = {
  estadoGeral: string;
  items: Record<string, ItemState>;
  fotos: string[];
};

const ESTADO_GERAL_OPTIONS = [
  { value: "novo",                  label: "Novo / Em construção" },
  { value: "otimo",                 label: "Ótimo estado" },
  { value: "conservado",            label: "Conservado" },
  { value: "regular",               label: "Regular" },
  { value: "reformas_leves",        label: "Necessita reformas leves" },
  { value: "reformas_importantes",  label: "Necessita reformas importantes" },
  { value: "ruim",                  label: "Ruim" },
];

type ChecklistGroup = {
  id: string;
  label: string;
  items: { key: string; label: string }[];
};

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: "localizacao",
    label: "Localização e Infraestrutura",
    items: [
      { key: "loc_01", label: "Rede de água encanada" },
      { key: "loc_02", label: "Rede de esgoto (ou fossa regularizada)" },
      { key: "loc_03", label: "Energia elétrica disponível" },
      { key: "loc_04", label: "Via pública pavimentada" },
      { key: "loc_05", label: "Iluminação pública" },
      { key: "loc_06", label: "Transporte público próximo" },
      { key: "loc_07", label: "Comércio e serviços nas proximidades" },
      { key: "loc_08", label: "Escola / creche próxima" },
      { key: "loc_09", label: "Unidade de saúde próxima" },
      { key: "loc_10", label: "Segurança satisfatória na região" },
    ],
  },
  {
    id: "documentacao",
    label: "Documentação e Situação Legal",
    items: [
      { key: "doc_01", label: "Matrícula atualizada no cartório" },
      { key: "doc_02", label: "Escritura / contrato de compra e venda" },
      { key: "doc_03", label: "Habite-se / alvará de construção" },
      { key: "doc_04", label: "Planta da edificação disponível" },
      { key: "doc_05", label: "Sem ônus (hipotecas ou penhoras)" },
      { key: "doc_06", label: "IPTU em dia" },
      { key: "doc_07", label: "Sem débitos de condomínio" },
      { key: "doc_08", label: "Área conforme consta na matrícula" },
      { key: "doc_09", label: "Construção regularizada perante a prefeitura" },
      { key: "doc_10", label: "Conformidade com zoneamento municipal" },
    ],
  },
  {
    id: "estrutura",
    label: "Estrutura e Fundação",
    items: [
      { key: "est_01", label: "Fundação aparentemente íntegra" },
      { key: "est_02", label: "Ausência de recalque ou acomodação" },
      { key: "est_03", label: "Ausência de trincas/fissuras estruturais" },
      { key: "est_04", label: "Paredes estruturais em bom estado" },
      { key: "est_05", label: "Laje/teto sem infiltração ou danos estruturais" },
      { key: "est_06", label: "Pilares e vigas sem fissuras visíveis" },
    ],
  },
  {
    id: "cobertura",
    label: "Cobertura e Telhado",
    items: [
      { key: "cob_01", label: "Telhado em bom estado de conservação" },
      { key: "cob_02", label: "Ausência de vazamentos / goteiras" },
      { key: "cob_03", label: "Calhas e rufos funcionando" },
      { key: "cob_04", label: "Impermeabilização adequada" },
      { key: "cob_05", label: "Forro/laje de teto sem danos" },
    ],
  },
  {
    id: "acabamentos",
    label: "Acabamentos Internos",
    items: [
      { key: "acb_01", label: "Piso em bom estado" },
      { key: "acb_02", label: "Revestimento de paredes em bom estado" },
      { key: "acb_03", label: "Pintura em bom estado" },
      { key: "acb_04", label: "Portas em bom estado (ferragens e fechaduras)" },
      { key: "acb_05", label: "Janelas em bom estado (vidros e trilhos)" },
      { key: "acb_06", label: "Louças sanitárias íntegras" },
      { key: "acb_07", label: "Metais sanitários (torneiras, registros) funcionando" },
      { key: "acb_08", label: "Bancada/pia da cozinha em bom estado" },
      { key: "acb_09", label: "Armários embutidos em bom estado" },
    ],
  },
  {
    id: "eletrica",
    label: "Instalação Elétrica",
    items: [
      { key: "ele_01", label: "Quadro de distribuição (disjuntores) adequado" },
      { key: "ele_02", label: "Fiação aparentemente em bom estado" },
      { key: "ele_03", label: "Tomadas e interruptores funcionando" },
      { key: "ele_04", label: "Aterramento presente" },
      { key: "ele_05", label: "Iluminação funcionando em todos os cômodos" },
      { key: "ele_06", label: "Sem fiação exposta ou improvisada" },
    ],
  },
  {
    id: "hidraulica",
    label: "Instalação Hidráulica e Sanitária",
    items: [
      { key: "hid_01", label: "Encanamento sem vazamentos visíveis" },
      { key: "hid_02", label: "Caixa d'água com volume e estado adequados" },
      { key: "hid_03", label: "Pressão de água satisfatória" },
      { key: "hid_04", label: "Esgoto conectado à rede ou fossa regularizada" },
      { key: "hid_05", label: "Banheiros sem infiltração ou mofo" },
      { key: "hid_06", label: "Vaso sanitário e chuveiro funcionando" },
      { key: "hid_07", label: "Aquecimento de água presente e funcionando" },
    ],
  },
  {
    id: "conservacao",
    label: "Conservação Geral",
    items: [
      { key: "con_01", label: "Ausência de umidade ascendente" },
      { key: "con_02", label: "Ausência de infiltrações nas paredes/pisos" },
      { key: "con_03", label: "Ausência de mofo / bolor" },
      { key: "con_04", label: "Ausência de sinais de cupim ou pragas" },
      { key: "con_05", label: "Ausência de odores anormais" },
      { key: "con_06", label: "Área externa / quintal em bom estado" },
      { key: "con_07", label: "Muros / cercas em bom estado" },
    ],
  },
  {
    id: "benfeitorias",
    label: "Benfeitorias e Dependências",
    items: [
      { key: "ben_01", label: "Garagem / vaga coberta presente" },
      { key: "ben_02", label: "Área de serviço / lavanderia" },
      { key: "ben_03", label: "Varanda / sacada / terraço" },
      { key: "ben_04", label: "Piscina (se houver, em bom estado)" },
      { key: "ben_05", label: "Churrasqueira (se houver, em bom estado)" },
      { key: "ben_06", label: "Portão elétrico (se houver, funcionando)" },
      { key: "ben_07", label: "Sistema de câmeras/alarme (se houver)" },
      { key: "ben_08", label: "Ar-condicionado (se houver, funcionando)" },
    ],
  },
];

const TOTAL_ITEMS = CHECKLIST_GROUPS.reduce((acc, g) => acc + g.items.length, 0);

function parseInitial(raw: string): ChecklistData {
  if (!raw) {
    return { estadoGeral: "", items: {}, fotos: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ChecklistData>;
    return {
      estadoGeral: parsed.estadoGeral ?? "",
      items: parsed.items ?? {},
      fotos: parsed.fotos ?? [],
    };
  } catch {
    return { estadoGeral: "", items: {}, fotos: [] };
  }
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas context failed")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.60));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChecklistVistoria({ avaliacaoId, initialData }: Props) {
  const [data, setData] = useState<ChecklistData>(() => parseInitial(initialData));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ localizacao: true });
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifiedCount = Object.values(data.items).filter((v) => v.ok !== null).length;

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleNote(key: string) {
    setExpandedNotes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setItemOk(key: string, val: boolean | null) {
    setData((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [key]: { ok: val, nota: prev.items[key]?.nota ?? "" },
      },
    }));
  }

  function setItemNota(key: string, nota: string) {
    setData((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [key]: { ok: prev.items[key]?.ok ?? null, nota },
      },
    }));
  }

  function removePhoto(idx: number) {
    setData((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== idx),
    }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 15 - data.fotos.length;
    const toProcess = files.slice(0, remaining);
    const compressed: string[] = [];
    for (const file of toProcess) {
      const c = await compressImage(file);
      compressed.push(c);
    }
    setData((prev) => ({ ...prev, fotos: [...prev.fotos, ...compressed] }));
    // reset input so same files can be re-added if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSave() {
    startTransition(async () => {
      await salvarChecklistAvaliacao(avaliacaoId, JSON.stringify(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const progressPct = TOTAL_ITEMS > 0 ? Math.round((verifiedCount / TOTAL_ITEMS) * 100) : 0;

  return (
    <div className="bg-white border border-gray-100">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
          Checklist de Vistoria — ABNT NBR 14653
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{verifiedCount} de {TOTAL_ITEMS} itens verificados</span>
              <span className="text-xs font-bold text-[var(--brand-dark)]">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: progressPct === 100 ? "#22c55e" : "var(--brand-yellow)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Estado Geral */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Estado Geral do Imóvel</p>
        <div className="flex flex-wrap gap-2">
          {ESTADO_GERAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setData((prev) => ({ ...prev, estadoGeral: opt.value }))}
              className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors ${
                data.estadoGeral === opt.value
                  ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)] border-[var(--brand-dark)]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist Groups */}
      <div className="divide-y divide-gray-100">
        {CHECKLIST_GROUPS.map((group) => {
          const isOpen = !!openGroups[group.id];
          const groupVerified = group.items.filter((it) => (data.items[it.key]?.ok ?? null) !== null).length;
          const groupNonConformes = group.items.filter((it) => data.items[it.key]?.ok === false).length;

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-[var(--brand-dark)] uppercase tracking-widest">
                    {group.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {groupNonConformes > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-red-500 uppercase">
                      {groupNonConformes} NC
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {groupVerified}/{group.items.length}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="pb-2">
                  {group.items.map((item) => {
                    const state = data.items[item.key] ?? { ok: null, nota: "" };
                    const noteOpen = !!expandedNotes[item.key];

                    return (
                      <div key={item.key} className="px-5 py-2">
                        <div className="flex items-center gap-2">
                          {/* Status buttons */}
                          <button
                            type="button"
                            title="Conforme"
                            onClick={() => setItemOk(item.key, state.ok === true ? null : true)}
                            className={`shrink-0 transition-colors ${
                              state.ok === true ? "text-green-500" : "text-gray-200 hover:text-green-400"
                            }`}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            type="button"
                            title="Não conforme"
                            onClick={() => setItemOk(item.key, state.ok === false ? null : false)}
                            className={`shrink-0 transition-colors ${
                              state.ok === false ? "text-red-400" : "text-gray-200 hover:text-red-300"
                            }`}
                          >
                            <XCircle size={18} />
                          </button>
                          {state.ok === null && (
                            <MinusCircle size={18} className="text-gray-200 shrink-0 pointer-events-none" />
                          )}

                          {/* Label */}
                          <span
                            className={`flex-1 text-sm ${
                              state.ok === true
                                ? "text-gray-600"
                                : state.ok === false
                                ? "text-red-500"
                                : "text-gray-400"
                            }`}
                          >
                            {item.label}
                          </span>

                          {/* Add note button */}
                          <button
                            type="button"
                            title={noteOpen ? "Fechar nota" : "Adicionar nota"}
                            onClick={() => toggleNote(item.key)}
                            className="shrink-0 text-gray-300 hover:text-[var(--brand-dark)] transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Note textarea */}
                        {noteOpen && (
                          <div className="mt-1 ml-14">
                            <textarea
                              rows={2}
                              placeholder="Observação sobre este item..."
                              value={state.nota}
                              onChange={(e) => setItemNota(item.key, e.target.value)}
                              className="w-full text-xs border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Photo section */}
      <div className="px-5 py-5 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fotos da Vistoria</p>
        <p className="text-[10px] text-gray-400 mb-3">
          Max. 15 fotos · cada foto reduzida automaticamente para max 800px / JPEG 60%
        </p>

        {data.fotos.length < 15 && (
          <label className="inline-flex items-center gap-2 cursor-pointer bg-gray-50 border border-dashed border-gray-300 hover:border-[var(--brand-yellow)] px-4 py-2 text-xs text-gray-500 hover:text-[var(--brand-dark)] transition-colors mb-4">
            <Plus size={14} />
            Adicionar fotos
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}

        {data.fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {data.fotos.map((src, idx) => (
              <div key={idx} className="relative aspect-[4/3] bg-gray-100 overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 py-0.5 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="px-5 pb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors hover:bg-black disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar checklist"}
        </button>
        {saved && (
          <span className="text-xs font-bold text-green-600 uppercase tracking-wide">
            Salvo!
          </span>
        )}
      </div>
    </div>
  );
}
