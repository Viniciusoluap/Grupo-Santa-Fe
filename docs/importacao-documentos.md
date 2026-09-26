# Importação local de documentos

Requer Python 3.10 a 3.14. Instale uma vez na raiz do repositório:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements-tools.txt
```

No Windows, use `.venv\Scripts\python.exe` no lugar de `.venv/bin/python`.

Coloque os documentos em `documentos/entrada/`. Para classificá-los, use subpastas como
`contratos/`, `financeiro/`, `engenharia/` ou `clientes/`. A classificação acompanha as
subpastas sem inferir o assunto pelo conteúdo. Depois execute, na raiz:

```bash
.venv/bin/python tools/importar_documentos.py
```

O script aceita PDF, DOCX, XLS, XLSX, PPTX e HTML; cria Markdown em `conhecimento/`
preservando as subpastas, sem mover ou apagar os originais. Gera
`_indice_documentos.local.md` com links e pula arquivos que não mudaram. Se você editar
manualmente um Markdown gerado, ele fica preservado e o script informa o conflito.
Use `--force` apenas se quiser reconverter e substituir essas edições.

**Privacidade:** estes repositórios são públicos. `documentos/entrada/`, `conhecimento/`,
o índice local e `.venv/` estão ignorados pelo Git. Não use `git add -f` com documentos
de clientes. Antes de publicar qualquer conhecimento, revise e retire dados pessoais,
financeiros e contratuais. A conversão padrão é local e não ativa serviços de IA.
PDF digitalizado sem camada de texto pode exigir OCR separado; o script avisa quando
a conversão resulta vazia.
