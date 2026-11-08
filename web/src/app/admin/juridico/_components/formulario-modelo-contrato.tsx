"use client";

import { useState } from "react";
import { MODELOS_CONTRATO, moedaContrato, valorComissaoContrato, type OpcoesContrato, type TipoModelo } from "@/lib/contratos/modelos";
import { centavosDe } from "@/lib/financeiro/obra";

const campo = "block w-full min-w-0 rounded border border-current/25 bg-gray-50 px-3 py-2 text-sm";
const rotulo = "grid min-w-0 gap-1 text-sm";

export function FormularioModeloContrato({ opcoes, leadId, pending, salvar }: {
  opcoes: OpcoesContrato;
  leadId?: string;
  pending: boolean;
  salvar: (dados: FormData) => void;
}) {
  const obras = leadId ? opcoes.obras.filter((o) => o.leadId === leadId) : opcoes.obras;
  const [tipo, setTipo] = useState<TipoModelo>("construcao_atc");
  const [obraId, setObraId] = useState(obras.length === 1 ? obras[0].id : "");
  const obra = obras.find((o) => o.id === obraId);
  const execucao = tipo === "execucao_obra";

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar(new FormData(e.currentTarget)); }} className="grid gap-4 sm:grid-cols-2">
      <label className={rotulo}>Tipo
        <select name="tipo" className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoModelo)}>
          {Object.entries(MODELOS_CONTRATO).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <Texto nome="dataAssinatura" label="Data da assinatura" tipo="date" />
      <Texto nome="empresaNome" label="Parte A — Razão social" inicial={opcoes.empresa.nome} />
      <Texto nome="empresaDocumento" label="CNPJ da Parte A" inicial={opcoes.empresa.documento} />
      <div className="sm:col-span-2"><Texto nome="empresaEndereco" label="Endereço da Parte A" inicial={opcoes.empresa.endereco} /></div>
      <label className={`${rotulo} sm:col-span-2`}>Obra e cliente vinculados
        <select required name="obraId" className={campo} value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="">Selecione a obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome} · {o.cliente}</option>)}
        </select>
      </label>
      {!obras.length && <p className="sm:col-span-2 text-sm">Vincule o cliente e o imóvel no cadastro da obra para gerar o contrato.</p>}
      {obra && <DadosDaObra key={`${obra.id}:${tipo}`} obra={obra} opcoes={opcoes} execucao={execucao} />}
      <button type="submit" disabled={!obra || pending} className="sm:col-span-2 rounded bg-[#C9A961] p-2.5 font-bold text-[#1A2332] disabled:opacity-50">
        {pending ? "Salvando…" : "Salvar contrato"}
      </button>
    </form>
  );
}

function Texto({ nome, label, inicial, tipo = "text", required = true }: {
  nome: string; label: string; inicial?: string; tipo?: string; required?: boolean;
}) {
  return <label className={rotulo}>{label}<input name={nome} type={tipo} defaultValue={inicial} className={campo} required={required} maxLength={255} /></label>;
}

function DadosDaObra({ obra, opcoes, execucao }: {
  obra: OpcoesContrato["obras"][number]; opcoes: OpcoesContrato; execucao: boolean;
}) {
  const [terceiro, setTerceiro] = useState(false);
  const [empreiteiroId, setEmpreiteiroId] = useState(obra.empreiteiroId);
  const [corretorId, setCorretorId] = useState(obra.corretorId);
  const empreiteiro = opcoes.empreiteiros.find((e) => e.id === empreiteiroId);
  const corretor = opcoes.corretores.find((c) => c.id === corretorId) ?? null;
  const comissao = valorComissaoContrato(obra, corretor);
  const valor = centavosDe(execucao ? obra.valorExecucao : obra.vgv);

  return <>
    <p className="sm:col-span-2 break-words text-sm">
      {execucao ? "Proprietário" : "Parte B — Comprador"} <strong>{obra.cliente}</strong><br />
      Imóvel <strong>{obra.enderecoImovel}</strong><br />
      {execucao ? "Orçamento previsto da execução" : "VGV simulado"} <strong>{valor === null ? "Preencha na origem" : moedaContrato(valor)}</strong>
    </p>
    {!obra.cpfCliente && <Texto nome="cpfCliente" label="CPF do cliente" />}
    {!execucao && !obra.enderecoCliente && <Texto nome="enderecoCliente" label="Endereço do comprador" />}
    {!execucao && <>
      {obra.conjuge ? <p className="self-end text-sm">Cônjuge <strong>{obra.conjuge}</strong></p> :
        <Texto nome="nomeConjuge" label="Nome do cônjuge, se aplicável" required={false} />}
      <Texto nome="cpfConjuge" label="CPF do cônjuge, se aplicável" required={!!obra.conjuge} />
    </>}
    <Texto nome="matricula" label="Matrícula do imóvel" inicial={obra.matricula} />
    <Texto nome="cartorio" label="Cartório de Registro de Imóveis" inicial={obra.cartorio} />
    <Texto nome="prazo" label="Prazo da obra em meses" inicial={obra.prazo || (execucao ? "" : "6")} tipo="number" />
    {execucao ? <>
      <label className={rotulo}>Parte B — Empreiteiro
        <select required name="empreiteiroId" className={campo} value={empreiteiroId} onChange={(e) => setEmpreiteiroId(e.target.value)}>
          <option value="">Selecione o empreiteiro</option>
          {opcoes.empreiteiros.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
      {empreiteiro && <div className="contents" key={empreiteiro.id}>
        {!empreiteiro.documento && <Texto nome="empreiteiroDocumento" label="CPF/CNPJ do empreiteiro" />}
        {!empreiteiro.endereco && <Texto nome="empreiteiroEndereco" label="Endereço do empreiteiro" />}
        <Texto nome="empreiteiroRepresentante" label="Representante legal do empreiteiro PJ (nome e CPF)" required={false} />
      </div>}
    </> : <>
      <label className={rotulo}>Valor negociado do terreno (R$)
        <input className={campo} type="number" name="terrenoValor" min="0.01" step="0.01" required defaultValue={obra.terreno ?? ""} />
        {obra.terreno !== null && <small>Valor sugerido da obra. Confira o preço negociado do lote.</small>}
      </label>
      <Texto nome="prazoTerreno" label="Data limite para compra do lote" tipo="date" />
      <label className={rotulo}>Proprietário do terreno
        <select name="terrenoTerceiro" className={campo} required defaultValue="" onChange={(e) => setTerceiro(e.target.value === "sim")}>
          <option value="">Selecione</option>
          <option value="sim">Terceiro</option>
          <option value="nao">Empresa da Parte A</option>
        </select>
      </label>
      {terceiro && <>
        <Texto nome="terrenistaNome" label="Terrenista — Nome completo ou razão social" />
        <Texto nome="terrenistaDocumento" label="CPF/CNPJ do terrenista" />
        <Texto nome="terrenistaEndereco" label="Endereço do terrenista" />
        <label className={rotulo}>Cotitulares ou cônjuge anuente, se aplicável
          <textarea name="outrosTitulares" className={campo} maxLength={1000} placeholder="Nome | CPF/CNPJ | endereço (um por linha)" />
        </label>
      </>}
    </>}
    <label className={rotulo}>Corretor interveniente
      <select name="corretorId" className={campo} value={corretorId} onChange={(e) => setCorretorId(e.target.value)} required={!!obra.corretorId}>
        <option value="">{obra.corretorId ? "Selecione o corretor" : "Sem corretor"}</option>
        {opcoes.corretores.filter((c) => !obra.corretorId || c.id === obra.corretorId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </label>
    {corretor && <p className="self-end text-sm">
      {comissao.valorCentavos === null ? "Confira o percentual no cadastro do corretor ou da obra." :
        `Comissão ${Number(comissao.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% · ${moedaContrato(comissao.valorCentavos)}. Pagamento conforme medição e recebimento da CAIXA.`}
    </p>}
  </>;
}
