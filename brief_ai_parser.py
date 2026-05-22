#!/usr/bin/env python3
"""Interpretacao de briefing em linguagem natural para propostas.

Objetivo:
- Ler texto livre escrito pelo usuario.
- Extrair cliente, empresa, referencia, contato, desconto e modo de preco.
- Classificar imagens em externas, internas e plantas com heuristicas.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any


PREFIXOS_CATEGORIA = {
    "externas": "Perspectiva",
    "internas": "Perspectiva",
    "plantas": "Planta Humanizada",
}

KW_PLANTAS = (
    "planta",
    "implantacao",
    "humanizada",
    "pavimento",
    "tipo",
    "mosca",
)

KW_EXTERNAS = (
    "externa",
    "externo",
    "fachada",
    "portaria",
    "playground",
    "piscina",
    "quadra",
    "churrasqueira",
    "redario",
    "jardim",
    "horta",
    "pomar",
    "solarium",
    "bird",
    "voo",
    "fotomontagem",
    "rooftop",
    "pet place",
    "petplace",
    "bicicletario",
    "calcada",
)

KW_INTERNAS = (
    "interna",
    "interno",
    "lobby",
    "coworking",
    "academia",
    "lavanderia",
    "living",
    "quarto",
    "banho",
    "sala",
    "salao",
    "sauna",
    "cinema",
    "fitness",
    "brinquedoteca",
    "mini market",
    "market",
    "beauty",
    "camarote",
    "maleiro",
    "cozinha",
    "dorm",
    "dormitorio",
)

METADADOS_REGEX = re.compile(
    r"^\s*(cliente|empresa|referencia|ref|a\/c|contato|preco|modo|desconto)\s*[:=-]\s*(.+)\s*$",
    re.IGNORECASE,
)
REGEX_LISTA_CATEGORIA = re.compile(
    r"^\s*(externas?|internas?|plantas?)\s*[:=-]\s*(.+)\s*$",
    re.IGNORECASE,
)


def normalizar(texto: str) -> str:
    ascii_text = (
        unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    )
    return " ".join(ascii_text.lower().split())


def _mapear_chave_campo(chave: str) -> str:
    chave_n = normalizar(chave)
    if chave_n in {"cliente"}:
        return "cliente"
    if chave_n in {"empresa"}:
        return "empresa"
    if chave_n in {"referencia", "ref"}:
        return "referencia"
    if chave_n in {"a/c", "contato"}:
        return "a_c"
    if chave_n in {"preco", "modo"}:
        return "modo_precificacao"
    if chave_n in {"desconto"}:
        return "desconto_percentual"
    return chave_n


def _modo_de_texto(texto: str) -> str | None:
    t = normalizar(texto)
    if any(token in t for token in ("planilha", "padrao", "tabela")):
        return "planilha"
    if any(token in t for token in ("cliente", "historico", "ultimo projeto", "ultimo")):
        return "cliente"
    return None


def _numero_em_texto(texto: str) -> float | None:
    match = re.search(r"(\d+(?:[.,]\d+)?)", texto)
    if not match:
        return None
    return float(match.group(1).replace(",", "."))


def _split_lista(valor: str) -> list[str]:
    partes = re.split(r"[;,/|]+", valor)
    itens = [item.strip(" -\t") for item in partes]
    return [item for item in itens if item]


def _limpar_bullet(texto: str) -> str:
    return re.sub(r"^\s*[\-\*\u2022]+\s*", "", texto).strip()


def _categoria_por_texto(texto: str) -> str | None:
    t = normalizar(texto)

    if any(kw in t for kw in KW_PLANTAS):
        return "plantas"
    if any(kw in t for kw in KW_EXTERNAS):
        return "externas"
    if any(kw in t for kw in KW_INTERNAS):
        return "internas"
    return None


def _adicionar_por_quantidade(itens: dict[str, list[str]], categoria: str, quantidade: int) -> None:
    if quantidade <= 0:
        return

    base = PREFIXOS_CATEGORIA[categoria]
    inicio = len(itens[categoria]) + 1
    for indice in range(inicio, inicio + quantidade):
        itens[categoria].append(f"{base} {categoria[:-1].capitalize()} {indice:02d}")


def _normalizar_nome_item(categoria: str, item: str) -> str:
    prefixo = PREFIXOS_CATEGORIA[categoria]
    item_limpo = _limpar_bullet(item)
    if normalizar(item_limpo).startswith(normalizar(prefixo)):
        return item_limpo
    return f"{prefixo} {item_limpo}"


def interpretar_brief(texto: str) -> dict[str, Any]:
    """Interpreta um texto livre e devolve payload base para gerar proposta."""
    linhas = [linha.strip() for linha in texto.splitlines() if linha.strip()]
    campos: dict[str, Any] = {}
    itens: dict[str, list[str]] = {"externas": [], "internas": [], "plantas": []}
    nao_classificados: list[str] = []

    for linha in linhas:
        linha_limpa = _limpar_bullet(linha)

        meta = METADADOS_REGEX.match(linha_limpa)
        if meta:
            chave = _mapear_chave_campo(meta.group(1))
            valor = meta.group(2).strip()
            if chave == "modo_precificacao":
                modo = _modo_de_texto(valor)
                if modo:
                    campos["modo_precificacao"] = modo
                continue
            if chave == "desconto_percentual":
                numero = _numero_em_texto(valor)
                if numero is not None:
                    campos["desconto_percentual"] = numero
                continue
            campos[chave] = valor
            continue

        lista_cat = REGEX_LISTA_CATEGORIA.match(linha_limpa)
        if lista_cat:
            cat_bruta = normalizar(lista_cat.group(1))
            if cat_bruta.startswith("extern"):
                categoria = "externas"
            elif cat_bruta.startswith("intern"):
                categoria = "internas"
            else:
                categoria = "plantas"

            itens_lista = _split_lista(lista_cat.group(2))
            if len(itens_lista) == 1:
                qtd = _numero_em_texto(itens_lista[0])
                if qtd is not None and int(qtd) == qtd and qtd > 0:
                    _adicionar_por_quantidade(itens, categoria, int(qtd))
                    continue

            for item in itens_lista:
                itens[categoria].append(_normalizar_nome_item(categoria, item))
            continue

        # Tenta reconhecer linhas com quantidade por categoria, ex:
        # "5 imagens externas"
        t = normalizar(linha_limpa)
        qtd_match = re.search(r"(\d+)\s+(?:imagens?\s+)?(externas?|internas?|plantas?)", t)
        if qtd_match:
            qtd = int(qtd_match.group(1))
            cat_token = qtd_match.group(2)
            if cat_token.startswith("extern"):
                _adicionar_por_quantidade(itens, "externas", qtd)
            elif cat_token.startswith("intern"):
                _adicionar_por_quantidade(itens, "internas", qtd)
            else:
                _adicionar_por_quantidade(itens, "plantas", qtd)
            continue

        # Linha de imagem solta.
        categoria = _categoria_por_texto(linha_limpa)
        if categoria:
            itens[categoria].append(_normalizar_nome_item(categoria, linha_limpa))
            continue

        # Pode ser texto de modo fora do formato "chave: valor".
        modo_solto = _modo_de_texto(linha_limpa)
        if modo_solto and "modo_precificacao" not in campos:
            campos["modo_precificacao"] = modo_solto
            continue

        # Pode ser desconto solto.
        if "desconto" in t and "desconto_percentual" not in campos:
            numero = _numero_em_texto(linha_limpa)
            if numero is not None:
                campos["desconto_percentual"] = numero
                continue

        nao_classificados.append(linha_limpa)

    return {
        "campos": campos,
        "itens": itens,
        "nao_classificados": nao_classificados,
    }
