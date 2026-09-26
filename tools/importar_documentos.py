#!/usr/bin/env python3
"""Convert locally staged documents to private Markdown using MarkItDown."""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
ENTRADA = ROOT / "documentos" / "entrada"
SAIDA = ROOT / "conhecimento"
ESTADO = SAIDA / ".importacao.json"
INDICE = ROOT / "_indice_documentos.local.md"
EXTENSOES = {".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".html", ".htm"}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(1024 * 1024), b""):
            digest.update(bloco)
    return digest.hexdigest()


def salvar_atomicamente(path, conteudo):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporario = path.with_name(path.name + ".tmp")
    try:
        temporario.write_text(conteudo, encoding="utf-8")
        os.replace(temporario, path)
    finally:
        temporario.unlink(missing_ok=True)


def carregar_estado():
    if not ESTADO.exists():
        return {}
    dados = json.loads(ESTADO.read_text(encoding="utf-8"))
    if not isinstance(dados, dict):
        raise ValueError("Estado de importação inválido")
    return dados


def gerar_indice(estado):
    linhas = ["# Índice local dos documentos", "", "Gerado automaticamente. Não enviar ao Git.", ""]
    for origem in sorted(estado, key=str.casefold):
        destino = ROOT / estado[origem]["destino"]
        if destino.is_file():
            categoria = Path(origem).parent.as_posix()
            nome = Path(origem).name.replace("[", "\\[").replace("]", "\\]")
            linhas.append(
                f"- **{categoria if categoria != '.' else 'geral'}**: "
                f"[{nome}]"
                f"(<{quote(destino.relative_to(ROOT).as_posix(), safe='/')}>)"
            )
    salvar_atomicamente(INDICE, "\n".join(linhas) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Importa documentos locais com Microsoft MarkItDown")
    parser.add_argument("--force", action="store_true", help="reconverte arquivos e sobrescreve edições locais")
    args = parser.parse_args()

    try:
        from markitdown import MarkItDown
    except ImportError:
        print("MarkItDown ausente. Instale: python -m pip install -r requirements-tools.txt", file=sys.stderr)
        return 2

    ENTRADA.mkdir(parents=True, exist_ok=True)
    SAIDA.mkdir(parents=True, exist_ok=True)
    try:
        estado = carregar_estado()
    except (OSError, ValueError) as erro:
        print(f"Falha ao ler estado: {erro}", file=sys.stderr)
        return 2

    conversor = MarkItDown(enable_plugins=False)
    importados = ignorados = falhas = 0
    for origem in sorted(ENTRADA.rglob("*")):
        if not origem.is_file() or origem.suffix.lower() not in EXTENSOES:
            continue
        relativo = origem.relative_to(ENTRADA)
        if any(parte.startswith(".") or parte.startswith("~$") for parte in relativo.parts):
            continue
        if origem.is_symlink() or not origem.resolve().is_relative_to(ENTRADA.resolve()):
            print(f"Ignorado caminho fora da entrada: {relativo}", file=sys.stderr)
            falhas += 1
            continue

        chave = relativo.as_posix()
        destino = SAIDA / relativo.parent / (relativo.name + ".md")
        anterior = estado.get(chave, {})
        try:
            atual = sha256(origem)
            if destino.exists() and not args.force:
                if anterior.get("destino") != destino.relative_to(ROOT).as_posix():
                    print(f"Conflito no destino, use outro nome: {destino}", file=sys.stderr)
                    falhas += 1
                    continue
                if sha256(destino) != anterior.get("saida_sha256"):
                    print(f"Markdown editado manualmente, preservado: {destino}", file=sys.stderr)
                    falhas += 1
                    continue
                if atual == anterior.get("origem_sha256"):
                    ignorados += 1
                    continue

            resultado = conversor.convert(str(origem))
            markdown = resultado.markdown
            if not markdown or not markdown.strip():
                raise ValueError("conversão sem texto; o arquivo pode exigir OCR")
            salvar_atomicamente(destino, markdown.rstrip() + "\n")
            estado[chave] = {
                "destino": destino.relative_to(ROOT).as_posix(),
                "origem_sha256": atual,
                "saida_sha256": sha256(destino),
            }
            salvar_atomicamente(ESTADO, json.dumps(estado, ensure_ascii=False, indent=2) + "\n")
            print(f"Importado: {relativo} -> {destino.relative_to(ROOT)}")
            importados += 1
        except Exception as erro:
            print(f"Falha em {relativo}: {erro}", file=sys.stderr)
            falhas += 1

    gerar_indice(estado)
    print(f"Concluído: {importados} importados, {ignorados} sem alteração, {falhas} falhas.")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
