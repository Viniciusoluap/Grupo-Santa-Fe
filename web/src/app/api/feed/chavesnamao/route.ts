import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { imovelToProperty } from "@/lib/data/properties";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gruposantafe.com.br";

function tipoCNM(tipo: string): string {
  const map: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    lote: "Terreno/Lote",
    terreno: "Terreno/Lote",
    comercial: "Comercial/Industrial",
    chacara: "Chácara/Sítio/Fazenda",
  };
  return map[tipo] ?? "Casa";
}

export async function GET() {
  const properties = await prisma.imovel
    .findMany({ where: { publicadoSite: true } })
    .then((list) => list.map(imovelToProperty));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<imoveis>
${properties
  .map(
    (p) => `  <imovel>
    <id>${p.id}</id>
    <tipo>${tipoCNM(p.type)}</tipo>
    <subtipo>${p.status === "locacao" ? "Aluguel" : "Venda"}</subtipo>
    <titulo><![CDATA[${p.title}]]></titulo>
    <descricao><![CDATA[${p.description}]]></descricao>
    <preco>${p.price}</preco>${p.condominium != null ? `\n    <condominio>${p.condominium}</condominio>` : ""}${p.iptu != null ? `\n    <iptu>${p.iptu}</iptu>` : ""}
    <area_util>${p.area}</area_util>${p.areaTotal != null ? `\n    <area_total>${p.areaTotal}</area_total>` : ""}${p.bedrooms != null ? `\n    <dormitorios>${p.bedrooms}</dormitorios>` : ""}${p.suites != null ? `\n    <suites>${p.suites}</suites>` : ""}${p.bathrooms != null ? `\n    <banheiros>${p.bathrooms}</banheiros>` : ""}${p.parking != null ? `\n    <vagas>${p.parking}</vagas>` : ""}
    <cep>${p.address.street ?? ""}</cep>
    <logradouro><![CDATA[${p.address.street}]]></logradouro>
    <bairro><![CDATA[${p.address.neighborhood}]]></bairro>
    <cidade><![CDATA[${p.address.city}]]></cidade>
    <estado>${p.address.state}</estado>
    <url>${SITE_URL}/imoveis/${p.id}</url>
    <fotos>
${p.images.length > 0 ? p.images.map((img) => `      <foto><![CDATA[${img}]]></foto>`).join("\n") : `      <foto><![CDATA[${SITE_URL}/og-image.jpg]]></foto>`}
    </fotos>
  </imovel>`
  )
  .join("\n")}
</imoveis>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
