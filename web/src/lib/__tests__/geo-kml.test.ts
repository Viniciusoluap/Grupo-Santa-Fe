import { describe, it, expect } from "vitest";
import { parseKmlTerreno, terrenoDeAnel } from "@/lib/geo/kml";

// Um quadrado de ~0,001° em Canaã dos Carajás (~111m x ~110m ≈ 1,2 ha).
// Coordenadas em [lng, lat].
const anelQuadrado: [number, number][] = [
  [-49.8790, -6.5000],
  [-49.8780, -6.5000],
  [-49.8780, -6.4990],
  [-49.8790, -6.4990],
  [-49.8790, -6.5000],
];

const KML_QUADRADO = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Gleba Teste</name>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>
        -49.8790,-6.5000,0 -49.8780,-6.5000,0 -49.8780,-6.4990,0 -49.8790,-6.4990,0 -49.8790,-6.5000,0
      </coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
  </Document>
</kml>`;

describe("terrenoDeAnel", () => {
  it("calcula área plausível para o quadrado (~1,2 ha, entre 1 e 1,4 ha)", () => {
    const t = terrenoDeAnel(anelQuadrado);
    expect(t.areaM2).toBeGreaterThan(10_000);
    expect(t.areaM2).toBeLessThan(14_000);
  });
  it("perímetro plausível (~440 m, entre 400 e 470)", () => {
    const t = terrenoDeAnel(anelQuadrado);
    expect(t.perimetroM).toBeGreaterThan(400);
    expect(t.perimetroM).toBeLessThan(470);
  });
  it("centróide fica dentro do bounding box", () => {
    const t = terrenoDeAnel(anelQuadrado);
    expect(t.centro[0]).toBeGreaterThan(-49.8790);
    expect(t.centro[0]).toBeLessThan(-49.8780);
    expect(t.centro[1]).toBeGreaterThan(-6.5000);
    expect(t.centro[1]).toBeLessThan(-6.4990);
  });
  it("fecha o anel automaticamente quando aberto", () => {
    const aberto = anelQuadrado.slice(0, 4);
    const t = terrenoDeAnel(aberto);
    const first = t.anel[0];
    const last = t.anel[t.anel.length - 1];
    expect(first).toEqual(last);
  });
  it("lança erro com menos de 3 vértices", () => {
    expect(() => terrenoDeAnel([[-49.87, -6.5], [-49.88, -6.5]])).toThrow();
  });
});

describe("parseKmlTerreno", () => {
  it("extrai o polígono e calcula métricas do KML", () => {
    const t = parseKmlTerreno(KML_QUADRADO);
    expect(t.areaM2).toBeGreaterThan(10_000);
    expect(t.areaM2).toBeLessThan(14_000);
    expect(t.anel.length).toBeGreaterThanOrEqual(4);
  });
  it("lança erro quando o KML não tem polígono", () => {
    const kmlSemPoligono = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Point><coordinates>-49.87,-6.5,0</coordinates></Point></Placemark></Document></kml>`;
    expect(() => parseKmlTerreno(kmlSemPoligono)).toThrow();
  });

  it("extrai polígono de um KML estilo Google Earth (Document > Folder, tessellate, altitude, quebras de linha)", () => {
    const kmlGoogleEarth = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>Gleba.kml</name>
    <Folder>
      <name>Terrenos</name>
      <Placemark>
        <name>Gleba 1</name>
        <styleUrl>#poly</styleUrl>
        <Polygon>
          <tessellate>1</tessellate>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                -49.8790,-6.5000,0
                -49.8780,-6.5000,0
                -49.8780,-6.4990,0
                -49.8790,-6.4990,0
                -49.8790,-6.5000,0
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;
    const t = parseKmlTerreno(kmlGoogleEarth);
    expect(t.areaM2).toBeGreaterThan(10_000);
    expect(t.areaM2).toBeLessThan(14_000);
    expect(t.centro[1]).toBeLessThan(-6.498);
  });
});

// ─── Paridade 17/11 (Prospecta 355f3aa / EPIC-023 S-F R6): KML com várias áreas separadas e furos ───────────
const KML_QUADRADO_PROSPECTA = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Terreno</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
  -47.500000,-5.520000,0 -47.499000,-5.520000,0 -47.499000,-5.519000,0 -47.500000,-5.519000,0 -47.500000,-5.520000,0
</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;

function retangulo(oeste: number, leste: number) {
  return `<Polygon><outerBoundaryIs><LinearRing><coordinates>
    ${oeste},-5.52 ${leste},-5.52 ${leste},-5.519 ${oeste},-5.519 ${oeste},-5.52
  </coordinates></LinearRing></outerBoundaryIs></Polygon>`;
}

function documentoKml(conteudo: string) {
  return `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${conteudo}</Document></kml>`;
}

describe("parseKmlTerreno — várias áreas e furos (Prospecta)", () => {
  it("extrai polígono, área, perímetro e centro de um KML válido", () => {
    const resultado = parseKmlTerreno(KML_QUADRADO_PROSPECTA);
    expect(resultado.feature.geometry.type).toBe("Polygon");
    expect(resultado.areaM2).toBeGreaterThan(0);
    expect(resultado.perimetroM).toBeGreaterThan(0);
    expect(resultado.centro[0]).toBeCloseTo(-47.4995, 2);
    expect(resultado.centro[1]).toBeCloseTo(-5.5195, 2);
  });

  it("importa polígonos de pastas e MultiGeometry, incluindo geometrias mistas", () => {
    const primeiro = retangulo(-47.50, -47.499);
    const segundo = retangulo(-47.49, -47.489);
    const terceiro = retangulo(-47.48, -47.479);
    const resultado = parseKmlTerreno(documentoKml(`
      <Folder><Placemark>${primeiro}</Placemark></Folder>
      <Placemark><MultiGeometry>
        ${segundo}${terceiro}<Point><coordinates>-47.47,-5.52</coordinates></Point>
      </MultiGeometry></Placemark>`));
    const unico = parseKmlTerreno(documentoKml(`<Placemark>${primeiro}</Placemark>`));

    expect(resultado.feature.geometry.type).toBe("MultiPolygon");
    expect(resultado.feature.geometry.coordinates).toHaveLength(3);
    expect(Math.abs(resultado.areaM2 - 3 * unico.areaM2)).toBeLessThanOrEqual(2);
    expect(Math.abs(resultado.perimetroM - 3 * unico.perimetroM)).toBeLessThanOrEqual(2);
    expect(resultado.centro[0]).toBeCloseTo(-47.4895, 6);
    expect(resultado.centro[1]).toBeCloseTo(-5.5195, 6);
  });

  it("preserva os desenhos e calcula a área e perímetro sem duplicar a sobreposição", () => {
    const resultado = parseKmlTerreno(documentoKml(`
      <Placemark>${retangulo(-47.50, -47.498)}</Placemark>
      <Placemark>${retangulo(-47.499, -47.497)}</Placemark>`));
    const contorno = parseKmlTerreno(documentoKml(`<Placemark>${retangulo(-47.50, -47.497)}</Placemark>`));

    expect(resultado.feature.geometry.type).toBe("MultiPolygon");
    expect(resultado.feature.geometry.coordinates).toHaveLength(2);
    expect(resultado.areaM2).toBe(contorno.areaM2);
    expect(resultado.perimetroM).toBe(contorno.perimetroM);
    expect(resultado.centro[0]).toBeCloseTo(-47.4985, 6);
  });

  it("lança erro quando o KML não contém nenhum polígono", () => {
    const kmlSemPoligono = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Ponto</name>
      <Point><coordinates>-47.5,-5.52,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;
    expect(() => parseKmlTerreno(kmlSemPoligono)).toThrow(/Nenhum polígono/);
  });

  it("lança erro para XML inválido/vazio", () => {
    expect(() => parseKmlTerreno("")).toThrow();
  });
});

describe("parseKmlTerreno — furos e estudos já salvos", () => {
  it("mantém o furo (innerBoundaryIs) e desconta a área dele", () => {
    const furo = `<Polygon><outerBoundaryIs><LinearRing><coordinates>
      -47.50,-5.52 -47.498,-5.52 -47.498,-5.518 -47.50,-5.518 -47.50,-5.52
    </coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>
      -47.4995,-5.5195 -47.4985,-5.5195 -47.4985,-5.5185 -47.4995,-5.5185 -47.4995,-5.5195
    </coordinates></LinearRing></innerBoundaryIs></Polygon>`;
    const r = parseKmlTerreno(documentoKml(`<Placemark>${furo}</Placemark>`));
    expect(r.feature.geometry.type).toBe("Polygon");
    expect(r.feature.geometry.type === "Polygon" && r.feature.geometry.coordinates.length).toBe(2);
    const cheio = parseKmlTerreno(documentoKml(`<Placemark>${retangulo(-47.50, -47.498).replace(/-5\.519/g, "-5.518")}</Placemark>`));
    expect(r.areaM2).toBeLessThan(cheio.areaM2);
  });
});
