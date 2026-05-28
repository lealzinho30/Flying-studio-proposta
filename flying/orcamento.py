"""Lógica de orçamento.

Faz os 2 levantamentos pedidos pelo usuário:
  1) PLANILHA  -> aplica preço da tabela padrão item a item (com classificador).
  2) HISTÓRICO -> reaplica o preço que esse mesmo cliente pagou no último
                  projeto, item a item. Se um item não existe no histórico
                  do cliente, cai para a média da categoria daquele cliente
                  (e, em último caso, para o preço de planilha).
"""
from __future__ import annotations

import re
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


# ===================== EXTRAS (espelha web/orcamento.js) =====================


def _match_variante(texto: str, catalogo: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not catalogo:
        return None
    alvo = _norm(texto)
    for item in catalogo:
        for padrao in item.get("padroes", []):
            if re.search(padrao, alvo):
                return item
    fallback = next((x for x in catalogo if x.get("chave") == "outro"), None)
    return fallback


def montar_extras(parsed: dict[str, Any]) -> dict[str, Any]:
    """Constrói estrutura de extras (tour virtual/filmes/apps/maquete/drone/estudo)
    a partir do dict do parser. Retorno espelha o formato JS para fácil paridade."""
    import json
    from pathlib import Path

    PRECOS_PATH = Path(__file__).resolve().parent.parent / "data" / "precos_planilha.json"
    with open(PRECOS_PATH, encoding="utf-8") as f:
        precos = json.load(f)

    out = {
        "tour_virtual":   {"titulo": "VISITA VIRTUAL WEB – MULTIPLATAFORMA", "subsecoes": []},
        "filmes":         {"titulo": "FILMES E ANIMAÇÕES", "subsecoes": []},
        "apps":           {"titulo": "APLICAÇÕES E EXPERIÊNCIAS DIGITAIS", "subsecoes": []},
        "drone":          {"titulo": "DRONE / FOTOGRAFIA AÉREA", "subsecoes": []},
        "maquete":        {"titulo": "MAQUETE ELETRÔNICA", "subsecoes": []},
        "estudo_fachada": {"titulo": "ESTUDO DE FACHADA / CROMÁTICA", "subsecoes": []},
        "diversos":       {"titulo": "OUTROS SERVIÇOS", "subsecoes": []},
        "total": 0.0, "qtd": 0,
    }

    TV = precos.get("tour_virtual", {})
    FL = precos.get("filmes", {})
    APP = precos.get("apps", {})
    DR = precos.get("drone", {})
    MQ = precos.get("maquete_eletronica", {})
    EF = precos.get("estudo_fachada", {})

    for desc in parsed.get("tour_virtual") or []:
        v = _match_variante(desc, TV.get("ambientes"))
        if v:
            out["tour_virtual"]["subsecoes"].append({
                "chave": v["chave"], "rotulo_secao": f"{TV['_titulo_secao']} – {v['rotulo']}",
                "rotulo_curto": v["rotulo"], "preco": v["preco"],
                "itens": list(TV.get("_itens_padrao", [])), "desc_original": desc,
            })

    for desc in parsed.get("filmes") or []:
        v = _match_variante(desc, FL.get("catalogo"))
        if v and "chave" in v:
            out["filmes"]["subsecoes"].append({
                "chave": v["chave"], "rotulo_secao": v["rotulo"], "rotulo_curto": v["rotulo"],
                "preco": v["preco"], "itens": list(v.get("itens", [])), "desc_original": desc,
            })

    for desc in parsed.get("apps") or []:
        v = _match_variante(desc, APP.get("catalogo"))
        if v:
            out["apps"]["subsecoes"].append({
                "chave": v["chave"], "rotulo_secao": v["rotulo"], "rotulo_curto": v["rotulo"],
                "preco": v["preco"], "itens": list(v.get("itens", [])), "desc_original": desc,
            })

    for desc in parsed.get("drone") or []:
        v = _match_variante(desc, DR.get("catalogo"))
        if v:
            out["drone"]["subsecoes"].append({
                "chave": v["chave"], "rotulo_secao": v["rotulo"], "rotulo_curto": v["rotulo"],
                "preco": v["preco"], "itens": [], "desc_original": desc,
            })

    # Detectados soltos
    for det in parsed.get("extras_detectados") or []:
        subsec = {
            "chave": det["chave"], "rotulo_secao": det["rotulo"],
            "rotulo_curto": det["rotulo"], "preco": det["preco"],
            "itens": [], "desc_original": det["rotulo"],
        }
        if det["tipo"] == "tour_virtual":
            if any(s["chave"] == det["chave"] for s in out["tour_virtual"]["subsecoes"]):
                continue
            subsec["rotulo_secao"] = f"{TV['_titulo_secao']} – {det['rotulo']}"
            subsec["itens"] = list(TV.get("_itens_padrao", []))
            out["tour_virtual"]["subsecoes"].append(subsec)
        elif det["tipo"] == "filme":
            if any(s["chave"] == det["chave"] for s in out["filmes"]["subsecoes"]):
                continue
            meta = next((x for x in FL.get("catalogo", []) if x["chave"] == det["chave"]), None)
            subsec["itens"] = list((meta or {}).get("itens", []))
            out["filmes"]["subsecoes"].append(subsec)
        elif det["tipo"] == "app":
            if any(s["chave"] == det["chave"] for s in out["apps"]["subsecoes"]):
                continue
            meta = next((x for x in APP.get("catalogo", []) if x["chave"] == det["chave"]), None)
            subsec["itens"] = list((meta or {}).get("itens", []))
            out["apps"]["subsecoes"].append(subsec)
        elif det["tipo"] == "drone":
            if any(s["chave"] == det["chave"] for s in out["drone"]["subsecoes"]):
                continue
            out["drone"]["subsecoes"].append(subsec)
        elif det["tipo"] == "maquete":
            subsec["itens"] = list(MQ.get("itens", []))
            if not out["maquete"]["subsecoes"]:
                out["maquete"]["subsecoes"].append(subsec)
        elif det["tipo"] == "estudo_fachada":
            subsec["itens"] = list(EF.get("itens", []))
            if not out["estudo_fachada"]["subsecoes"]:
                out["estudo_fachada"]["subsecoes"].append(subsec)

    # Diversos (com dedupe)
    todas = (out["tour_virtual"]["subsecoes"] + out["filmes"]["subsecoes"]
             + out["apps"]["subsecoes"] + out["drone"]["subsecoes"]
             + out["maquete"]["subsecoes"] + out["estudo_fachada"]["subsecoes"])

    def _bate_cat(catalogos, alvo_norm):
        return any(re.search(p, alvo_norm) for cat in catalogos for p in (cat.get("padroes", []) if cat else []))

    for desc in parsed.get("extras_diversos") or []:
        d_norm = _norm(desc)
        ja_processado = any(d_norm in _norm(s.get("desc_original", "") or s["rotulo_curto"])
                             or _norm(s.get("desc_original", "") or s["rotulo_curto"]) in d_norm
                             for s in todas)
        conhecido = (
            ja_processado
            or _bate_cat(TV.get("ambientes", []), d_norm)
            or _bate_cat(FL.get("catalogo", []), d_norm)
            or _bate_cat(APP.get("catalogo", []), d_norm)
            or _bate_cat(DR.get("catalogo", []), d_norm)
            or any(re.search(p, d_norm) for p in MQ.get("padroes", []))
            or any(re.search(p, d_norm) for p in EF.get("padroes", []))
        )
        if conhecido:
            continue
        out["diversos"]["subsecoes"].append({
            "chave": "diverso", "rotulo_secao": desc.upper(),
            "rotulo_curto": desc, "preco": 0, "itens": [],
            "desc_original": desc, "sem_preco": True,
        })

    # Totais
    for grupo in list(out.keys()):
        if grupo in ("total", "qtd"):
            continue
        subs = out[grupo]["subsecoes"]
        out[grupo]["total"] = sum(x.get("preco", 0) for x in subs)
        out[grupo]["qtd"] = len(subs)
        out["total"] += out[grupo]["total"]
        out["qtd"] += out[grupo]["qtd"]

    return out
