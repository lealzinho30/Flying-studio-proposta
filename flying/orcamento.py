"""Lógica de orçamento.

Faz os 2 levantamentos pedidos pelo usuário:
  1) PLANILHA  -> aplica preço da tabela padrão item a item (com classificador).
  2) HISTÓRICO -> reaplica o preço que esse mesmo cliente pagou no último
                  projeto, item a item. Se um item não existe no histórico
                  do cliente, cai para a média da categoria daquele cliente
                  (e, em último caso, para o preço de planilha).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .historico import Historico
from .precos import TabelaPrecos, _norm


@dataclass
class ItemOrcado:
    descricao: str
    descricao_normalizada: str
    preco: int
    fonte: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "descricao": self.descricao_normalizada,
            "preco": self.preco,
            "fonte": self.fonte,
        }


@dataclass
class CategoriaOrcada:
    nome: str
    itens: list[ItemOrcado] = field(default_factory=list)

    @property
    def total(self) -> int:
        return sum(i.preco for i in self.itens)

    @property
    def qtd(self) -> int:
        return len(self.itens)

    def to_dict(self) -> dict[str, Any]:
        return {
            "nome": self.nome,
            "qtd": self.qtd,
            "total": self.total,
            "itens": [i.to_dict() for i in self.itens],
        }


@dataclass
class Orcamento:
    estrategia: str
    externas: CategoriaOrcada
    internas: CategoriaOrcada
    plantas: CategoriaOrcada
    desconto_pct: float = 0.0

    @property
    def subtotal(self) -> int:
        return self.externas.total + self.internas.total + self.plantas.total

    @property
    def desconto_valor(self) -> float:
        return self.subtotal * (self.desconto_pct / 100.0)

    @property
    def total_final(self) -> float:
        return self.subtotal - self.desconto_valor

    @property
    def total_imagens(self) -> int:
        return self.externas.qtd + self.internas.qtd + self.plantas.qtd

    def to_dict(self) -> dict[str, Any]:
        return {
            "estrategia": self.estrategia,
            "subtotal": self.subtotal,
            "desconto_pct": self.desconto_pct,
            "desconto_valor": round(self.desconto_valor, 2),
            "total_final": round(self.total_final, 2),
            "total_imagens": self.total_imagens,
            "externas": self.externas.to_dict(),
            "internas": self.internas.to_dict(),
            "plantas": self.plantas.to_dict(),
        }


CATEGORIAS = ("externas", "internas", "plantas")
PREFIXOS = {
    "externas": "Perspectiva ",
    "internas": "Perspectiva ",
    "plantas": "Planta Humanizada ",
}


def _formata_descricao(desc_usuario: str, descricao_padrao: str, categoria: str) -> str:
    """Aplica o jeito de escrever do Flying Studio.

    Regra: se o usuário já digitou um nome com 'Perspectiva' ou 'Planta', usa o
    do usuário. Senão, prefixa com o padrão da categoria.
    """
    desc = desc_usuario.strip()
    norm = _norm(desc)
    prefixos_categoria = {
        "externas": ("perspectiva", "estudo de fachada", "estudo cromatic"),
        "internas": ("perspectiva",),
        "plantas":  ("planta",),
    }
    if any(norm.startswith(p) for p in prefixos_categoria.get(categoria, ())):
        return desc[:1].upper() + desc[1:] if desc else desc
    return PREFIXOS[categoria] + desc


def orcar_pela_planilha(
    descricoes: dict[str, list[str]],
    tabela: TabelaPrecos | None = None,
) -> Orcamento:
    tabela = tabela or TabelaPrecos()
    cats: dict[str, CategoriaOrcada] = {c: CategoriaOrcada(nome=c) for c in CATEGORIAS}

    for cat in CATEGORIAS:
        for desc in descricoes.get(cat, []):
            classif = tabela.classificar(desc, cat)
            descricao_final = _formata_descricao(desc, classif["descricao_padrao"], cat)
            cats[cat].itens.append(
                ItemOrcado(
                    descricao=desc,
                    descricao_normalizada=descricao_final,
                    preco=classif["preco"],
                    fonte=f"planilha:{classif['chave']}",
                )
            )

    return Orcamento(
        estrategia="planilha",
        externas=cats["externas"],
        internas=cats["internas"],
        plantas=cats["plantas"],
    )


def orcar_pelo_historico(
    cliente: str,
    descricoes: dict[str, list[str]],
    tabela: TabelaPrecos | None = None,
    historico: Historico | None = None,
) -> Orcamento | None:
    """Devolve None se o cliente não tiver histórico utilizável."""
    tabela = tabela or TabelaPrecos()
    historico = historico or Historico()

    if not historico.tem_cliente(cliente):
        return None

    tab_cliente = historico.tabela_precos_inferida(cliente) or {}
    medias = historico.medias_por_categoria(cliente) or {}

    cats: dict[str, CategoriaOrcada] = {c: CategoriaOrcada(nome=c) for c in CATEGORIAS}

    for cat in CATEGORIAS:
        for desc in descricoes.get(cat, []):
            chave = _norm(desc)
            preco: int | None = None
            fonte = ""

            if chave in tab_cliente.get(cat, {}):
                preco = tab_cliente[cat][chave]
                fonte = f"historico:{cliente}:item_exato"

            if preco is None:
                # Tenta substring (ex.: usuário escreveu "Fachada" e cliente tem "Perspectiva Fachada")
                for k_hist, v_hist in tab_cliente.get(cat, {}).items():
                    if chave in k_hist or k_hist in chave:
                        preco = v_hist
                        fonte = f"historico:{cliente}:item_similar"
                        break

            if preco is None and cat in medias:
                preco = int(round(medias[cat]))
                fonte = f"historico:{cliente}:media_categoria"

            if preco is None:
                # Cai para planilha
                classif = tabela.classificar(desc, cat)
                preco = classif["preco"]
                fonte = f"fallback_planilha:{classif['chave']}"

            classif = tabela.classificar(desc, cat)
            descricao_final = _formata_descricao(desc, classif["descricao_padrao"], cat)

            cats[cat].itens.append(
                ItemOrcado(
                    descricao=desc,
                    descricao_normalizada=descricao_final,
                    preco=preco,
                    fonte=fonte,
                )
            )

    return Orcamento(
        estrategia=f"historico:{cliente}",
        externas=cats["externas"],
        internas=cats["internas"],
        plantas=cats["plantas"],
    )


def comparar(
    cliente: str,
    descricoes: dict[str, list[str]],
    desconto_pct: float = 0.0,
) -> dict[str, Orcamento | None]:
    tabela = TabelaPrecos()
    historico = Historico()

    plan = orcar_pela_planilha(descricoes, tabela)
    plan.desconto_pct = desconto_pct

    hist = orcar_pelo_historico(cliente, descricoes, tabela, historico)
    if hist is not None:
        hist.desconto_pct = desconto_pct

    return {"planilha": plan, "historico": hist}
