"""Assistente local para transformar briefing livre em proposta estruturada."""

from __future__ import annotations

from dataclasses import dataclass
import re

from .pricing import decimal_from, normalize_key, strip_accents


GROUP_ALIASES = {
    "externas": (
        "externa",
        "externas",
        "imagem externa",
        "imagens externas",
        "ilustracao externa",
        "ilustracoes externas",
        "perspectivas externas",
    ),
    "internas": (
        "interna",
        "internas",
        "imagem interna",
        "imagens internas",
        "ilustracao interna",
        "ilustracoes internas",
        "perspectivas internas",
    ),
    "plantas": (
        "planta",
        "plantas",
        "planta baixa",
        "plantas baixas",
        "planta humanizada",
        "plantas humanizadas",
        "implantacoes",
        "implantacao",
    ),
}

FIELD_ALIASES = {
    "cliente": ("cliente", "empresa", "contratante"),
    "referencia": ("ref", "referencia", "referência", "empreendimento", "projeto"),
    "aos_cuidados": ("a/c", "ac", "aos cuidados", "contato", "responsavel", "responsável"),
    "estrategia_preco": (
        "preco",
        "preço",
        "criterio de preco",
        "critério de preço",
        "estrategia",
        "estratégia",
        "seguir preco",
        "seguir preço",
        "base de preco",
        "base de preço",
    ),
    "desconto_percentual": ("desconto", "desconto percentual"),
}


@dataclass(frozen=True)
class AssistantParseResult:
    proposal: dict[str, object]
    warnings: list[str]


def example_brief() -> str:
    """Exemplo exibido na interface web."""
    return """Cliente: GALLI
Referencia: SAID AIACH - NOVA ETAPA
A/C: DANIEL PUCCI
Preco: seguir ultimo projeto do cliente
Desconto: 12%

Externas:
- Fachada vista da calcada
- Jardim
- Piscina
- Gourmet/churrasqueira

Internas:
- Bicicletario
- Academia
- Salao de Festas

Plantas:
- Implantacao terreo
- Implantacao rooftop
- Apartamento Tipo
"""


def _field_regex(aliases: tuple[str, ...]) -> re.Pattern[str]:
    escaped = "|".join(re.escape(alias) for alias in sorted(aliases, key=len, reverse=True))
    return re.compile(rf"^\s*(?:{escaped})\s*[:=\-]\s*(.+?)\s*$", re.IGNORECASE)


FIELD_REGEX = {field: _field_regex(aliases) for field, aliases in FIELD_ALIASES.items()}


def _group_from_line(line: str) -> tuple[str | None, str]:
    normalized = strip_accents(line).lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    for group, aliases in GROUP_ALIASES.items():
        for alias in sorted(aliases, key=len, reverse=True):
            alias_norm = strip_accents(alias).lower()
            if normalized == alias_norm:
                return group, ""
            if normalized.startswith(f"{alias_norm}:"):
                return group, line.split(":", 1)[1].strip()
            if normalized.startswith(f"{alias_norm} -"):
                return group, line.split("-", 1)[1].strip()
            if normalized.startswith(f"{alias_norm} ="):
                return group, line.split("=", 1)[1].strip()
    return None, line


def _clean_item(line: str) -> str:
    text = line.strip()
    text = re.sub(r"^[\-*•]\s*", "", text)
    text = re.sub(r"^\d+[\).\-\s]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ;,")


def _split_items(text: str) -> list[str]:
    cleaned = _clean_item(text)
    if not cleaned:
        return []
    parts = re.split(r"\s*(?:,|;|\n)\s*", cleaned)
    return [_clean_item(part) for part in parts if _clean_item(part)]


def _parse_strategy(text: str) -> str:
    normalized = strip_accents(text).lower()
    if any(token in normalized for token in ("cliente", "ultimo projeto", "ultima proposta", "historico")):
        return "cliente"
    if any(token in normalized for token in ("planilha", "tabela", "padrao", "padrão")):
        return "planilha"
    return text.strip().lower()


def _parse_discount(text: str) -> object:
    match = re.search(r"(\d+(?:[,.]\d+)?)", text)
    if not match:
        return text.strip()
    return decimal_from(match.group(1))


def _looks_like_field(line: str) -> bool:
    normalized = normalize_key(line)
    return any(
        normalize_key(alias) in normalized[:40]
        for aliases in FIELD_ALIASES.values()
        for alias in aliases
    )


def parse_brief(text: str) -> AssistantParseResult:
    """Interpreta um briefing em texto livre e retorna o JSON da proposta.

    O parser e deterministico para poder funcionar sem credenciais de IA externa.
    Ele entende campos com "chave: valor" e listas por grupos de imagens.
    """
    proposal: dict[str, object] = {
        "cliente": "",
        "referencia": "",
        "aos_cuidados": "",
        "estrategia_preco": "planilha",
        "comparar_precos": True,
        "desconto_percentual": 0,
        "itens": {"externas": [], "internas": [], "plantas": []},
    }
    warnings: list[str] = []
    current_group: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        matched_field = False
        for field, pattern in FIELD_REGEX.items():
            match = pattern.match(line)
            if not match:
                continue
            value = match.group(1).strip()
            if field == "estrategia_preco":
                proposal[field] = _parse_strategy(value)
            elif field == "desconto_percentual":
                proposal[field] = _parse_discount(value)
            else:
                proposal[field] = value
            matched_field = True
            current_group = None
            break
        if matched_field:
            continue

        group, remainder = _group_from_line(line)
        if group:
            current_group = group
            for item in _split_items(remainder):
                proposal["itens"][group].append(item)  # type: ignore[index]
            continue

        if current_group:
            for item in _split_items(line):
                proposal["itens"][current_group].append(item)  # type: ignore[index]
            continue

        if not _looks_like_field(line):
            warnings.append(f"Linha nao classificada: {line}")

    if not str(proposal["cliente"]).strip():
        warnings.append("Cliente nao identificado. Informe uma linha como 'Cliente: NOME'.")

    strategy = str(proposal["estrategia_preco"]).strip().lower()
    if strategy not in {"planilha", "cliente"}:
        warnings.append("Criterio de preco nao identificado; usando planilha.")
        proposal["estrategia_preco"] = "planilha"

    item_counts = {
        group: len(items)
        for group, items in proposal["itens"].items()  # type: ignore[union-attr]
    }
    if sum(item_counts.values()) == 0:
        warnings.append("Nenhuma imagem foi identificada. Use blocos Externas, Internas e Plantas.")

    return AssistantParseResult(proposal=proposal, warnings=warnings)
