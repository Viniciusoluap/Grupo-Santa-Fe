"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, FolderOpen, Grid3x3, Loader2, Save, Send, Star, Trash2, Trophy, CopyPlus, PenTool, Satellite } from "lucide-react";
import { formatCurrency, parseNumeroBR, formatArea } from "@/lib/utils";
import {
  assinaturaEntradas, criarProjecao, validarParametrosMassa, ROTULO_ESTUDO_PRELIMINAR, TIPOLOGIAS_MASSA,
  type CenarioMassa, type EstudoMassaGerado, type ParametrosMassa, type TipologiaMassa,
} from "@/lib/geo/massa-parcelamento";
import { executarMotorMassa } from "./executar-massa";
import { LADOS_GLEBA, ROTULO_LADO, medirLados, type LadoGleba } from "@/lib/geo/lados-gleba";
import { PlantaTecnica } from "./planta-tecnica";
import { linhasQuadroAreas, type QuadroAreasMassa } from "@/lib/incorporacao/massa-quadro-areas";
import { AVISO_SEM_POLIGONAL, parseLotesAvulsos, resumoLotesAvulsos } from "@/lib/incorporacao/lotes-avulsos";
import type { EstudoMassaSalvo } from "@/lib/incorporacao/estudos-massa";
import {
  abrirEstudoMassa, excluirEstudoMassa, listarEstudosMassa, marcarEstudoMassaPrincipal, salvarEstudoMassa,
  type ModoSalvarEstudoMassa,
} from "@/lib/actions/estudos-massa";
import { exigirResultado } from "@/lib/acao-resultado";
import { CORES_MASSA } from "./mapa-massa";
import type { EstudoData } from "./incorporacao-detail";
import type { Feature, Polygon } from "geojson";

const MapaMassa = dynamic(() => import("./mapa-massa").then((m) => m.MapaMassa), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: 460 }} />,
});

type CampoNumerico = Exclude<keyof ParametrosMassa, "tipologia" | "modoSistemaViario" | "formatoLote" | "tracadoVia" | "inverterLadoVia" | "ladosVia">;

const CAMPOS: { k: CampoNumerico; label: string }[] = [
  { k: "testadaLoteM", label: "Testada do lote (m)" },
  { k: "profundidadeLoteM", label: "Profundidade (m)" },
  { k: "loteMinimoM2", label: "Lote mínimo (m²)" },
  { k: "larguraViaM", label: "Largura da via (m)" },
  { k: "comprimentoMaxQuadraM", label: "Quadra máx. (m)" },
  { k: "precoM2Lote", label: "Preço lote (R$/m²)" },
  { k: "percentInstitucional", label: "% institucional (0-1)" },
  { k: "percentAreaVerde", label: "% área verde (0-1)" },
];

const CAMPOS_RESTRICOES: { k: CampoNumerico; label: string }[] = [
  { k: "appM2", label: "APP (m²)" },
  { k: "supressaoVegetalM2", label: "Supressão vegetal (m²)" },
  { k: "faixaTransmissaoM2", label: "Faixa de transmissão (m²)" },
  { k: "faixaServidaoM2", label: "Faixa de servidão (m²)" },
  { k: "outrasNaoParcelaveisM2", label: "Outras não parceláveis (m²)" },
];

const TODOS_CAMPOS = [...CAMPOS, ...CAMPOS_RESTRICOES, { k: "areaSistemaViarioM2" as CampoNumerico, label: "Área do sistema viário (m²)" }];

const ROTULO_TIPOLOGIA: Record<TipologiaMassa, string> = { grid: "grade", cul_de_sac: "cul-de-sac", rua_simples: "rua simples", vias_publicas: "vias públicas" };

/** Formata um número para exibição no padrão brasileiro (campo de texto). */
function formatarCampo(v: number | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "";
}

function formatarCampos(p: ParametrosMassa): Record<CampoNumerico, string> {
  return TODOS_CAMPOS.reduce((acc, { k }) => {
    acc[k] = formatarCampo(p[k]);
    return acc;
  }, {} as Record<CampoNumerico, string>);
}

const m2 = (v: number) => formatArea(v);
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function parseJson<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

function paramsIniciais(estudo: EstudoData): ParametrosMassa {
  // Defaults herdados do urbanístico e do mercado, quando existirem.
  const urb = parseJson<Record<string, number>>(estudo.parametrosJson);
  const mercado = parseJson<Record<string, number>>(estudo.estudoMercadoJson);
  const salvo = parseJson<{ params?: ParametrosMassa }>(estudo.massaCenariosJson);
  const base: ParametrosMassa = salvo?.params ?? {
    larguraViaM: 12,
    testadaLoteM: urb?.testadaMinimaM ?? 10,
    profundidadeLoteM: 25,
    loteMinimoM2: urb?.loteMinimoM2 ?? 250,
    comprimentoMaxQuadraM: 120,
    percentInstitucional: urb?.percentInstitucional ?? 0.05,
    percentAreaVerde: urb?.percentAreaVerde ?? 0.1,
    precoM2Lote: mercado?.precoM2Lote || 500,
  };
  return {
    tipologia: "grid",
    modoSistemaViario: "automatico",
    // APP calculada no mapa do Terreno (KML) entra como padrão; pode ser ajustada.
    appM2: estudo.appAreaM2 ?? 0,
    supressaoVegetalM2: 0,
    faixaTransmissaoM2: 0,
    faixaServidaoM2: 0,
    outrasNaoParcelaveisM2: 0,
    ...base,
  };
}

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

export function MassaTab({ estudo }: { estudo: EstudoData }) {
  const [params, setParams] = useState<ParametrosMassa>(() => paramsIniciais(estudo));
  // Buffer de texto por campo — permite digitar no padrão brasileiro
  // ("1.234,56") sem que o cursor/formatação interfiram na digitação.
  const [camposTexto, setCamposTexto] = useState<Record<CampoNumerico, string>>(() => formatarCampos(params));
  const [cenarios, setCenarios] = useState<CenarioMassa[]>(() => parseJson<{ cenarios?: CenarioMassa[] }>(estudo.massaCenariosJson)?.cenarios ?? []);
  const [selecionado, setSelecionado] = useState<string | null>(estudo.cenarioEscolhidoId);
  const [busy, setBusy] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  // motor v2: progresso real, motivo de inviabilidade, avisos e cache por assinatura das entradas
  const [progresso, setProgresso] = useState<{ fracao: number; etapa: string } | null>(null);
  const [inviabilidade, setInviabilidade] = useState<EstudoMassaGerado["inviabilidade"]>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [visao, setVisao] = useState<"tecnico" | "satelite">("tecnico");
  const cache = useRef<{ assinatura: string; resultado: EstudoMassaGerado } | null>(null);
  // Estudos salvos (correção 11)
  const [salvos, setSalvos] = useState<EstudoMassaSalvo[]>([]);
  const [carregandoSalvos, setCarregandoSalvos] = useState(true);
  const [aberto, setAberto] = useState<{ id: string; nome: string; versao: number } | null>(null);
  const [nome, setNome] = useState("");

  const aplicarLista = useCallback((lista: EstudoMassaSalvo[]) => {
    setSalvos(lista);
    // ao entrar na aba, o principal é o estudo aberto (os cenários exibidos vêm do espelho dele)
    setAberto((atual) => {
      if (atual) return lista.some((s) => s.id === atual.id) ? atual : null;
      const p = lista.find((s) => s.principal);
      return p ? { id: p.id, nome: p.nome, versao: p.versao } : null;
    });
    setNome((atual) => atual || lista.find((s) => s.principal)?.nome || "");
  }, [setNome]);

  const carregarSalvos = useCallback(async () => {
    try {
      aplicarLista(exigirResultado(await listarEstudosMassa(estudo.id)));
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao carregar os estudos salvos." });
    } finally {
      setCarregandoSalvos(false);
    }
  }, [estudo.id, aplicarLista]);

  useEffect(() => {
    let vivo = true;
    listarEstudosMassa(estudo.id).then((r) => {
      if (!vivo) return;
      try { aplicarLista(exigirResultado(r)); }
      catch (e) { setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao carregar os estudos salvos." }); }
      setCarregandoSalvos(false);
    });
    return () => { vivo = false; };
  }, [estudo.id, aplicarLista]);

  function upd(k: CampoNumerico, valorTexto: string) {
    setCamposTexto((c) => ({ ...c, [k]: valorTexto }));
    setParams((p) => ({ ...p, [k]: parseNumeroBR(valorTexto) }));
    setErro(null);
  }

  // Ao sair do campo, reformata o texto a partir do valor numérico já
  // parseado — limpa digitação intermediária/inválida sem alterar `params`.
  function reformatarCampo(k: CampoNumerico) {
    setCamposTexto((c) => ({ ...c, [k]: formatarCampo(params[k]) }));
  }

  const contorno = useMemo(() => {
    try {
      return estudo.geojson ? (JSON.parse(estudo.geojson) as Feature<Polygon>).geometry ?? null : null;
    } catch {
      return null;
    }
  }, [estudo.geojson]);

  // comprimento de cada lado da gleba (cima/esquerda/direita/baixo), medido no KML
  const ladosMedidos = useMemo(() => {
    if (contorno?.type !== "Polygon" || estudo.centroLng == null || estudo.centroLat == null) return null;
    try {
      const anelGeo = contorno.coordinates[0];
      const proj = criarProjecao([estudo.centroLng, estudo.centroLat]);
      const anelM = anelGeo.map((p) => proj.paraMetros(p));
      anelM[anelM.length - 1] = anelM[0];
      return medirLados(anelM);
    } catch { return null; }
  }, [contorno, estudo.centroLng, estudo.centroLat]);

  async function gerar(entradas = params) {
    if (!estudo.geojson || !estudo.centroLat || !estudo.centroLng) return;
    if (gerando) return; // impede execuções concorrentes

    const erroValidacao = validarParametrosMassa(entradas);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro(null);
    const anel = contorno?.coordinates[0];
    if (!anel || anel.length < 4) {
      setErro("Geometria da gleba inválida ou incompleta. Reenvie o KML na aba Terreno.");
      return;
    }
    const centro: [number, number] = [estudo.centroLng, estudo.centroLat];
    const assinatura = assinaturaEntradas(anel, entradas);
    const aplicar = (r: EstudoMassaGerado) => {
      setAvisos(r.avisos);
      setInviabilidade(r.inviabilidade);
      if (r.cenarios.length === 0) {
        // nenhum cenário válido: mantém os anteriores fora da tela de comparação, sem inventar cartões
        setCenarios([]);
        setSelecionado(null);
        setErro(r.inviabilidade?.motivo ?? "Nenhum cenário válido com esses parâmetros.");
        return;
      }
      setCenarios(r.cenarios);
      setSelecionado(r.cenarios[0].id);
    };
    // mesmas entradas + mesma versão do algoritmo = mesmo resultado: reaproveita sem recalcular
    if (cache.current?.assinatura === assinatura) { aplicar(cache.current.resultado); return; }

    setGerando(true);
    setProgresso({ fracao: 0, etapa: "Iniciando" });
    try {
      const r = await executarMotorMassa(anel, centro, entradas, (fracao, etapa) => setProgresso({ fracao, etapa }));
      cache.current = { assinatura, resultado: r };
      aplicar(r);
    } catch (e) {
      console.error("Erro ao gerar cenários de massa:", e);
      // falha nunca apaga os cenários anteriores nem os parâmetros digitados
      setErro("Não foi possível gerar os cenários com esses parâmetros. Verifique os valores informados e tente novamente.");
    } finally {
      setGerando(false);
      setProgresso(null);
    }
  }

  async function salvar(modo: ModoSalvarEstudoMassa, principal = false): Promise<boolean> {
    const nomeFinal = (modo === "novo" ? nome : aberto?.nome ?? nome).trim();
    if (!nomeFinal) { setMensagem({ tipo: "erro", texto: "Informe o nome do estudo antes de salvar." }); return false; }
    if (cenarios.length === 0) { setMensagem({ tipo: "erro", texto: "Gere ao menos um cenário antes de salvar." }); return false; }
    const pelaDivisa = params.tipologia === "rua_simples" && params.tracadoVia === "divisa";
    const ladosEscolhidos = pelaDivisa ? LADOS_GLEBA.filter((l) => params.ladosVia?.includes(l)) : [];
    const viaOposta = pelaDivisa && ladosEscolhidos.length === 0 && !!params.inverterLadoVia;
    if (gerando || cenarios.some((c) => !!c.viaLadoOposto !== viaOposta || (c.ladosVia ?? []).join("+") !== ladosEscolhidos.join("+"))) {
      setMensagem({ tipo: "erro", texto: "Gere os cenários com o lado selecionado da rua antes de salvar." });
      return false;
    }
    setBusy(true);
    setMensagem(null);
    try {
      const r = exigirResultado(await salvarEstudoMassa(estudo.id, {
        modo, id: modo === "novo" ? null : aberto?.id ?? null, nome: modo === "atualizar" ? nome.trim() || nomeFinal : nomeFinal,
        parametros: params, cenarios, cenarioEscolhidoId: selecionado, principal,
      }));
      setAberto({ id: r.id, nome: r.nome, versao: r.versao });
      setNome(r.nome);
      setMensagem({ tipo: "ok", texto: `Estudo "${r.nome}" (versão ${r.versao}) salvo${r.principal ? " — é o estudo principal" : ""}.` });
      await carregarSalvos();
      return true;
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao salvar o estudo." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function usarNaViabilidade() {
    if (!selecionado) return;
    // salva (no estudo aberto ou como novo) e marca como principal: o espelho
    // legado leva cenários, cenário escolhido e mix de produtos à Viabilidade.
    const ok = await salvar(aberto ? "atualizar" : "novo", true);
    if (ok) window.location.reload();
  }

  async function abrir(s: EstudoMassaSalvo) {
    setBusy(true);
    setMensagem(null);
    try {
      const completo = exigirResultado(await abrirEstudoMassa(estudo.id, s.id));
      const p = { ...paramsIniciais(estudo), inverterLadoVia: false, ladosVia: [], ...(completo.parametros ?? {}) };
      setParams(p);
      setCamposTexto(formatarCampos(p));
      setCenarios(completo.cenarios);
      setSelecionado(completo.cenarioEscolhidoId ?? completo.cenarios[0]?.id ?? null);
      setAberto({ id: completo.id, nome: completo.nome, versao: completo.versao });
      setNome(completo.nome);
      setMensagem({ tipo: "ok", texto: `Estudo "${completo.nome}" (versão ${completo.versao}) aberto para edição.` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao abrir o estudo." });
    } finally {
      setBusy(false);
    }
  }

  async function marcarPrincipal(s: EstudoMassaSalvo) {
    setBusy(true);
    setMensagem(null);
    try {
      exigirResultado(await marcarEstudoMassaPrincipal(estudo.id, s.id));
      setMensagem({ tipo: "ok", texto: `"${s.nome}" (versão ${s.versao}) agora é o estudo principal (Viabilidade, Orçamento e Relatório usam este cenário).` });
      await carregarSalvos();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao marcar o estudo principal." });
    } finally {
      setBusy(false);
    }
  }

  async function excluir(s: EstudoMassaSalvo) {
    const aviso = s.principal
      ? `Excluir "${s.nome}" (versão ${s.versao})? Ele é o ESTUDO PRINCIPAL: se houver unidades, orçamento ou viabilidade dependentes a exclusão será recusada. Os demais estudos não são afetados.`
      : `Excluir "${s.nome}" (versão ${s.versao})? Os demais estudos e a poligonal do terreno não são afetados.`;
    if (!window.confirm(aviso)) return;
    setBusy(true);
    setMensagem(null);
    try {
      exigirResultado(await excluirEstudoMassa(estudo.id, s.id));
      if (aberto?.id === s.id) setAberto(null);
      setMensagem({ tipo: "ok", texto: `Estudo "${s.nome}" (versão ${s.versao}) excluído.` });
      await carregarSalvos();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao excluir o estudo." });
    } finally {
      setBusy(false);
    }
  }

  const cenarioAtivo = cenarios.find((c) => c.id === selecionado) ?? cenarios[0];
  const lotesAvulsos = useMemo(() => parseLotesAvulsos(estudo.lotesAvulsosJson), [estudo.lotesAvulsosJson]);

  const rotulo = (
    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
      {ROTULO_ESTUDO_PRELIMINAR}
    </p>
  );

  if (!estudo.geojson) {
    const resumo = resumoLotesAvulsos(lotesAvulsos);
    return (
      <div className="space-y-4">
        {rotulo}
        <div className="bg-white border border-gray-100 p-6 text-sm space-y-2">
          <p className="flex items-start gap-2 text-gray-700">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            {estudo.semKml ? AVISO_SEM_POLIGONAL : "Envie o KML do terreno (aba Terreno) para gerar o estudo de massa."}
          </p>
          {estudo.semKml && (
            <p className="text-gray-600">
              Lotes avulsos cadastrados no Terreno: <strong>{resumo.total}</strong> lote(s) em <strong>{resumo.quadras}</strong> quadra(s),
              área total {m2(resumo.areaTotalM2)}{resumo.total > 0 ? ` · média ${m2(resumo.areaMediaM2)}` : ""}.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rotulo}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Grid3x3 size={13} /> Parâmetros do parcelamento
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label htmlFor="massa-tipologia" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Tipologia do cenário</label>
            <select id="massa-tipologia" value={params.tipologia ?? "grid"}
              onChange={(e) => { setParams((p) => ({ ...p, tipologia: e.target.value as TipologiaMassa })); setErro(null); }}
              className="w-full text-sm border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:border-[var(--brand-yellow)]">
              {TIPOLOGIAS_MASSA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {params.tipologia === "rua_simples" && (
            <div className="col-span-2">
              <label htmlFor="massa-tracado-via" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Traçado da via</label>
              <select id="massa-tracado-via" value={params.tracadoVia ?? "reta"}
                onChange={(e) => { setParams((p) => ({ ...p, tracadoVia: e.target.value as "reta" | "divisa" })); setErro(null); }}
                className="w-full text-sm border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:border-[var(--brand-yellow)]">
                <option value="reta">Reta</option>
                <option value="divisa">Acompanha a divisa (com curvas)</option>
              </select>
            </div>
          )}
          {params.tipologia === "rua_simples" && params.tracadoVia !== "divisa" && (
            <div className="col-span-2">
              <label htmlFor="massa-formato-lote" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Formato do lote</label>
              <select id="massa-formato-lote" value={params.formatoLote ?? "retangular"}
                onChange={(e) => { setParams((p) => ({ ...p, formatoLote: e.target.value as "retangular" | "divisa" })); setErro(null); }}
                className="w-full text-sm border border-gray-200 px-2 py-1.5 bg-white focus:outline-none focus:border-[var(--brand-yellow)]">
                <option value="retangular">Retangular exato (testada × profundidade)</option>
                <option value="divisa">Acompanha a divisa (fundo até o limite, área ≥ mínima)</option>
              </select>
            </div>
          )}
          {CAMPOS.map((c) => (
            <CampoTexto key={c.k} id={`massa-${c.k}`} label={c.label} valor={camposTexto[c.k]}
              onChange={(v) => upd(c.k, v)} onBlur={() => reformatarCampo(c.k)} />
          ))}
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 mb-2">Áreas não parceláveis (m²) — informe quando não vierem do KML</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CAMPOS_RESTRICOES.map((c) => (
            <CampoTexto key={c.k} id={`massa-${c.k}`} label={c.label} valor={camposTexto[c.k]}
              onChange={(v) => upd(c.k, v)} onBlur={() => reformatarCampo(c.k)} />
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          Cada restrição entra uma única vez no quadro de áreas. A APP vem preenchida com a área calculada no mapa do Terreno, quando houver.
        </p>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 mb-2">Área do sistema viário (m²)</p>
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="flex gap-3 text-xs text-gray-700" aria-label="Modo da área do sistema viário">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="massa-modo-viario" checked={(params.modoSistemaViario ?? "automatico") === "automatico"}
                onChange={() => { setParams((p) => ({ ...p, modoSistemaViario: "automatico" })); setErro(null); }} /> Automático (área das vias desenhadas)
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="massa-modo-viario" checked={params.modoSistemaViario === "manual"}
                onChange={() => { setParams((p) => ({ ...p, modoSistemaViario: "manual" })); setErro(null); }} /> Manual
            </label>
          </fieldset>
          <div className="w-48">
            <CampoTexto id="massa-areaSistemaViarioM2" label="Área viária (m²)" valor={camposTexto.areaSistemaViarioM2 ?? ""}
              desabilitado={params.modoSistemaViario !== "manual"}
              onChange={(v) => upd("areaSistemaViarioM2", v)} onBlur={() => reformatarCampo("areaSistemaViarioM2")} />
          </div>
          {params.tipologia === "rua_simples" && params.tracadoVia === "divisa" && (
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-xs font-semibold text-gray-700" aria-label="Lados da gleba com rua">
              {LADOS_GLEBA.map((lado) => {
                const medida = ladosMedidos?.find((x) => x.lado === lado);
                const marcado = params.ladosVia?.includes(lado) ?? false;
                return (
                  <label key={lado} className="inline-flex items-center gap-1.5" title={medida ? `${medida.comprimentoM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m de divisa — cabem até ${Math.floor(medida.comprimentoM / Math.max(params.testadaLoteM, 1e-9))} frentes de ${params.testadaLoteM.toLocaleString("pt-BR")} m` : undefined}>
                    <input type="checkbox" checked={marcado} disabled={gerando || busy || !estudo.geojson || (medida?.comprimentoM ?? 0) <= 0}
                      onChange={(e) => {
                        const atuais = new Set<LadoGleba>(params.ladosVia ?? []);
                        if (e.target.checked) atuais.add(lado); else atuais.delete(lado);
                        const entradas = { ...params, inverterLadoVia: false, ladosVia: LADOS_GLEBA.filter((l) => atuais.has(l)) };
                        setParams(entradas);
                        void gerar(entradas);
                      }} />
                    {ROTULO_LADO[lado]}
                    {medida && medida.comprimentoM > 0 && <span className="font-normal text-gray-400">({medida.comprimentoM.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m)</span>}
                  </label>
                );
              })}
            </fieldset>
          )}
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          {params.modoSistemaViario === "manual"
            ? "Manual: o motor ajusta a malha para a via desenhada bater com o valor (±5%) — Rua Simples: comprimento da via; Grade/Cul-de-sac: quadras mais curtas (nunca acima do máximo informado) ou supressão de ruas de menor aproveitamento. Se nenhum ajuste fechar, mostra a divergência e não cria implantação fictícia."
            : `Automático: usa a área geométrica das vias desenhadas${cenarioAtivo?.sistemaViario ? ` — cenário atual: ${m2(cenarioAtivo.sistemaViario.areaGeometricaM2)}` : ""}.`}
          {params.tipologia === "rua_simples" && " Na Rua Simples o comprimento máximo da quadra não se aplica (via única)."}
          {params.tipologia === "vias_publicas" && " Vias públicas: todas as divisas da gleba (por fora e por dentro) já são frente para via pública — o motor não desenha via interna e não usa largura da via nem quadra máxima. 100% da área vira lote: as únicas exigências são frente ≥ testada e área ≥ lote mínimo; fundos, laterais e frentes maiores variam de lote para lote, e a profundidade informada é só referência (sem sobras)."}
          {params.tipologia === "rua_simples" && params.tracadoVia === "divisa" && ((params.ladosVia?.length ?? 0) > 0
            ? " Rua somente nos lados marcados: cada lote tem a frente EXATA da testada sobre a via e o fundo variável até a divisa oposta (a divisa lateral gira quando a faixa não atinge a área mínima). A quantidade máxima é o comprimento da divisa ÷ testada. Sem lado marcado, o motor escolhe a divisa automaticamente."
            : " Via pela divisa: marque a(s) rua(s) de cima, da esquerda, da direita ou de baixo para fixar onde a via fica. Sem marcação, o motor escolhe a divisa; a testada é a frente MÍNIMA de cada lote (maior só onde preciso para atingir a área mínima) e os lotes vão até a divisa oposta.")}
        </p>
        <button onClick={() => void gerar()} disabled={gerando || busy || !estudo.geojson}
          className="mt-4 flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <Grid3x3 size={14} />}
          {gerando ? "Calculando cenários…" : "Gerar cenários otimizados"}
        </button>
        {progresso && (
          <div className="mt-2 max-w-md" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso.fracao * 100)} aria-label="Progresso do cálculo">
            <div className="h-1.5 bg-gray-100"><div className="h-1.5 bg-[var(--brand-yellow)] transition-all" style={{ width: `${Math.round(progresso.fracao * 100)}%` }} /></div>
            <p className="text-[10px] text-gray-600 mt-1">{progresso.etapa} · {Math.round(progresso.fracao * 100)}%</p>
          </div>
        )}
        {erro && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 p-3">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 space-y-1">
              <p>{erro}</p>
              {inviabilidade?.causas.length ? (
                <ul className="list-disc pl-4">{inviabilidade.causas.map((c) => <li key={c}>{c}</li>)}</ul>
              ) : null}
            </div>
          </div>
        )}
        {avisos.map((a) => <p key={a} className="mt-2 text-[11px] text-gray-600">{a}</p>)}
      </div>

      {cenarios.length > 0 && (
        <>
          {/* Comparação de cenários */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cenarios.map((c, i) => {
              const ativo = c.id === selecionado;
              return (
                <button key={c.id} onClick={() => setSelecionado(c.id)}
                  className={`text-left border p-4 transition-colors ${ativo ? "border-[var(--brand-yellow)] bg-yellow-50/40" : "border-gray-100 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-[var(--brand-dark)] uppercase flex items-center gap-1">
                      {i === 0 && <Trophy size={12} className="text-[var(--brand-yellow)]" />} Cenário {i + 1}
                    </p>
                    <span className="text-[10px] text-gray-600">{ROTULO_TIPOLOGIA[c.tipologia ?? "grid"]} · {c.anguloVia.toLocaleString("pt-BR")}°</span>
                  </div>
                  {c.criterioRotulo && <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">{c.criterioRotulo}</p>}
                  <p className="font-black text-[var(--brand-dark)] text-xl leading-none mb-1">{c.kpis.lotesVendaveis} lotes</p>
                  <p className="text-[11px] text-gray-500">
                    {formatArea(c.kpis.areaVendavelM2)} vendáveis · {(c.kpis.aproveitamento * 100).toFixed(0)}% aproveitamento
                  </p>
                  <p className="text-sm font-bold text-green-600 mt-1">VGV {formatCurrency(c.kpis.vgv)}</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    lote {c.testadaLoteM.toLocaleString("pt-BR")} × {c.profundidadeLoteM.toLocaleString("pt-BR")} m · via {c.larguraViaM.toLocaleString("pt-BR")} m
                    {c.sistemaViario ? ` · viário ${formatArea(c.sistemaViario.areaGeometricaM2)}` : ""}
                  </p>
                  {c.inviabilidade && <p className="text-[11px] text-red-700 mt-2">{c.inviabilidade}</p>}
                </button>
              );
            })}
          </div>

          {/* Mapa do cenário selecionado */}
          {cenarioAtivo && (
            <div className="bg-white border border-gray-100 p-2">
              <div className="flex gap-1 mb-2" role="tablist" aria-label="Modo de visualização">
                <button role="tab" aria-selected={visao === "tecnico"} onClick={() => setVisao("tecnico")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border ${visao === "tecnico" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)] border-transparent" : "border-gray-200 text-[var(--brand-dark)]"}`}>
                  <PenTool size={13} /> Desenho técnico
                </button>
                <button role="tab" aria-selected={visao === "satelite"} onClick={() => setVisao("satelite")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border ${visao === "satelite" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)] border-transparent" : "border-gray-200 text-[var(--brand-dark)]"}`}>
                  <Satellite size={13} /> Satélite
                </button>
              </div>
              {visao === "tecnico" && estudo.centroLng != null && estudo.centroLat != null ? (
                <PlantaTecnica geojson={estudo.geojson} cenario={cenarioAtivo} centro={[estudo.centroLng, estudo.centroLat]}
                  height={520} titulo={`${cenarioAtivo.id} · ${ROTULO_TIPOLOGIA[cenarioAtivo.tipologia ?? "grid"]}`} />
              ) : (
                <>
              <MapaMassa geojson={estudo.geojson} lotes={cenarioAtivo.lotes} vias={[...(cenarioAtivo.ruas ?? []), ...(cenarioAtivo.vias ?? [])]} height={460} />
              <div className="flex flex-wrap gap-3 p-2 text-[10px] text-gray-600">
                <Legenda cor={CORES_MASSA.vendavel} texto="Lotes vendáveis" />
                <Legenda cor={CORES_MASSA.institucional} texto="Institucional" />
                <Legenda cor={CORES_MASSA.verde} texto="Área verde" />
                <Legenda cor={CORES_MASSA.nao_parcelavel} texto="Não parcelável (restrições)" />
                <Legenda cor={CORES_MASSA.via} texto={cenarioAtivo.tipologia === "cul_de_sac" ? "Vias e balões de retorno" : "Vias"} />
              </div>
                </>
              )}
              <p className="text-[10px] font-bold text-amber-800 px-2 pb-2">{ROTULO_ESTUDO_PRELIMINAR}.</p>
              {(cenarioAtivo.limitacoes ?? []).map((l) => <p key={l} className="text-[10px] text-gray-600 px-2 pb-1">{l}</p>)}
            </div>
          )}

          {cenarioAtivo && <QuadroAreasMassaTabela quadro={cenarioAtivo.quadroAreas ?? null} />}
        </>
      )}

      {cenarios.length === 0 && !gerando && (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <Grid3x3 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cenário gerado</p>
          <p className="text-gray-600 text-sm mt-1">
            O motor testa, de forma determinística, orientações e posições da malha com as dimensões informadas e devolve até 3 alternativas válidas e distintas.
          </p>
        </div>
      )}

      {/* Salvar estudo (correção 11) */}
      <div className="bg-white border border-gray-100 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Save size={13} /> Salvar estudo</p>
        <p className="text-xs text-gray-600">
          {aberto ? <>Editando <strong>{aberto.nome}</strong> · versão {aberto.versao}</> : "Novo estudo (ainda não salvo)."}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="massa-nome-estudo" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Nome do estudo</label>
            <input id="massa-nome-estudo" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Estudo base"
              className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
          </div>
          {aberto && (
            <button onClick={() => salvar("atualizar")} disabled={busy || cenarios.length === 0}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> Salvar alterações
            </button>
          )}
          {aberto && (
            <button onClick={() => salvar("nova_versao")} disabled={busy || cenarios.length === 0}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
              <CopyPlus size={13} /> Salvar nova versão
            </button>
          )}
          <button onClick={() => salvar("novo")} disabled={busy || cenarios.length === 0}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 disabled:opacity-50 ${aberto ? "border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)]" : "bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90"}`}>
            <Save size={13} /> {aberto ? "Salvar como novo estudo" : "Salvar estudo"}
          </button>
          <button onClick={usarNaViabilidade} disabled={busy || !selecionado}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
            <Send size={13} /> Usar cenário na Viabilidade (principal)
          </button>
        </div>
        {mensagem && (
          <p role={mensagem.tipo === "erro" ? "alert" : "status"}
            className={`text-xs flex items-start gap-1.5 ${mensagem.tipo === "erro" ? "text-red-700" : "text-green-700"}`}>
            {mensagem.tipo === "erro" ? <AlertTriangle size={13} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
            {mensagem.texto}
          </p>
        )}
      </div>

      {/* Estudos Salvos (correção 11) */}
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FolderOpen size={13} /> Estudos salvos</p>
        {carregandoSalvos ? (
          <p className="text-xs text-gray-600 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando…</p>
        ) : salvos.length === 0 ? (
          <p className="text-xs text-gray-600">Nenhum estudo salvo. Gere os cenários e use &quot;Salvar estudo&quot;.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {salvos.map((s) => (
              <li key={s.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--brand-dark)] break-words">
                    {s.nome} <span className="font-normal text-gray-600">· versão {s.versao}</span>
                    {s.principal && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[var(--brand-yellow)] text-[var(--brand-dark)]"><Star size={10} /> Principal</span>}
                    {aberto?.id === s.id && <span className="ml-2 text-[10px] font-bold uppercase text-gray-600">(aberto)</span>}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    {s.indicadores ? `${s.indicadores.lotesVendaveis} lotes · ${m2(s.indicadores.areaVendavelM2)} vendáveis · VGV ${formatCurrency(s.indicadores.vgv)} · ${ROTULO_TIPOLOGIA[s.indicadores.tipologia ?? "grid"] ?? s.indicadores.tipologia}` : "Sem indicadores"}
                    {" · "}{s.autorNome ?? "autor não registrado"} · {new Date(s.atualizadoEm).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => abrir(s)} disabled={busy || gerando}
                    className="text-xs font-bold px-3 py-1.5 border border-gray-200 hover:border-[var(--brand-yellow)] disabled:opacity-50">Abrir / editar</button>
                  {!s.principal && (
                    <button onClick={() => marcarPrincipal(s)} disabled={busy}
                      className="text-xs font-bold px-3 py-1.5 border border-gray-200 hover:border-[var(--brand-yellow)] disabled:opacity-50">Marcar principal</button>
                  )}
                  <button onClick={() => excluir(s)} disabled={busy} aria-label={`Excluir ${s.nome} versão ${s.versao}`}
                    className="text-xs font-bold px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"><Trash2 size={12} /> Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CampoTexto({ id, label, valor, onChange, onBlur, desabilitado }: { id: string; label: string; valor: string; onChange: (v: string) => void; onBlur: () => void; desabilitado?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{label}</label>
      <input id={id} type="text" inputMode="decimal" value={valor} disabled={desabilitado}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder="0,00"
        className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)] disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 border border-gray-300" style={{ background: cor }} />{texto}</span>;
}

/** Quadro de áreas do cenário (correção 10) — cada área numa única parcela. */
export function QuadroAreasMassaTabela({ quadro }: { quadro: QuadroAreasMassa | null }) {
  if (!quadro) {
    return (
      <div className="bg-white border border-gray-100 p-4 text-xs text-gray-600">
        Quadro de áreas indisponível para este cenário (gerado antes da versão atual). Gere os cenários novamente para obtê-lo.
      </div>
    );
  }
  const base = quadro.areaBrutaM2 > 0 ? quadro.areaBrutaM2 : 1;
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Quadro de áreas do cenário</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100">
              <th className="py-1.5 pr-2">Área</th><th className="py-1.5 pr-2 text-right">m²</th><th className="py-1.5 text-right">% da bruta</th>
            </tr>
          </thead>
          <tbody>
            {linhasQuadroAreas(quadro).map((l) => (
              <tr key={l.rotulo} className={`border-b border-gray-50 ${l.destaque ? "font-bold text-[var(--brand-dark)]" : "text-gray-700"}`}>
                <td className="py-1.5 pr-2">{l.rotulo}</td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">{l.m2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-1.5 text-right">{pct(l.m2 / base)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
        <Indicador rotulo="Nº de lotes" valor={quadro.nLotes.toLocaleString("pt-BR")} />
        <Indicador rotulo="Área média do lote" valor={m2(quadro.areaMediaLoteM2)} />
        <Indicador rotulo="Aproveitamento" valor={`${pct(quadro.aproveitamento)} da bruta · ${pct(quadro.aproveitamentoParcelavel)} da parcelável`} />
        <Indicador rotulo="VGV" valor={formatCurrency(quadro.vgv)} />
      </div>
      {quadro.avisos.map((a) => <p key={a} role="alert" className="text-[11px] text-red-700 mt-2">{a}</p>)}
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border border-gray-100 p-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{rotulo}</p>
      <p className="font-bold text-[var(--brand-dark)] break-words">{valor}</p>
    </div>
  );
}
