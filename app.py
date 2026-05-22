"""Flying Studio - Servidor web da automação de propostas.

Interface simples:
  - Página inicial: textarea grande + botão "Gerar proposta".
  - O usuário descreve em texto livre (cliente, imagens, desconto, estratégia).
  - O parser (OpenAI ou regex local) extrai os dados estruturados.
  - O sistema mostra os 2 levantamentos lado a lado e oferece o DOCX para download.
"""
from __future__ import annotations

import datetime as _dt
import os
import secrets
import unicodedata
from pathlib import Path

from flask import (
    Flask,
    Response,
    abort,
    render_template,
    request,
    send_from_directory,
    url_for,
)

from flying.ai_parser import parse as ai_parse
from flying.docx_writer import _brl, gerar_docx
from flying.historico import Historico
from flying.orcamento import comparar

BASE = Path(__file__).resolve().parent
SAIDA = BASE / "saida"
SAIDA.mkdir(exist_ok=True)

app = Flask(__name__, template_folder=str(BASE / "templates"), static_folder=str(BASE / "static"))


# Memória curta para a página de resultados (em produção real trocar por DB/cache).
_DOCS: dict[str, Path] = {}


def _slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    s = "".join(c if c.isalnum() else "_" for c in s)
    return s.strip("_") or "proposta"


@app.route("/", methods=["GET"])
def home() -> str:
    exemplo = (
        "Cliente: GALLI\n"
        "Ref: Said Aiach\n"
        "A/C: Daniel Pucci\n"
        "Desconto: 12%\n"
        "Use o histórico do cliente.\n"
        "\n"
        "Externas:\n"
        "- Fachada vista da calçada\n"
        "- Jardim\n"
        "- Quadra de areia\n"
        "- Piscina\n"
        "- Dec c Jacuzzi\n"
        "- Playground\n"
        "- Gourmet/churrasqueira\n"
        "- Terraço rooftop\n"
        "- Fachada Bird's View\n"
        "\n"
        "Internas:\n"
        "- Bicicletário\n"
        "- Academia\n"
        "- Sauna\n"
        "- Brinquedoteca\n"
        "- Salão de Festas\n"
        "\n"
        "Plantas:\n"
        "- Implantação Térreo\n"
        "- Implantação Mezanino lazer\n"
        "- Implantação rooftop\n"
        "- Apartamento Tipo\n"
    )
    openai_ativo = bool(os.getenv("OPENAI_API_KEY"))
    return render_template("index.html", exemplo=exemplo, openai_ativo=openai_ativo)


@app.route("/gerar", methods=["POST"])
def gerar() -> Response | str:
    texto = (request.form.get("descricao") or "").strip()
    estrategia_form = request.form.get("estrategia", "auto")

    if not texto:
        return render_template("index.html", erro="Descreva o projeto antes de gerar.", exemplo="", openai_ativo=bool(os.getenv("OPENAI_API_KEY")))

    parsed = ai_parse(texto)
    if estrategia_form in ("auto", "planilha", "historico"):
        # form override só aplica se o usuário escolheu explicitamente
        if estrategia_form != "auto" or parsed.get("estrategia") in (None, "auto"):
            parsed["estrategia"] = estrategia_form

    cliente = parsed["cliente"]
    descricoes = {
        "externas": parsed.get("externas") or [],
        "internas": parsed.get("internas") or [],
        "plantas":  parsed.get("plantas") or [],
    }
    desconto_pct = float(parsed.get("desconto_pct") or 0)

    levantamentos = comparar(cliente["empresa"], descricoes, desconto_pct=desconto_pct)
    plan = levantamentos["planilha"]
    hist = levantamentos["historico"]

    estrategia = parsed.get("estrategia", "auto")
    if estrategia == "auto":
        estrategia = "historico" if hist is not None else "planilha"
    if estrategia == "historico" and hist is None:
        parsed["_avisos"] = parsed.get("_avisos") or []
        parsed["_avisos"].append(
            f"Cliente '{cliente['empresa']}' não está no histórico — usando planilha."
        )
        estrategia = "planilha"

    orc_escolhido = hist if estrategia == "historico" else plan

    historico_obj = Historico()
    ult = historico_obj.ultima_proposta(cliente["empresa"])
    forma_pgto = ult.get("forma_pagamento") if ult else None
    prazos = ult.get("prazos") if ult else None
    extras = parsed.get("extras") or (ult.get("extras") if ult else None)
    desconto_label = parsed.get("desconto_label")

    data_iso = parsed.get("data")
    data = _dt.date.fromisoformat(data_iso) if data_iso else _dt.date.today()

    nome = f"Proposta_Flying_{_slug(cliente['empresa'])}_{_slug(cliente['ref'])}_{estrategia}.docx"
    saida_path = SAIDA / nome
    gerar_docx(
        cliente=cliente,
        orc=orc_escolhido,
        saida=saida_path,
        data=data,
        mostra_precos_individuais=parsed.get("mostrar_precos_individuais", False),
        forma_pagamento=forma_pgto,
        prazos=prazos,
        extras=extras,
        desconto_label=desconto_label,
    )

    token = secrets.token_urlsafe(8)
    _DOCS[token] = saida_path

    return render_template(
        "resultado.html",
        parsed=parsed,
        cliente=cliente,
        descricoes=descricoes,
        desconto_pct=desconto_pct,
        plan=plan,
        hist=hist,
        estrategia=estrategia,
        orc=orc_escolhido,
        download_url=url_for("download", token=token),
        download_nome=nome,
        brl=_brl,
        texto_original=texto,
    )


@app.route("/download/<token>")
def download(token: str) -> Response:
    path = _DOCS.get(token)
    if not path or not path.exists():
        abort(404)
    return send_from_directory(path.parent, path.name, as_attachment=True)


if __name__ == "__main__":
    porta = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=porta, debug=os.getenv("FLASK_DEBUG") == "1")
