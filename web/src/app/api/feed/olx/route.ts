import { NextResponse } from "next/server";
import { properties } from "@/lib/data/properties";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gruposantafe.com.br";

// OLX category codes for real estate
function categoryCode(type: string, status: string): string {
  if (status === "locacao") return "2040"; // Aluguel de imóveis
  const map: Record<string, string> = {
    casa: "2020",
    apartamento: "2030",
    lote: "2060",
    terreno: "2060",
    comercial: "2080",
    chacara: "2070",
  };
  return map[type] ?? "2020";
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<adverts>
${properties
  .map(
    (p) => `  <advert>
    <id><![CDATA[GSF-${p.id}]]></id>
    <url>${SITE_URL}/imoveis/${p.slug}</url>
    <title><![CDATA[${p.title}]]></title>
    <body><![CDATA[${p.description}]]></body>
    <category>${categoryCode(p.type, p.status)}</category>
    <price>${p.price}</price>
    <price_type>fixed</price_type>
    <currency>BRL</currency>
    <images>
${p.images.length > 0 ? p.images.map((img) => `      <image><![CDATA[${img}]]></image>`).join("\n") : `      <image><![CDATA[${SITE_URL}/og-image.jpg]]></image>`}
    </images>
    <params>
${p.bedrooms != null ? `      <param name="rooms">${p.bedrooms}</param>` : ""}
${p.bathrooms != null ? `      <param name="bathrooms">${p.bathrooms}</param>` : ""}
${p.parking != null ? `      <param name="garage_spaces">${p.parking}</param>` : ""}
      <param name="size">${p.area}</param>
${p.condominium != null ? `      <param name="condo_price">${p.condominium}</param>` : ""}
    </params>
    <locations>
      <location>
        <country name="Brasil">BR</country>
        <region name="Goiás">GO</region>
        <city name="${p.address.city}">${p.address.city}</city>
        <suburb name="${p.address.neighborhood}">${p.address.neighborhood}</suburb>
        <street><![CDATA[${p.address.street}]]></street>
      </location>
    </locations>
    <contact>
      <name><![CDATA[Grupo Santa Fé]]></name>
      <phone>62999999999</phone>
    </contact>
    <date_created>${p.createdAt}T00:00:00-03:00</date_created>
  </advert>`
  )
  .join("\n")}
</adverts>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
