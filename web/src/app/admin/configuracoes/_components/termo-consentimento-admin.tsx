"use client";
// Paridade 17/11 bloco 4 (gêmeo do diálogo "Termo de consentimento" de Prospecta/client/src/pages/admin/AdminConfiguracoes.tsx):
// consulta dos aceites por papel e por usuário, a retirada registrada e o botão para o admin registrar a retirada pedida
// pelo titular (e-mail ou telefone). Só leitura, fora a retirada — que é uma linha nova; nada é apagado.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TextoDoTermo } from "@/components/consentimento/texto-do-termo";
import { registrarRetiradaPeloAdmin } from "@/lib/actions/consentimento";

const PAPEL: Record<string, string> = { admin: "Administrador", colaborador: "Colaborador", corretor: "Corretor", cliente: "Cliente", empreiteiro: "Empreiteiro" };
const quando = (d: string | Date) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Belem" });

export type ResumoDoTermo = {
  versaoAtual: string;
  pedirNoLogin: boolean;
  porPapel: { papel: string; usuarios: number; aceitaramVersaoAtual: number; aceitaramVersaoAnterior: number; retirados: number; semAceite: number }[];
  porVersao: { versao: string; usuarios: number }[];
  usuarios: {
    id: string; nome: string; email: string; papel: string; versao: string | null; aceitoEm: string | Date | null; aceitouVersaoAtual: boolean;
    retirado: boolean; retiradoEm: string | Date | null; retiradoPorNome: string | null; retiradoPeloTitular: boolean;
  }[];
};

export function TermoConsentimentoAdmin({ resumo }: { resumo: ResumoDoTermo | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const comConsentimento = (resumo?.usuarios ?? []).filter(u => !u.retirado && u.aceitoEm);
  const alvo = comConsentimento.find(u => u.id === escolhido);
  return (
    <div className="bg-white border border-gray-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-[var(--brand-dark)] uppercase tracking-wide text-sm">Termo de consentimento</h2>
          <p className="text-xs text-gray-600 mt-0.5">Aceites por papel, retiradas e o texto vigente.</p>
        </div>
        <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-2 border border-[var(--brand-dark)]/30 px-3 py-2 text-sm font-bold text-[var(--brand-dark)] hover:bg-gray-50">
          <FileCheck2 size={16} /> Abrir
        </button>
      </div>
      {aberto && (
        <Modal titulo="Termo de consentimento" onFechar={() => setAberto(false)} tamanho="3xl">
          {!resumo ? <p className="text-sm text-gray-700">Não foi possível carregar os aceites (confira se a migração 20261117400000_consentimentos foi aplicada).</p> : <>
            <div className="space-y-1 bg-gray-50 p-3 text-sm text-gray-800">
              <p>Versão vigente: <strong>{resumo.versaoAtual}</strong></p>
              <p>Aceites por versão: {resumo.porVersao.length === 0 ? "nenhum ainda" : resumo.porVersao.map(v => `${v.versao} — ${v.usuarios} ${v.usuarios === 1 ? "usuário" : "usuários"}`).join(" · ")}</p>
              <p>Pedir o aceite no próximo login: <strong>{resumo.pedirNoLogin ? "ligado" : "desligado"}</strong> (quem já tinha senha não é perguntado enquanto estiver desligado).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Aceites por papel</caption>
                <thead><tr className="text-left text-xs uppercase text-gray-600"><th className="py-1 pr-2">Papel</th><th className="pr-2">Usuários</th><th className="pr-2">Versão vigente</th><th className="pr-2">Versão anterior</th><th className="pr-2">Retirados</th><th>Sem aceite</th></tr></thead>
                <tbody>{resumo.porPapel.map(p => <tr key={p.papel} className="border-t border-gray-100"><td className="py-1 pr-2">{PAPEL[p.papel] ?? p.papel}</td><td className="pr-2">{p.usuarios}</td><td className="pr-2">{p.aceitaramVersaoAtual}</td><td className="pr-2">{p.aceitaramVersaoAnterior}</td><td className="pr-2">{p.retirados}</td><td>{p.semAceite}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="space-y-2 border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-bold text-red-800">Registrar retirada do consentimento</p>
              <p className="text-xs text-gray-700">Use quando o titular pedir a retirada por e-mail ou telefone. Fica registrado quem registrou e quando; o usuário volta a ver o termo ao entrar.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Usuário que pediu a retirada" value={escolhido} onChange={e => setEscolhido(e.target.value)} className="min-w-[220px] flex-1 border border-gray-300 bg-white px-2 py-2 text-sm">
                  <option value="">Selecione o usuário</option>
                  {comConsentimento.map(u => <option key={u.id} value={u.id}>{u.nome} · {u.email}</option>)}
                </select>
                <button type="button" disabled={!alvo || pendente} className="bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  onClick={() => alvo && confirm(`Registrar a retirada do consentimento de ${alvo.nome}?`) && iniciar(async () => {
                    const r = await registrarRetiradaPeloAdmin(alvo.id);
                    setMensagem("error" in r ? r.error : "Retirada do consentimento registrada.");
                    setEscolhido("");
                    router.refresh();
                  })}>Registrar retirada</button>
              </div>
              {mensagem && <p role="status" className="text-sm text-gray-800">{mensagem}</p>}
            </div>
            <ul className="divide-y divide-gray-100 text-sm">
              {resumo.usuarios.map(u => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>{u.nome} <span className="text-xs text-gray-500">· {PAPEL[u.papel] ?? u.papel}</span></span>
                  <span className={`text-xs ${u.retirado ? "text-red-700" : u.aceitouVersaoAtual ? "text-green-700" : u.aceitoEm ? "text-amber-700" : "text-gray-500"}`}>
                    {u.retirado
                      ? `Retirado em ${u.retiradoEm ? quando(u.retiradoEm) : "—"} (registrado ${u.retiradoPeloTitular ? "pelo próprio usuário" : `por ${u.retiradoPorNome ?? "administrador"}`})`
                      : u.aceitoEm ? `Aceito em ${quando(u.aceitoEm)} · versão ${u.versao}${u.aceitouVersaoAtual ? "" : " (anterior)"}` : "Não aceito"}
                  </span>
                </li>
              ))}
            </ul>
            <TextoDoTermo />
          </>}
        </Modal>
      )}
    </div>
  );
}
