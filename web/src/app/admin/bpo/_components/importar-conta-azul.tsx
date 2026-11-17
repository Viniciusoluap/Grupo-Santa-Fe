"use client";
// Paridade BPO (13/11): botão "Importar backup Conta Azul" (gêmeo de Prospecta client/src/components/bpo/ImportarContaAzul.tsx).
// O ZIP baixado em Conta Azul Pro > Meu Plano > Backup é aberto aqui no navegador (só os .csv); o servidor relê os
// CSVs, mostra a prévia e só grava depois da confirmação.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unzipSync } from "fflate";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";
import { exigirResultado } from "@/lib/acao-resultado";
import { importarContaAzulAcao, liberarReimportacaoContaAzulAcao, previaContaAzulAcao } from "@/lib/actions/bpo-paridade";
import type { PreviaContaAzul } from "@/lib/bpo-conta-azul";
import { CONFIRMACAO_LIBERAR_REIMPORTACAO, confirmacaoLiberarValida } from "@/lib/financeiro/conta-azul";

const LIMITE_ZIP = 30 * 1024 * 1024;

/** CSV em UTF-8 (padrão do backup); se não for UTF-8 válido, Windows-1252 (planilhas antigas). */
function decodificar(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

export async function lerZipContaAzul(arquivo: File): Promise<Record<string, string>> {
  if (arquivo.size > LIMITE_ZIP) throw new Error("O arquivo passa de 30 MB.");
  let conteudo: Record<string, Uint8Array>;
  try {
    conteudo = unzipSync(new Uint8Array(await arquivo.arrayBuffer()), { filter: (f) => /\.csv$/i.test(f.name) && !f.name.startsWith("__MACOSX/") });
  } catch {
    throw new Error("Não foi possível abrir o ZIP. Envie o arquivo do backup do Conta Azul sem alterar.");
  }
  const arquivos: Record<string, string> = {};
  for (const [nome, bytes] of Object.entries(conteudo)) arquivos[nome.split("/").pop()!] = decodificar(bytes);
  if (!Object.keys(arquivos).length) throw new Error("O ZIP não tem arquivos .csv do Conta Azul.");
  return arquivos;
}

const ROTULO_ARQUIVO: Record<string, string> = {
  "propostas_comerciais.csv": "Propostas comerciais", "lista_precos.csv": "Lista de preços", "nfes.csv": "Notas fiscais (NF-e)",
  "negociacoes.csv": "Vendas/notas com itens", "produtos.csv": "Produtos",
};

export function ImportarContaAzul({ onMensagem }: { onMensagem: (m: string) => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<Record<string, string> | null>(null);
  const [previa, setPrevia] = useState<PreviaContaAzul | null>(null);
  const [lendo, setLendo] = useState(false);
  const [importando, iniciar] = useTransition();

  async function escolher(f: File | undefined) {
    if (entrada.current) entrada.current.value = "";
    if (!f) return;
    setLendo(true);
    try {
      const lidos = await lerZipContaAzul(f);
      const p = exigirResultado(await previaContaAzulAcao(lidos));
      setArquivos(lidos);
      setPrevia(p);
    } catch (e) {
      onMensagem(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  /** Depois de liberar: a prévia é refeita com os mesmos arquivos (o servidor relê tudo). */
  async function refazerPrevia() {
    if (!arquivos) return;
    try { setPrevia(exigirResultado(await previaContaAzulAcao(arquivos))); }
    catch (e) { onMensagem(e instanceof Error ? e.message : "Falha ao refazer a prévia."); }
  }

  function fechar() { if (!importando) { setArquivos(null); setPrevia(null); } }

  function importar() {
    if (!arquivos) return;
    iniciar(async () => {
      try {
        const r = exigirResultado(await importarContaAzulAcao(arquivos));
        onMensagem(`Conta Azul importado: ${r.lancamentosCriados} lançamento(s) e ${r.clientesCriados} cliente(s) novos${r.lancamentosJaImportados ? `; ${r.lancamentosJaImportados} já existiam` : ""}${r.lancamentosArquivadosBloqueando ? `; ${r.lancamentosArquivadosBloqueando} bloqueado(s) por arquivados` : ""}.`);
        setArquivos(null); setPrevia(null);
        router.refresh();
      } catch (e) { onMensagem(e instanceof Error ? e.message : "Falha ao importar."); }
    });
  }

  const p = previa;
  const nadaNovo = p && p.lancamentos.novos === 0 && p.clientesNovos === 0;
  return (
    <>
      <input ref={entrada} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden"
        aria-label="Arquivo ZIP do backup do Conta Azul" onChange={(e) => void escolher(e.target.files?.[0])} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={lendo || importando}
        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50">
        <Upload size={13} /> {lendo ? "Lendo backup…" : "Importar backup Conta Azul"}
      </button>
      {arquivos && p && (
        <Modal titulo="Importar backup do Conta Azul" onFechar={fechar} tamanho="lg" classeCorpo="space-y-4 text-sm min-w-0">
          {p.lancamentosDoExtratoNoPeriodo > 0 && (
            <p role="alert" className="border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              Atenção: já existem {p.lancamentosDoExtratoNoPeriodo} lançamento(s) importados do extrato bancário nesse período. As mesmas
              movimentações podem entrar duas vezes no DRE — confira antes de importar.
            </p>
          )}
          {p.lancamentos.periodo && <p className="text-gray-600">Período do backup: competências de {p.lancamentos.periodo.de} a {p.lancamentos.periodo.ate}.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Resumo titulo="Lançamentos novos" valor={String(p.lancamentos.novos)} detalhe={`${p.lancamentos.pagos} pago(s) · ${p.lancamentos.emAberto} em aberto (vão para A classificar)`} />
            <Resumo titulo="Já importados (ativos)" valor={String(p.lancamentos.jaImportados)} detalhe="estão no BPO e não serão duplicados" />
            <Resumo titulo="Receitas (aba Cobranças)" valor={formatCurrency(Number(p.lancamentos.receitas.total))} detalhe={`${p.lancamentos.receitas.quantidade} lançamento(s)`} />
            <Resumo titulo="Despesas" valor={formatCurrency(Number(p.lancamentos.despesas.total))} detalhe={`${p.lancamentos.despesas.quantidade} lançamento(s)`} />
            <Resumo titulo="Clientes BPO novos" valor={String(p.clientesNovos)} detalhe={`${p.clientesExistentes} já cadastrado(s) · ${p.pessoas.clientes} cliente(s) no backup`} />
            <Resumo titulo="Fornecedores" valor={String(p.pessoas.fornecedores)} detalhe="entram como nome nos lançamentos" />
          </div>
          {p.lancamentos.arquivados.bloqueando > 0 && (
            <LiberarReimportacao arquivos={arquivos} arquivados={p.lancamentos.arquivados} onMensagem={onMensagem} onLiberado={() => void refazerPrevia()} />
          )}
          {p.lancamentos.porCategoria.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Categoria no BPO (a do Conta Azul fica nas observações)</p>
              <ul className="grid grid-cols-1 gap-x-4 text-gray-700 sm:grid-cols-2">
                {p.lancamentos.porCategoria.map((c) => <li key={c.categoria} className="flex justify-between gap-2"><span className="truncate">{c.categoria}</span><span>{c.quantidade}</span></li>)}
              </ul>
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
            {p.transferencias.quantidade > 0 && <li>{p.transferencias.quantidade} transferência(s) entre contas ou empresas do grupo ({formatCurrency(Number(p.transferencias.total))}) não entram: não são receita nem despesa, como no extrato bancário.</li>}
            {p.repetidasPorCentro > 0 && <li>{p.repetidasPorCentro} linha(s) repetidas em outro centro de custo com o mesmo valor entram uma vez só, com os centros de custo juntos (sem dobrar o valor).</li>}
            {p.outrosArquivos.filter((a) => a.linhas > 0).map((a) => <li key={a.arquivo}>{ROTULO_ARQUIVO[a.arquivo] ?? a.arquivo}: {a.linhas} linha(s) — sem equivalente no BPO, não importado.</li>)}
            {p.arquivosAusentes.map((a) => <li key={a} className="text-amber-700">{a} não está no ZIP.</li>)}
          </ul>
          {p.totalErros > 0 && (
            <div role="alert" className="space-y-1 border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <p>{p.totalErros} linha(s) com problema não serão importadas:</p>
              <ul className="list-disc pl-5">{p.erros.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <button type="button" className="w-full bg-[var(--brand-yellow)] py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-dark)] disabled:opacity-50"
            disabled={importando || Boolean(nadaNovo)} onClick={importar}>
            {importando ? "Importando…" : nadaNovo ? "Nada novo para importar" : `Importar ${p.lancamentos.novos} lançamento(s) e ${p.clientesNovos} cliente(s)`}
          </button>
        </Modal>
      )}
    </>
  );
}

type Arquivados = PreviaContaAzul["lancamentos"]["arquivados"];

/**
 * Paridade 17/11 (EPIC-024 S-01 da Prospecta): lançamentos arquivados seguram a chave do Conta Azul e impedem a
 * reimportação. Só o admin chega a esta tela (prévia e importação já exigem o perfil admin, e o servidor confere de
 * novo); remove em definitivo os sem vínculo (com cópia no servidor) depois de digitar LIBERAR; os com vínculo ficam.
 */
function LiberarReimportacao({ arquivos, arquivados, onMensagem, onLiberado }: {
  arquivos: Record<string, string>; arquivados: Arquivados; onMensagem: (m: string) => void; onLiberado: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState("");
  const [liberando, iniciar] = useTransition();
  function liberar() {
    iniciar(async () => {
      try {
        const r = exigirResultado(await liberarReimportacaoContaAzulAcao({ arquivos, confirmacao: texto }));
        onMensagem(`${r.removidos} lançamento(s) arquivado(s) removido(s) em definitivo (cópia guardada)${r.mantidos ? `; ${r.mantidos} mantido(s) (vínculo ou outra origem)` : ""}.`);
        setConfirmando(false);
        setTexto("");
        onLiberado();
      } catch (e) { onMensagem(e instanceof Error ? e.message : "Falha ao liberar a reimportação."); }
    });
  }
  return (
    <div role="alert" className="space-y-2 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-bold">{arquivados.bloqueando} lançamento(s) deste backup estão ARQUIVADOS no BPO e bloqueiam a reimportação.</p>
      <p>Arquivado não aparece nas listas nem nos totais, mas continua segurando a chave da linha do Conta Azul: enquanto existir,
        a mesma linha não entra de novo. Para importar de novo, é preciso removê-los em definitivo.</p>
      <ul className="list-disc pl-5">
        <li>{arquivados.liberaveis} sem vínculo nenhum — podem ser removidos (uma cópia de cada um fica guardada no servidor).</li>
        {arquivados.comVinculo > 0 && <li>{arquivados.comVinculo} com vínculo (banco, Asaas, baixa, obra, regularização ou combinação) — ficam como estão e não entram.</li>}
        {arquivados.outraOrigem > 0 && <li>{arquivados.outraOrigem} de outra origem (legado, Asaas, manual…) com a chave do Conta Azul — nunca são removidos por aqui.</li>}
      </ul>
      {arquivados.exemplosComVinculo.length > 0 && (
        <ul className="pl-5 text-amber-800">
          {arquivados.exemplosComVinculo.map((a) => <li key={a.id}>{a.descricao} ({formatCurrency(Number(a.valor))}): {a.motivos.join("; ")}</li>)}
        </ul>
      )}
      {arquivados.liberaveis > 0 && (!confirmando
        ? <button type="button" onClick={() => setConfirmando(true)} className="border border-amber-400 px-3 py-1.5 font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-100">Liberar reimportação</button>
        : (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); liberar(); }}>
            <label className="block" htmlFor="confirmar-liberar">
              Isto remove em definitivo {arquivados.liberaveis} lançamento(s) arquivado(s) do Conta Azul. Ativos e outras origens não são tocados.
              Digite <b>{CONFIRMACAO_LIBERAR_REIMPORTACAO}</b> para confirmar:
            </label>
            <input id="confirmar-liberar" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)}
              className="w-full border border-amber-300 bg-white px-2 py-1.5 text-sm text-gray-900" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!confirmacaoLiberarValida(texto) || liberando}
                className="bg-amber-500 px-3 py-1.5 font-bold uppercase tracking-wider text-white disabled:opacity-50">
                {liberando ? "Removendo…" : `Remover ${arquivados.liberaveis} em definitivo`}
              </button>
              <button type="button" disabled={liberando} onClick={() => { setConfirmando(false); setTexto(""); }} className="px-3 py-1.5 text-gray-600">Cancelar</button>
            </div>
          </form>
        ))}
    </div>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="min-w-0 border border-gray-100 bg-gray-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="break-words text-lg font-bold text-[var(--brand-dark)]">{valor}</p>
      <p className="text-xs text-gray-500">{detalhe}</p>
    </div>
  );
}
