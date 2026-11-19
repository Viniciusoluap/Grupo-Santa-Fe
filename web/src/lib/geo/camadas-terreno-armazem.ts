// Paridade 17/11 (bloco 2) — Prospecta EPIC-023 S-E (`server/_core/geo/camadas-terreno-armazem.ts`): guarda no banco
// o último resultado bom de cada camada do mapa do terreno (tabela camadas_terreno_cache, migração
// 20261117210000). Se a tabela ainda não existir ou o banco falhar, a busca segue normalmente sem persistência —
// o mapa nunca deixa de responder por causa disto.
import { prisma } from "@/lib/db";
import type { EstadoCamada, IdCamada } from "./camadas-terreno";
import type { ArmazemCamadas } from "./camadas-terreno-busca";

/** Tabela ainda não criada (migração não aplicada): não insiste até o processo reiniciar. */
let tabelaAusente = false;

function registrarFalha(acao: string, e: unknown) {
  const codigo = (e as { code?: string } | null)?.code ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
  const texto = e instanceof Error ? e.message : String(e);
  // P2021 = tabela não existe (Prisma); 42P01 = relation does not exist (Postgres)
  if (codigo === "P2021" || codigo === "42P01" || /camadas_terreno_cache.*does not exist|relation .* does not exist/i.test(texto)) {
    if (!tabelaAusente) console.warn("[camadas-terreno] tabela camadas_terreno_cache ausente — seguindo sem persistência (aplicar a migração 20261117210000).");
    tabelaAusente = true;
    return;
  }
  console.warn(`[camadas-terreno] falha ao ${acao} o último resultado bom:`, texto);
}

/** Só para testes: volta a tentar a tabela. */
export function _reiniciarArmazemCamadas() { tabelaAusente = false; }

export const armazemCamadasBanco: ArmazemCamadas = {
  async ler(chave: string, camada: IdCamada) {
    if (tabelaAusente) return null;
    try {
      const linha = await prisma.camadaTerrenoCache.findUnique({ where: { chaveTerreno_camada: { chaveTerreno: chave, camada } } });
      if (!linha) return null;
      return { valor: JSON.parse(linha.dados) as EstadoCamada<unknown>, salvoEm: new Date(linha.salvoEm) };
    } catch (e) {
      registrarFalha("ler", e);
      return null;
    }
  },
  async gravar(chave: string, camada: IdCamada, valor: EstadoCamada<unknown>) {
    if (tabelaAusente || (valor.estado !== "ok" && valor.estado !== "vazio")) return;
    try {
      const dados = { estado: valor.estado, fonte: valor.fonte, dados: JSON.stringify(valor) };
      await prisma.camadaTerrenoCache.upsert({
        where: { chaveTerreno_camada: { chaveTerreno: chave, camada } },
        create: { chaveTerreno: chave, camada, ...dados },
        update: { ...dados, salvoEm: new Date() },
      });
    } catch (e) {
      registrarFalha("gravar", e);
    }
  },
};
