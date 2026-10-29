"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, CloudUpload, FolderSync, HardDrive, Link2, Loader2, Unplug } from "lucide-react";
import { exigirResultado } from "@/lib/acao-resultado";
import { desconectarGoogleDrive, organizarDriveAgora, salvarCredencialGoogleDrive, statusGoogleDrive } from "@/lib/actions/google-drive";
import type { RelatorioDrive } from "@/lib/drive-organizacao";
import { testarGoogleDrive } from "@/lib/actions/documentos-registro";

type Status = Awaited<ReturnType<typeof import("@/lib/google-drive-conexao").estadoOAuth>>;
type Teste = Exclude<Awaited<ReturnType<typeof testarGoogleDrive>>, { erroAcao: string }>;

/**
 * Configurações → Google Drive: o dono envia o JSON do cliente OAuth ("Aplicativo
 * da Web") e conecta a própria conta Google. Mesmo cartão da Prospecta.
 */
type Mensagem = { tipo: "ok" | "erro" | "aviso"; texto: string };

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function GoogleDriveCard({ retorno, inicial, relatorioInicial }: { retorno: Mensagem | null; inicial: Status; relatorioInicial: RelatorioDrive | null }) {
  const [status, setStatus] = useState<Status | null>(inicial);
  const [msg, setMsg] = useState<Mensagem | null>(retorno);
  const [pendente, setPendente] = useState<"json" | "teste" | "desconectar" | "organizar" | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDrive | null>(relatorioInicial);
  const [teste, setTeste] = useState<Teste | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  async function recarregar() {
    try { setStatus(exigirResultado(await statusGoogleDrive())); } catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao consultar." }); }
  }

  useEffect(() => {
    // O resultado da volta do Google já veio da página; tira ?drive=... da barra de endereço.
    if (window.location.search.includes("drive=")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function enviar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 20_000) { setMsg({ tipo: "erro", texto: "Arquivo grande demais para ser o JSON do cliente OAuth." }); return; }
    setPendente("json"); setMsg(null);
    try {
      const r = exigirResultado(await salvarCredencialGoogleDrive(await file.text()));
      setMsg(r.uriCadastrada ? { tipo: "ok", texto: "Credencial do Google salva. Agora clique em \"Conectar Google Drive\"." }
        : { tipo: "aviso", texto: `Credencial salva, mas o endereço ${r.callback} não está nos "URIs de redirecionamento autorizados" desse cliente no Google. Adicione-o antes de conectar.` });
      await recarregar();
    } catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao salvar." }); }
    finally { setPendente(null); }
  }

  async function testar() {
    setPendente("teste");
    try { setTeste(exigirResultado(await testarGoogleDrive())); } catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha no teste." }); }
    finally { setPendente(null); }
  }

  async function organizar() {
    setPendente("organizar"); setMsg(null);
    try { setRelatorio(exigirResultado(await organizarDriveAgora())); } catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao organizar o Drive." }); }
    finally { setPendente(null); }
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o Google Drive? Os novos arquivos voltam a ficar no banco do sistema.")) return;
    setPendente("desconectar");
    try { exigirResultado(await desconectarGoogleDrive()); setMsg({ tipo: "ok", texto: "Google Drive desconectado." }); await recarregar(); }
    catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao desconectar." }); }
    finally { setPendente(null); }
  }

  const botao = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  return (
    <section className="bg-white border border-gray-100 p-5 space-y-4" aria-label="Google Drive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><HardDrive size={20} className="text-[var(--brand-dark)]" /><div>
          <h2 className="font-black text-[var(--brand-dark)] uppercase tracking-wide text-sm">Google Drive</h2>
          <p className="text-xs text-gray-500">Documentos do sistema guardados no Google Drive da sua conta.</p>
        </div></div>
        {!status ? <Loader2 size={14} className="animate-spin text-gray-600" /> : status.conectado
          ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Conectado{status.email ? ` como ${status.email}` : ""}</span>
          : <span className="text-xs font-bold text-amber-700">{status.credencial ? "Credencial enviada — falta conectar" : "Não conectado (arquivos ficam no banco)"}</span>}
      </div>
      <ol className="space-y-3 text-sm">
        <li className="border border-gray-100 p-3"><p className="font-bold text-[var(--brand-dark)]">1. Envie o JSON do cliente OAuth</p>
          <p className="text-xs text-gray-500">Google Auth Platform → Clientes → cliente &quot;Aplicativo da Web&quot; → baixar JSON (começa com {"{\"web\":"}). O arquivo fica guardado criptografado e nunca é exibido.</p>
          <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void enviar(e)} />
          <button type="button" className={`${botao} mt-2`} disabled={pendente !== null} onClick={() => arquivo.current?.click()}>
            {pendente === "json" ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}{status?.credencial ? "Trocar JSON" : "Enviar JSON"}
          </button>
          {status && <p className="mt-2 break-all text-xs text-gray-500">URI de redirecionamento a cadastrar no Google: <code className="text-[var(--brand-dark)]">{status.callback}</code></p>}
        </li>
        <li className="border border-gray-100 p-3"><p className="font-bold text-[var(--brand-dark)]">2. Conecte a sua conta Google</p>
          <p className="text-xs text-gray-500">Você será levado ao Google para autorizar. O sistema só acessa os arquivos que ele mesmo criar.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!status?.credencial || pendente !== null} onClick={() => { window.location.href = "/api/google-drive/conectar"; }}
              className="inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-3 py-2 text-xs font-bold text-[var(--brand-yellow)] disabled:opacity-50">
              <Link2 size={12} />{status?.conectado ? "Reconectar" : "Conectar Google Drive"}
            </button>
            <button type="button" className={botao} disabled={pendente !== null} onClick={() => void testar()}>
              {pendente === "teste" && <Loader2 size={12} className="animate-spin" />}Testar Google Drive
            </button>
            {status?.conectado && <button type="button" className={botao} disabled={pendente !== null} onClick={() => void desconectar()}><Unplug size={12} /> Desconectar</button>}
          </div>
        </li>
        <li className="border border-gray-100 p-3"><p className="font-bold text-[var(--brand-dark)]">3. Organização do Drive</p>
          <p className="text-xs text-gray-500">Todo dia o sistema copia para o Drive o que ficou só no banco, coloca cada arquivo na pasta certa e manda para a lixeira (recuperável por 30 dias) as pastas de registros excluídos. Pastas criadas por você nunca são tocadas.</p>
          <button type="button" className={`${botao} mt-2`} disabled={!status?.conectado || pendente !== null} onClick={() => void organizar()}>
            {pendente === "organizar" ? <Loader2 size={12} className="animate-spin" /> : <FolderSync size={12} />}Organizar Drive agora
          </button>
          {relatorio && <div role="status" className="mt-2 text-xs text-gray-700">
            <p>Última organização: {dataHora(relatorio.terminadoEm || relatorio.iniciadoEm)} — {relatorio.enviados} arquivo(s) enviado(s), {relatorio.movidos} movido(s), {relatorio.pastasOrfas} pasta(s) de registros excluídos na lixeira{relatorio.falhas ? `, ${relatorio.falhas} falha(s) — será tentado de novo` : ""}.</p>
            {!relatorio.cicloConcluido && !relatorio.aviso && <p className="text-amber-800">Ainda há itens para organizar: continua na próxima rodada (clique de novo ou aguarde a rotina diária).</p>}
            {relatorio.aviso && <p className="text-amber-800">{relatorio.aviso}</p>}
          </div>}
        </li>
      </ol>
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-xs ${msg.tipo === "ok" ? "text-emerald-700" : msg.tipo === "aviso" ? "text-amber-800" : "text-red-700"}`}>{msg.texto}</p>}
      {teste && <div role="status" className={`border p-3 text-xs ${teste.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        <p>{teste.ok ? "Google Drive funcionando: os próximos arquivos serão gravados no Drive." : "Google Drive indisponível. Os arquivos continuam guardados com segurança no banco do sistema."}</p>
        {teste.etapas.length > 0 && <ul className="mt-1 list-disc pl-4">{teste.etapas.map((e) => <li key={e.etapa}>{e.etapa}: ok</li>)}</ul>}
        {teste.explicacao && <p className="mt-1">{teste.explicacao}</p>}
      </div>}
    </section>
  );
}
