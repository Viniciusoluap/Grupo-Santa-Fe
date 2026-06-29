import { describe, it, expect } from "vitest";
import { isSsrfUrl } from "@/lib/ssrf";

describe("isSsrfUrl — blocks private/internal addresses", () => {
  it("blocks localhost", () => {
    expect(isSsrfUrl("http://localhost/")).toBe(true);
  });
  it("blocks 127.0.0.1", () => {
    expect(isSsrfUrl("http://127.0.0.1/")).toBe(true);
  });
  it("blocks 127.x.x.x range", () => {
    expect(isSsrfUrl("http://127.100.0.1/")).toBe(true);
  });
  it("blocks 10.x.x.x", () => {
    expect(isSsrfUrl("http://10.0.0.1/")).toBe(true);
  });
  it("blocks 192.168.x.x", () => {
    expect(isSsrfUrl("http://192.168.1.1/")).toBe(true);
  });
  it("blocks 172.16.x.x (start of reserved range)", () => {
    expect(isSsrfUrl("http://172.16.0.1/")).toBe(true);
  });
  it("blocks 172.31.x.x (end of reserved range)", () => {
    expect(isSsrfUrl("http://172.31.255.255/")).toBe(true);
  });
  it("blocks 172.32.x.x NOT blocked (outside reserved range)", () => {
    expect(isSsrfUrl("http://172.32.0.1/")).toBe(false);
  });
  it("blocks IPv6 loopback ::1", () => {
    expect(isSsrfUrl("http://[::1]/")).toBe(true);
  });
  it("blocks link-local 169.254.x.x", () => {
    expect(isSsrfUrl("http://169.254.0.1/")).toBe(true);
  });
  it("blocks non-http protocol (ftp)", () => {
    expect(isSsrfUrl("ftp://example.com/")).toBe(true);
  });
  it("blocks file protocol", () => {
    expect(isSsrfUrl("file:///etc/passwd")).toBe(true);
  });
  it("blocks invalid URL", () => {
    expect(isSsrfUrl("not-a-url")).toBe(true);
  });
  it("blocks empty string", () => {
    expect(isSsrfUrl("")).toBe(true);
  });
});

describe("isSsrfUrl — allows valid public URLs", () => {
  it("allows public HTTP URL", () => {
    expect(isSsrfUrl("http://example.com/")).toBe(false);
  });
  it("allows public HTTPS URL", () => {
    expect(isSsrfUrl("https://example.com/path?q=1")).toBe(false);
  });
  it("allows real estate portal URL", () => {
    expect(isSsrfUrl("https://www.olx.com.br/imoveis")).toBe(false);
  });
  it("allows IP outside private ranges", () => {
    expect(isSsrfUrl("https://8.8.8.8/")).toBe(false);
  });
});
