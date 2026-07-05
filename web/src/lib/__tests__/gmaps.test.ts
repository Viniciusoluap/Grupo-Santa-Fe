import { describe, it, expect } from "vitest";
import { parseGoogleMapsLatLng } from "@/lib/geo/gmaps";

describe("parseGoogleMapsLatLng", () => {
  it("extrai de URL com @lat,lng", () => {
    const r = parseGoogleMapsLatLng("https://www.google.com/maps/@-6.5001,-49.8790,17z");
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.5001, 4);
    expect(r!.longitude).toBeCloseTo(-49.879, 4);
  });

  it("extrai de URL de place com @lat,lng no meio", () => {
    const r = parseGoogleMapsLatLng(
      "https://www.google.com/maps/place/Cana%C3%A3+dos+Caraj%C3%A1s/@-6.4979,-49.8781,15z/data=!3m1"
    );
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.4979, 4);
    expect(r!.longitude).toBeCloseTo(-49.8781, 4);
  });

  it("extrai de parâmetro q=", () => {
    const r = parseGoogleMapsLatLng("https://maps.google.com/?q=-6.5001,-49.8790");
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.5001, 4);
    expect(r!.longitude).toBeCloseTo(-49.879, 4);
  });

  it("extrai de parâmetro query= (api=1)", () => {
    const r = parseGoogleMapsLatLng(
      "https://www.google.com/maps/search/?api=1&query=-6.5,-49.87"
    );
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.5, 4);
    expect(r!.longitude).toBeCloseTo(-49.87, 4);
  });

  it("extrai de bang params !3d!4d", () => {
    const r = parseGoogleMapsLatLng(
      "https://www.google.com/maps/place/X/data=!3d-6.4979!4d-49.8781"
    );
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.4979, 4);
    expect(r!.longitude).toBeCloseTo(-49.8781, 4);
  });

  it("aceita par 'lat, lng' colado manualmente", () => {
    const r = parseGoogleMapsLatLng("-6.4979, -49.8790");
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.4979, 4);
    expect(r!.longitude).toBeCloseTo(-49.879, 4);
  });

  it("aceita par sem espaço", () => {
    const r = parseGoogleMapsLatLng("-6.4979,-49.8790");
    expect(r).not.toBeNull();
    expect(r!.latitude).toBeCloseTo(-6.4979, 4);
  });

  it("retorna null para URL encurtada (não contém coordenadas)", () => {
    expect(parseGoogleMapsLatLng("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseGoogleMapsLatLng("https://goo.gl/maps/xyz")).toBeNull();
  });

  it("retorna null para string vazia ou texto sem coordenadas", () => {
    expect(parseGoogleMapsLatLng("")).toBeNull();
    expect(parseGoogleMapsLatLng("Canaã dos Carajás, PA")).toBeNull();
  });

  it("retorna null para coordenadas fora de faixa", () => {
    expect(parseGoogleMapsLatLng("100, 200")).toBeNull();
    expect(parseGoogleMapsLatLng("-6.5, 500")).toBeNull();
  });
});
