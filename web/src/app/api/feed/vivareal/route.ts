import { NextResponse } from "next/server";
import { properties } from "@/lib/data/properties";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gruposantafe.com.br";

function typeToVR(type: string): string {
  const map: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    lote: "Terreno / Lote",
    terreno: "Terreno / Lote",
    comercial: "Sala Comercial",
    chacara: "Sítio / Chácara",
  };
  return map[type] ?? "Casa";
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Listings>
${properties
  .map(
    (p) => `    <Listing>
      <ListingID>VR-${p.id}</ListingID>
      <Title><![CDATA[${p.title}]]></Title>
      <TransactionType>${p.status === "locacao" ? "For Rent" : "For Sale"}</TransactionType>
      <ListingType>Standard</ListingType>
      <Category>Residential</Category>
      <PropertyType>${typeToVR(p.type)}</PropertyType>
      <OwnerListingID>${p.slug}</OwnerListingID>
      <Address>
        <Country>BR</Country>
        <State>${p.address.state}</State>
        <City>${p.address.city}</City>
        <Neighborhood>${p.address.neighborhood}</Neighborhood>
        <StreetName><![CDATA[${p.address.street}]]></StreetName>
      </Address>
      <ContactInfo>
        <Name>Grupo Santa Fé</Name>
        <Telephone>62 9 9999-9999</Telephone>
        <Email>contato@gruposantafe.com.br</Email>
        <Website>${SITE_URL}</Website>
      </ContactInfo>
      <Details>
        <PropertyDetails>
          <LivingArea unit="square metres">${p.area}</LivingArea>${p.areaTotal ? `\n          <LotArea unit="square metres">${p.areaTotal}</LotArea>` : ""}${p.bedrooms != null ? `\n          <Bedrooms>${p.bedrooms}</Bedrooms>` : ""}${p.suites != null ? `\n          <Suites>${p.suites}</Suites>` : ""}${p.bathrooms != null ? `\n          <Bathrooms>${p.bathrooms}</Bathrooms>` : ""}${p.parking != null ? `\n          <Parking>${p.parking}</Parking>` : ""}
        </PropertyDetails>
      </Details>
      <ListPrice currency="BRL">${p.price}</ListPrice>${p.condominium != null ? `\n      <CondoFee currency="BRL">${p.condominium}</CondoFee>` : ""}${p.iptu != null ? `\n      <PropertyTax currency="BRL">${p.iptu}</PropertyTax>` : ""}
      <Description><![CDATA[${p.description}]]></Description>
      <PropertyURL>${SITE_URL}/imoveis/${p.slug}</PropertyURL>
      <Media>
${p.images.length > 0 ? p.images.map((img) => `        <Item medium="image"><![CDATA[${img}]]></Item>`).join("\n") : `        <Item medium="image"><![CDATA[${SITE_URL}/og-image.jpg]]></Item>`}
      </Media>
      <DatePosted>${p.createdAt}T00:00:00</DatePosted>
      <LastUpdated>${p.createdAt}T00:00:00</LastUpdated>
    </Listing>`
  )
  .join("\n")}
  </Listings>
</ListingDataFeed>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
