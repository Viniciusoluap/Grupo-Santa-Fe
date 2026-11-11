import { z } from "zod";

const identificador = z.string().uuid();
const tarefa = z.object({ id: identificador, titulo: z.string().trim().min(1).max(300), concluida: z.boolean() }).strict();
const documento = z.object({ id: identificador, nome: z.string().trim().min(1).max(300), obtido: z.boolean() }).strict();
const etapa = z.object({
  id: identificador,
  nome: z.string().trim().min(1).max(180),
  procedimentos: z.string().max(12_000),
  observacoes: z.string().max(12_000),
  tarefas: z.array(tarefa),
  documentos: z.array(documento),
}).strict();

export const dueDiligenceSchema = z.object({ versao: z.number().int().nonnegative(), etapas: z.array(etapa) }).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  for (const stage of value.etapas) {
    for (const item of [stage, ...stage.tarefas, ...stage.documentos]) {
      if (ids.has(item.id)) context.addIssue({ code: "custom", message: "IDs duplicados na Due Diligence" });
      ids.add(item.id);
    }
  }
});

export type DueDiligence = z.infer<typeof dueDiligenceSchema>;
export function lerDueDiligence(json: string | null | undefined): DueDiligence {
  if (!json) return { versao: 0, etapas: [] };
  return dueDiligenceSchema.parse(JSON.parse(json));
}

export function progressoDueDiligence(value: DueDiligence) {
  const itens = value.etapas.flatMap((e) => [...e.tarefas.map((t) => t.concluida), ...e.documentos.map((d) => d.obtido)]);
  const concluidos = itens.filter(Boolean).length;
  return { total: itens.length, concluidos, percentual: itens.length ? Math.round(concluidos * 100 / itens.length) : 0 };
}

/** Move o item de `index` para `index + offset` (etapas, tarefas e documentos). Fora dos limites, nada muda. */
export function moverItem<T>(lista: T[], index: number, offset: number): T[] {
  const alvo = index + offset;
  if (index < 0 || index >= lista.length || alvo < 0 || alvo >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(index, 1);
  nova.splice(alvo, 0, item);
  return nova;
}
