#!/usr/bin/env python3
"""Interface web para gerar propostas via descricao livre."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any

from flask import Flask, abort, render_template_string, request, send_file, url_for

from brief_ai_parser import interpretar_brief
from proposal_automation import gerar_docx_proposta, gerar_proposta

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "out" / "web"
OUT_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)

HTML_TEMPLATE = """
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistente IA - Propostas Flying</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f7f7f7; color: #222; }
    .box { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    textarea { width: 100%; min-height: 220px; font-family: Consolas, monospace; font-size: 14px; }
    input, select, button { padding: 8px; font-size: 14px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; }
    .row > div { min-width: 200px; }
    .error { color: #b00020; font-weight: bold; }
    .ok { color: #126e00; font-weight: bold; }
    pre { white-space: pre-wrap; background: #111; color: #d7ffd7; padding: 12px; border-radius: 6px; }
    .links a { margin-right: 12px; }
  </style>
</head>
<body>
  <h1>Assistente IA - Propostas Flying Studio</h1>

  <div class="box">
    <p>
      Descreva o projeto em texto livre (cliente, contato, referencia, imagens e regra de preco).
      A IA interpreta o texto, calcula os valores e gera os arquivos da proposta.
    </p>
    <form method="post">
      <label for="brief"><strong>Briefing em texto livre</strong></label><br />
      <textarea id="brief" name="brief" placeholder="Cliente: GALLI
Empresa: GALLI
Referencia: Residencial Exemplo
A/C: Daniel
Preco: cliente
Desconto: 10%

Imagens:
- Fachada externa
- Portaria externa
- Lobby interno
- Academia interna
- Planta implantacao terreo
- Planta tipo A">{{ brief }}</textarea>
      <div class="row" style="margin-top: 10px;">
        <div>
          <label>Modo de preco (opcional):</label><br />
          <select name="modo_forcado">
            <option value="auto" {% if modo_forcado == "auto" %}selected{% endif %}>Auto (IA)</option>
            <option value="planilha" {% if modo_forcado == "planilha" %}selected{% endif %}>Planilha</option>
            <option value="cliente" {% if modo_forcado == "cliente" %}selected{% endif %}>Ultimo projeto do cliente</option>
          </select>
        </div>
        <div>
          <label>Desconto forcado % (opcional):</label><br />
          <input type="text" name="desconto_forcado" value="{{ desconto_forcado }}" placeholder="ex: 12" />
        </div>
      </div>
      <p style="margin-top: 12px;">
        <button type="submit">Gerar proposta</button>
      </p>
    </form>
  </div>

  {% if erro %}
    <div class="box"><p class="error">{{ erro }}</p></div>
  {% endif %}

  {% if sucesso %}
    <div class="box">
      <p class="ok">{{ sucesso }}</p>
      <div class="links">
        <a href="{{ link_txt }}" target="_blank">Baixar TXT</a>
        <a href="{{ link_docx }}" target="_blank">Baixar DOCX</a>
        <a href="{{ link_json }}" target="_blank">Baixar Resumo JSON</a>
      </div>
    </div>

    <div class="box">
      <h3>Resumo interpretado pela IA</h3>
      <pre>{{ resumo_interpretacao }}</pre>
    </div>

    <div class="box">
      <h3>Preview da proposta</h3>
      <pre>{{ preview }}</pre>
    </div>
  {% endif %}
</body>
</html>
"""


def slugify(texto: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "-", texto.strip().lower()).strip("-")
    return base or "proposta"


def _safe_download_path(filename: str) -> Path:
    caminho = (OUT_DIR / filename).resolve()
    if OUT_DIR.resolve() not in caminho.parents and caminho != OUT_DIR.resolve():
        raise ValueError("Arquivo invalido.")
    return caminho


def _parse_float(value: str | None) -> float | None:
    if not value:
        return None
    limpo = value.strip().replace(",", ".")
    if not limpo:
        return None
    try:
        return float(limpo)
    except ValueError:
        return None


def _montar_payload(campos: dict[str, Any], itens: dict[str, list[str]]) -> dict[str, Any]:
    empresa = (campos.get("empresa") or campos.get("cliente") or "CLIENTE").strip()
    cliente = (campos.get("cliente") or empresa).strip()
    referencia = (campos.get("referencia") or "PROJETO").strip()
    contato = (campos.get("a_c") or "CONTATO").strip()
    desconto = float(campos.get("desconto_percentual", 0) or 0)

    cidade_data = datetime.now().strftime("Sao Paulo, %d de %B de %Y.")

    return {
        "empresa": empresa,
        "cliente": cliente,
        "referencia": referencia,
        "a_c": contato,
        "cidade_data": cidade_data,
        "desconto_percentual": desconto,
        "itens": itens,
    }


@app.route("/", methods=["GET", "POST"])
def index() -> str:
    contexto: dict[str, Any] = {
        "brief": "",
        "modo_forcado": "auto",
        "desconto_forcado": "",
        "erro": "",
        "sucesso": "",
    }

    if request.method == "GET":
        return render_template_string(HTML_TEMPLATE, **contexto)

    brief = request.form.get("brief", "").strip()
    modo_forcado = request.form.get("modo_forcado", "auto").strip() or "auto"
    desconto_forcado = request.form.get("desconto_forcado", "").strip()

    contexto["brief"] = brief
    contexto["modo_forcado"] = modo_forcado
    contexto["desconto_forcado"] = desconto_forcado

    if not brief:
        contexto["erro"] = "Preencha o texto livre para gerar a proposta."
        return render_template_string(HTML_TEMPLATE, **contexto)

    interpretado = interpretar_brief(brief)
    campos = dict(interpretado["campos"])
    itens = interpretado["itens"]

    if sum(len(v) for v in itens.values()) == 0:
        contexto["erro"] = (
            "Nao foi possivel identificar imagens no texto. "
            "Inclua linhas com nomes de imagens (ex: Fachada, Lobby, Planta tipo A)."
        )
        return render_template_string(HTML_TEMPLATE, **contexto)

    if modo_forcado in {"planilha", "cliente"}:
        campos["modo_precificacao"] = modo_forcado

    desconto_float = _parse_float(desconto_forcado)
    if desconto_float is not None:
        campos["desconto_percentual"] = desconto_float

    modo = campos.get("modo_precificacao", "planilha")
    payload = _montar_payload(campos, itens)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome_base = slugify(f"{payload['empresa']}-{payload['referencia']}-{stamp}")

    txt_path = OUT_DIR / f"{nome_base}.txt"
    resumo_path = OUT_DIR / f"{nome_base}.json"
    docx_path = OUT_DIR / f"{nome_base}.docx"

    resumo = gerar_proposta(
        payload=payload,
        modo=modo,
        saida_txt=str(txt_path),
        saida_resumo=str(resumo_path),
    )
    gerar_docx_proposta(resumo["texto_proposta"], docx_path)

    contexto["sucesso"] = "Proposta gerada com sucesso."
    contexto["preview"] = resumo["texto_proposta"]
    contexto["resumo_interpretacao"] = (
        f"campos: {campos}\n"
        f"itens: {itens}\n"
        f"nao_classificados: {interpretado['nao_classificados']}\n"
        f"modo_final: {modo}"
    )
    contexto["link_txt"] = url_for("download", filename=txt_path.name)
    contexto["link_docx"] = url_for("download", filename=docx_path.name)
    contexto["link_json"] = url_for("download", filename=resumo_path.name)

    return render_template_string(HTML_TEMPLATE, **contexto)


@app.route("/download/<path:filename>", methods=["GET"])
def download(filename: str):
    try:
        caminho = _safe_download_path(filename)
    except ValueError:
        abort(400)

    if not caminho.exists() or not caminho.is_file():
        abort(404)
    return send_file(caminho, as_attachment=True)


def main() -> None:
    app.run(host="0.0.0.0", port=8080, debug=False)


if __name__ == "__main__":
    main()
