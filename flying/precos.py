"""Carrega tabela de preços da planilha e classifica itens individualmente.

A ideia: você passa o nome de uma imagem (ex.: "Fachada vista da calçada") junto
com a categoria geral ("externas" / "internas" / "plantas") e a função descobre
qual sub-tabela aplicar (Fachada -> R$3.000, ou diversa -> R$1.900, etc).
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PRECOS_PATH = DATA_DIR / "precos_planilha.json"


def _norm(s: str) -> str:
    """Normaliza texto: minúsculas, sem acento, espaços únicos."""
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


class TabelaPrecos:
    """Wrapper sobre o JSON da planilha com helpers de classificação."""

    def __init__(self, dados: dict[str, Any] | None = None):
        if dados is None:
            with open(PRECOS_PATH, encoding="utf-8") as f:
                dados = json.load(f)
        self.dados = dados

    def classificar(self, descricao: str, categoria: str) -> dict[str, Any]:
        """Dada uma descrição livre + categoria (externas/internas/plantas),
        devolve {chave, descricao, preco} batendo na primeira regex que casar.
        """
        if categoria not in ("externas", "internas", "plantas"):
            raise ValueError(f"Categoria inválida: {categoria}")

        bloco = self.dados[categoria]
        alvo = _norm(descricao)

        for linha in bloco["tabela"]:
            for padrao in linha["padroes"]:
                if re.search(padrao, alvo):
                    return {
                        "chave": linha["chave"],
                        "descricao_padrao": linha["descricao"],
                        "preco": linha["preco"],
                    }

        return {
            "chave": "default",
            "descricao_padrao": bloco["_descricao_padrao"],
            "preco": bloco["_default"],
        }

    def preco_filme(self, chave: str) -> dict[str, Any]:
        return self.dados["filmes"][chave]

    def forma_pagamento_padrao(self) -> list[dict[str, Any]]:
        return self.dados["forma_pagamento_padrao"]["parcelas"]

    def prazos_padrao(self) -> dict[str, str]:
        return self.dados["prazos_padrao"]

    def desconto_sugerido(self) -> int:
        return self.dados["desconto_sugerido_padrao_pct"]
