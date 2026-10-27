import type { ResponsavelOpcao } from "@/lib/incorporacao/responsaveis";

// Correção 08: Responsável = seleção de usuário (Administrador, Colaborador ou
// Engenheiro), gravado por ID. Estudos antigos mostram o texto legado até que
// alguém escolha o usuário correspondente.
export function rotuloPapelResponsavel(u: Pick<ResponsavelOpcao, "papel" | "engenheiro" | "ativo">): string {
  const papel = u.engenheiro ? "Engenheiro" : u.papel === "admin" ? "Administrador" : "Colaborador";
  return u.ativo ? papel : `${papel} (inativo)`;
}

export function SeletorResponsavel({ opcoes, atualId, textoLegado }: { opcoes: ResponsavelOpcao[]; atualId?: string | null; textoLegado?: string | null }) {
  return (
    <div>
      <label htmlFor="responsavel-estudo" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Responsável</label>
      <select id="responsavel-estudo" name="responsavelId" defaultValue={atualId ?? ""}
        className="w-full text-sm border border-gray-200 px-3 py-2 bg-white text-[var(--brand-dark)] focus:outline-none focus:border-[var(--brand-yellow)]">
        <option value="">Sem responsável definido</option>
        {opcoes.map((u) => <option key={u.id} value={u.id}>{u.nome} — {rotuloPapelResponsavel(u)}</option>)}
      </select>
      {atualId !== undefined && <input type="hidden" name="responsavelIdAtual" value={atualId ?? ""} />}
      {!atualId && textoLegado && (
        <p className="text-[10px] text-gray-600 mt-1">Registrado antes como texto: “{textoLegado}”. Selecione o usuário correspondente.</p>
      )}
    </div>
  );
}
