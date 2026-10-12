import { describe, expect, it } from "vitest";
import { dueDiligenceSchema, progressoDueDiligence } from "@/lib/incorporacao/due-diligence";

const etapaId = "b49cc8b0-a080-4bd7-9406-4b7fb9ef4651";
const tarefaId = "d1a3195e-a061-4d4f-8b93-b3000c460480";
const docId = "e6717244-650e-4515-9803-f9620ec17752";

describe("Due Diligence", () => {
  it("calcula progresso pelos itens concluídos e preserva a ordem das etapas", () => {
    const registro = dueDiligenceSchema.parse({ versao: 3, etapas: [
      { id: etapaId, nome: "Viabilidade", procedimentos: "", observacoes: "", tarefas: [{ id: tarefaId, titulo: "Consultar cartório", concluida: true }], documentos: [{ id: docId, nome: "Matrícula", obtido: false }] },
    ] });
    expect(registro.etapas[0].nome).toBe("Viabilidade");
    expect(progressoDueDiligence(registro)).toEqual({ total: 2, concluidos: 1, percentual: 50 });
  });
  it("bloqueia identificadores repetidos que poderiam associar arquivos à etapa errada", () => {
    const duplicado = { versao: 0, etapas: [
      { id: etapaId, nome: "Primeira", procedimentos: "", observacoes: "", tarefas: [], documentos: [] },
      { id: etapaId, nome: "Segunda", procedimentos: "", observacoes: "", tarefas: [], documentos: [] },
    ] };
    expect(dueDiligenceSchema.safeParse(duplicado).success).toBe(false);
  });
});
