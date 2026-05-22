"""Renderizacao textual das propostas."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from .data import (
    DEFAULT_DEADLINES,
    DEFAULT_PAYMENT_TERMS,
    FINAL_DELIVERY,
    IMAGE_CONSIDERATIONS,
    INTRODUCTION,
    REQUESTS,
)
from .pricing import compare_pricing, money


# Evita expor a ordem de grupos em data.py como detalhe mutavel do template.
GROUP_ORDER = ("externas", "internas", "plantas")


def _percent(value: Decimal) -> str:
    if value == value.to_integral_value():
        return str(int(value))
    return str(value.normalize()).replace(".", ",")


def _today_pt() -> str:
    months = [
        "janeiro",
        "fevereiro",
        "marco",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
    ]
    today = date.today()
    return f"Sao Paulo, {today.day:02d} de {months[today.month - 1]} de {today.year}."


def _as_lines(value: object, fallback: list[str]) -> list[str]:
    if value is None:
        return fallback
    if isinstance(value, str):
        return [value]
    return [str(item) for item in value]


def render_comparison(comparison: dict[str, object], selected_strategy: str) -> list[str]:
    planilha = comparison["planilha"]
    cliente = comparison["cliente"]
    history = cliente["history_match"]

    lines = [
        "## Levantamento de preco",
        "",
        "| Criterio | Base | Total sem desconto | Total final |",
        "| --- | --- | ---: | ---: |",
        (
            "| Planilha padrao | Tabela Flying Studio | "
            f"{money(planilha['subtotal'])} | {money(planilha['grand_total'])} |"
        ),
    ]

    if history:
        history_label = f"Ultimo projeto {history.client} - {history.reference} ({history.date})"
    else:
        history_label = "Sem historico do cliente; fallback para planilha"

    lines.append(
        "| Media do cliente | "
        f"{history_label} | {money(cliente['subtotal'])} | {money(cliente['grand_total'])} |"
    )
    lines.extend(
        [
            "",
            f"Criterio selecionado para esta proposta: **{selected_strategy}**.",
            "",
        ]
    )
    return lines


def render_proposal(
    proposal: dict[str, object],
    calculation: dict[str, object],
    include_comparison: bool = False,
) -> str:
    """Gera a proposta em Markdown, pronta para revisao e conversao para Word."""
    lines: list[str] = []
    reference = calculation["reference"]
    attention = calculation["attention"]
    payment_terms = _as_lines(proposal.get("forma_pagamento"), DEFAULT_PAYMENT_TERMS)
    deadlines = _as_lines(proposal.get("prazos"), DEFAULT_DEADLINES)

    lines.extend(
        [
            "# PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D",
            "",
            f"**{calculation['client']} - REF: {reference}**" if reference else f"**{calculation['client']}**",
        ]
    )
    if attention:
        lines.append(f"**A/C: {attention}**")
    lines.extend(["", "## 1 - APRESENTACAO FLYING STUDIO", "", INTRODUCTION, ""])

    if include_comparison:
        lines.extend(render_comparison(compare_pricing(proposal), str(calculation["strategy"])))

    lines.extend(["## 2 - ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:", ""])

    section_number = 1
    for group in GROUP_ORDER:
        group_data = calculation["groups"][group]
        items = group_data["items"]
        if not items:
            continue
        section_label = f"2.{section_number}"
        lines.extend([f"### {section_label} {group_data['title']}", "", "Itens Descricao dos Servicos"])
        for index, item in enumerate(items, start=1):
            quantity = int(item["quantidade"])
            quantity_label = f" ({quantity} unidades)" if quantity > 1 else ""
            lines.append(
                f"{section_label}.{index} {item['descricao_proposta']}{quantity_label} "
                f"{money(item['valor_total'])}"
            )
        lines.append(f"{group_data['quantity']} Valor Total {money(group_data['total'])}")
        lines.append("")
        section_number += 1

    lines.append(f"{calculation['total_quantity']} Valor Final de Imagens {money(calculation['subtotal'])}")
    lines.append(f"Valor Total do Projeto = {money(calculation['subtotal'])}")
    if calculation["discount_percent"] > 0:
        percent = _percent(calculation["discount_percent"])
        lines.append(
            f"Valor Total do Projeto com {percent}% de Desconto = {money(calculation['grand_total'])}"
        )
    lines.extend(
        [
            "",
            "## INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:",
            "",
            f"**{money(calculation['grand_total'])}**",
            "",
            "## FORMA DE PAGAMENTO:",
            "",
        ]
    )
    lines.extend(payment_terms)
    lines.extend(
        [
            "",
            "## 3 - PRAZOS / SOLICITACOES / CONSIDERACOES / ENTREGAS",
            "",
        ]
    )
    lines.extend(deadlines)
    lines.extend(
        [
            "OBS: Prazos passam a contar apos recebimento de todos os projetos, informacoes e aprovacoes de etapas para o desenvolvimento de cada item. Nao iniciamos os trabalhos sem recebermos o DWG e aprovacoes necessarias dessa proposta.",
            "",
            "### SOLICITACOES:",
        ]
    )
    lines.extend(f"- {item}" for item in REQUESTS)
    lines.extend(["", "### CONSIDERACOES IMAGENS:"])
    lines.extend(f"- {item}" for item in IMAGE_CONSIDERATIONS)
    lines.extend(["", "### ENTREGA FINAL:"])
    lines.extend(f"- {item}" for item in FINAL_DELIVERY)

    for warning in calculation["warnings"]:
        lines.extend(["", f"> Aviso: {warning}"])

    lines.extend(["", str(proposal.get("local_data") or _today_pt()), "", "De acordo,", "", "________________________________________", calculation["client"], ""])
    return "\n".join(lines)
