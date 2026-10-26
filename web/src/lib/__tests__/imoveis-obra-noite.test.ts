import { describe, expect, it } from "vitest";
import { cidadeEstadoDoEndereco, imovelDaObra, localizacaoImovel } from "@/lib/obra-localizacao";

describe("imóveis gerados de obra", () => {
  it("deduz cidade e UF apenas quando o final do endereço contém um estado", () => {
    expect(cidadeEstadoDoEndereco("Residencial Aurora, Imperatriz Maranhão")).toEqual({ cidade: "Imperatriz", estado: "MA" });
    expect(cidadeEstadoDoEndereco("Rua A, Canaã dos Carajás/PA")).toEqual({ cidade: "Canaã dos Carajás", estado: "PA" });
    expect(cidadeEstadoDoEndereco("Rua A, Vila Maranhão")).toBeNull();
  });

  it("leva endereço/cidade para o imóvel e mostra localização completa", () => {
    expect(imovelDaObra({ id: 1, titulo: "A", endereco: "Residencial Aurora, Imperatriz Maranhão", cidade: null, estado: null })).toMatchObject({ endereco: "Residencial Aurora, Imperatriz Maranhão", cidade: "Imperatriz", estado: "MA" });
    expect(localizacaoImovel({ rua: "Residencial Aurora, Imperatriz Maranhão", bairro: "", cidade: "Imperatriz", estado: "MA" })).toBe("Residencial Aurora, Imperatriz Maranhão");
    expect(localizacaoImovel({ rua: null, cidade: "Não informada" })).toBe("Não informada");
  });
});
