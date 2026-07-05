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
