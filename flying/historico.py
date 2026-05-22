"""Acesso ao histórico de propostas anteriores por cliente.

Calcula 'preço médio do último projeto do mesmo cliente' por categoria — esse é
o segundo levantamento que o usuário pediu (o primeiro é a planilha pura).
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
HIST_PATH = DATA_DIR / "historico_clientes.json"


def _norm_cliente(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    return s.upper().strip()


class Historico:
    def __init__(self, dados: dict[str, Any] | None = None):
        if dados is None:
            with open(HIST_PATH, encoding="utf-8") as f:
                dados = json.load(f)
        self.dados = dados

    def tem_cliente(self, nome: str) -> bool:
        return self._achar(nome) is not None

    def _achar(self, nome: str) -> str | None:
        alvo = _norm_cliente(nome)
        for k in self.dados["clientes"].keys():
            if _norm_cliente(k) == alvo:
                return k
        return None

    def ultima_proposta(self, nome: str) -> dict[str, Any] | None:
        chave = self._achar(nome)
        if not chave:
            return None
        propostas = self.dados["clientes"][chave].get("propostas", [])
        propostas_validas = [
            p for p in propostas
            if p.get("tipo_proposta") != "tecnologias"
            and "externas" in p
        ]
        if not propostas_validas:
            return None
        return sorted(propostas_validas, key=lambda p: p.get("data", ""))[-1]

    def medias_por_categoria(self, nome: str) -> dict[str, float] | None:
        """Devolve média {externas, internas, plantas} do último projeto válido.

        Atenção: é a média *bruta* das imagens daquela categoria. Como dentro de
        externas pode haver Fachada (R$3k) e diversa (R$1,9k), a média acompanha
        o mix do projeto anterior — é justamente a 'pegada' do cliente.
        """
        ult = self.ultima_proposta(nome)
        if not ult:
            return None

        out: dict[str, float] = {}
        for cat in ("externas", "internas", "plantas"):
            bloco = ult.get(cat)
            if bloco and bloco.get("qtd"):
                out[cat] = bloco["total"] / bloco["qtd"]
        return out

    def tabela_precos_inferida(self, nome: str) -> dict[str, dict[str, int]] | None:
        """Tenta inferir uma 'mini-tabela' do cliente: para cada item conhecido
        do último projeto, qual foi o preço cobrado. Útil para reaproveitar
        descrições idênticas (ex.: 'Fachada' do BRNPAR sempre saiu a R$3.500).
        """
        ult = self.ultima_proposta(nome)
        if not ult:
            return None

        from .precos import _norm

        tabela: dict[str, dict[str, int]] = {"externas": {}, "internas": {}, "plantas": {}}
        for cat in ("externas", "internas", "plantas"):
            for it in ult.get(cat, {}).get("itens", []):
                chave = _norm(it["desc"])
                tabela[cat][chave] = it["preco"]
        return tabela

    def contato_padrao(self, nome: str) -> str | None:
        chave = self._achar(nome)
        if not chave:
            return None
        return self.dados["clientes"][chave].get("contato_padrao")
