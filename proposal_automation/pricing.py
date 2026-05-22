"""Motor de classificacao e precificacao de propostas."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata

from .data import GROUP_PREFIXES, GROUP_TITLES, PRICE_TABLE, PROJECT_HISTORY


CENT = Decimal("0.01")
VALID_GROUPS = ("externas", "internas", "plantas")


@dataclass(frozen=True)
class HistoryMatch:
    client: str
    reference: str
    date: str
    unit_prices: dict[str, Decimal]


def money(value: Decimal) -> str:
    """Formata Decimal no padrao brasileiro usado nas propostas."""
    quantized = value.quantize(CENT, rounding=ROUND_HALF_UP)
    raw = f"{quantized:,.2f}"
    return "R$" + raw.replace(",", "X").replace(".", ",").replace("X", ".")


def decimal_from(value: object, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip()
    if not text:
        return Decimal(default)
    text = text.replace("R$", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    return Decimal(text)


def slugify(text: str) -> str:
    normalized = strip_accents(text).lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized or "proposta"


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def normalize_key(text: str) -> str:
    return re.sub(r"\s+", " ", strip_accents(text).upper()).strip()


def infer_price_type(description: str, group: str) -> str:
    text = strip_accents(description).lower()
    if group == "externas":
        if "drone" in text and ("flying" in text or "conta da flying" in text):
            return "fotomontagem_drone_flying"
        if any(token in text for token in ("fachada", "fotomontagem", "voo", "bird")):
            return "fachada_fotomontagem_voo"
        return "externa_diversa"
    if group == "internas":
        return "interna_diversa"
    if group == "plantas":
        if any(token in text for token in ("isometr", "3d")):
            return "planta_isometrica_3d"
        if any(
            token in text
            for token in (
                "implantacao",
                "pavimento",
                "terreo",
                "rooftop",
                "estacionamento",
                "bolotario",
                "subsolo",
                "mezanino",
            )
        ):
            return "planta_pavimento"
        return "planta_tipo"
    raise ValueError(f"Grupo desconhecido: {group}")


def normalize_item(raw_item: object, group: str) -> dict[str, object]:
    if isinstance(raw_item, str):
        item = {"descricao": raw_item}
    elif isinstance(raw_item, dict):
        item = deepcopy(raw_item)
    else:
        raise TypeError(f"Item invalido em {group}: {raw_item!r}")

    description = str(item.get("descricao", "")).strip()
    if not description:
        raise ValueError(f"Item sem descricao em {group}")

    quantity = int(item.get("quantidade", 1))
    if quantity <= 0:
        raise ValueError(f"Quantidade deve ser maior que zero em {description!r}")

    price_type = str(item.get("tipo") or infer_price_type(description, group)).strip()
    if price_type not in PRICE_TABLE:
        raise ValueError(f"Tipo de preco desconhecido: {price_type}")
    if PRICE_TABLE[price_type]["group"] != group:
        raise ValueError(f"Tipo {price_type} nao pertence ao grupo {group}")

    normalized = {
        "descricao": description,
        "quantidade": quantity,
        "tipo": price_type,
    }
    if "valor_unitario" in item:
        normalized["valor_unitario_manual"] = decimal_from(item["valor_unitario"])
    return normalized


def normalize_proposal_items(proposal: dict[str, object]) -> dict[str, list[dict[str, object]]]:
    raw_items = proposal.get("itens") or {}
    if not isinstance(raw_items, dict):
        raise TypeError("O campo 'itens' deve ser um objeto com externas, internas e plantas.")

    normalized: dict[str, list[dict[str, object]]] = {}
    for group in VALID_GROUPS:
        normalized[group] = [normalize_item(item, group) for item in raw_items.get(group, [])]
    return normalized


def find_last_client_project(client: str) -> HistoryMatch | None:
    client_key = normalize_key(client)
    matches = [record for record in PROJECT_HISTORY if normalize_key(record["client"]) == client_key]
    if not matches:
        return None
    latest = sorted(matches, key=lambda record: record["date"], reverse=True)[0]
    unit_prices = {}
    for group, group_data in latest["groups"].items():
        count = Decimal(str(group_data["count"]))
        unit_prices[group] = (group_data["total"] / count).quantize(CENT, rounding=ROUND_HALF_UP)
    return HistoryMatch(
        client=latest["client"],
        reference=latest["reference"],
        date=latest["date"],
        unit_prices=unit_prices,
    )


def item_description_for_proposal(description: str, group: str) -> str:
    prefix = GROUP_PREFIXES[group]
    normalized_description = strip_accents(description).lower().strip()
    normalized_prefix = strip_accents(prefix).lower()
    if normalized_description.startswith(normalized_prefix):
        return description
    return f"{prefix} {description}"


def calculate_proposal(
    proposal: dict[str, object],
    strategy: str | None = None,
) -> dict[str, object]:
    """Calcula totais usando a planilha ou a media do ultimo projeto do cliente."""
    selected_strategy = strategy or str(proposal.get("estrategia_preco") or "planilha")
    selected_strategy = selected_strategy.lower().strip()
    if selected_strategy not in {"planilha", "cliente"}:
        raise ValueError("estrategia_preco deve ser 'planilha' ou 'cliente'.")

    client = str(proposal.get("cliente", "")).strip()
    if not client:
        raise ValueError("Informe o campo 'cliente'.")

    normalized_items = normalize_proposal_items(proposal)
    history_match = find_last_client_project(client)
    warnings: list[str] = []
    groups: dict[str, dict[str, object]] = {}
    subtotal = Decimal("0")
    total_quantity = 0

    for group in VALID_GROUPS:
        calculated_items = []
        group_total = Decimal("0")
        group_quantity = 0
        for item in normalized_items[group]:
            quantity = int(item["quantidade"])
            if "valor_unitario_manual" in item:
                unit_price = item["valor_unitario_manual"]
                source = "manual"
            elif selected_strategy == "cliente" and history_match and group in history_match.unit_prices:
                unit_price = history_match.unit_prices[group]
                source = f"cliente:{history_match.reference}"
            else:
                if selected_strategy == "cliente" and not history_match:
                    warnings.append(
                        f"Sem historico para {client}; grupo {GROUP_TITLES[group]} usou preco da planilha."
                    )
                unit_price = PRICE_TABLE[str(item["tipo"])]["amount"]
                source = "planilha"

            total = (unit_price * Decimal(quantity)).quantize(CENT, rounding=ROUND_HALF_UP)
            group_total += total
            group_quantity += quantity
            calculated_items.append(
                {
                    **item,
                    "descricao_proposta": item_description_for_proposal(str(item["descricao"]), group),
                    "valor_unitario": unit_price.quantize(CENT, rounding=ROUND_HALF_UP),
                    "valor_total": total,
                    "fonte_preco": source,
                    "label_preco": PRICE_TABLE[str(item["tipo"])]["label"],
                }
            )

        groups[group] = {
            "title": GROUP_TITLES[group],
            "items": calculated_items,
            "quantity": group_quantity,
            "total": group_total.quantize(CENT, rounding=ROUND_HALF_UP),
        }
        subtotal += group_total
        total_quantity += group_quantity

    discount_percent = decimal_from(proposal.get("desconto_percentual", 0))
    discount_value = (subtotal * discount_percent / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
    grand_total = (subtotal - discount_value).quantize(CENT, rounding=ROUND_HALF_UP)

    return {
        "strategy": selected_strategy,
        "client": client,
        "reference": str(proposal.get("referencia", "")).strip(),
        "attention": str(proposal.get("aos_cuidados", "")).strip(),
        "date": str(proposal.get("data", "")).strip(),
        "groups": groups,
        "subtotal": subtotal.quantize(CENT, rounding=ROUND_HALF_UP),
        "total_quantity": total_quantity,
        "discount_percent": discount_percent,
        "discount_value": discount_value,
        "grand_total": grand_total,
        "warnings": sorted(set(warnings)),
        "history_match": history_match,
    }


def compare_pricing(proposal: dict[str, object]) -> dict[str, object]:
    planilha = calculate_proposal(proposal, "planilha")
    cliente = calculate_proposal(proposal, "cliente")
    difference = (cliente["grand_total"] - planilha["grand_total"]).quantize(
        CENT, rounding=ROUND_HALF_UP
    )
    return {
        "planilha": planilha,
        "cliente": cliente,
        "difference": difference,
    }
