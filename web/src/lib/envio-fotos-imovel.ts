import { enviarFormComProgresso, publicarEnvio } from "@/lib/envio-progresso";

/** Separa dados leves e fotos para respeitar o limite de cada requisição. */
export function separarFotosDoImovel(dados: FormData, campo = "imagens") {
  const imagens = JSON.parse(String(dados.get(campo) ?? "[]")) as unknown;
  if (!Array.isArray(imagens) || imagens.some(v => typeof v !== "string")) throw new Error("Lista de fotos inválida.");
  const lista = imagens as string[];
  const novas = lista.filter(v => v.startsWith("data:"));
  dados.set(campo, JSON.stringify(lista.filter(v => !v.startsWith("data:"))));
  return { lista, novas };
}

export async function enviarImovelComFotos(dados: FormData, campo = "imagens") {
  const { lista, novas } = separarFotosDoImovel(dados, campo);
  const salvo = await enviarFormComProgresso<{ id: string }>("/api/imoveis/salvar", dados, { item: "cadastro" });
  const urls = new Map<string, string>();
  try {
    for (let i = 0; i < novas.length; i++) {
      const foto = new FormData();
      foto.set("imagem", novas[i]);
      let falha: unknown;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const resposta = await enviarFormComProgresso<{ url: string }>(`/api/imoveis/${salvo.id}/fotos`, foto, { item: "foto", atual: i + 1, total: novas.length });
          urls.set(novas[i], resposta.url);
          falha = null;
          break;
        } catch (erro) { falha = erro; }
      }
      if (falha) throw falha;
    }
    if (novas.length) {
      const ordem = new FormData();
      ordem.set("imagens", JSON.stringify(lista.map(v => urls.get(v) ?? v)));
      const resposta = await fetch(`/api/imoveis/${salvo.id}/fotos`, { method: "PUT", body: ordem });
      if (!resposta.ok) throw new Error("Fotos salvas, mas não foi possível ajustar a ordem. Reabra o imóvel para conferir.");
    }
    return salvo.id;
  } catch (erro) {
    throw new Error(`O cadastro foi salvo e ${urls.size} de ${novas.length} fotos novas foram enviadas. Reabra o imóvel para tentar as restantes. ${erro instanceof Error ? erro.message : ""}`);
  } finally {
    publicarEnvio(null);
  }
}
