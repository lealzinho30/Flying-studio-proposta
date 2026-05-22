"""CLI para gerar propostas Flying Studio."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .docx import markdown_to_docx
from .pricing import calculate_proposal, money, slugify
from .render import render_proposal


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gera proposta em Markdown e Word a partir de um JSON de escopo."
    )
    parser.add_argument("entrada", help="Caminho do arquivo JSON com dados da proposta.")
    parser.add_argument(
        "--saida",
        default="output",
        help="Diretorio de saida. Padrao: output",
    )
    parser.add_argument(
        "--formato",
        choices=("md", "docx", "both"),
        default="both",
        help="Formato de saida. Padrao: both",
    )
    parser.add_argument(
        "--estrategia",
        choices=("planilha", "cliente"),
        help="Sobrescreve a estrategia_preco do JSON.",
    )
    parser.add_argument(
        "--comparar",
        action="store_true",
        help="Inclui levantamento comparando preco da planilha e media do cliente.",
    )
    parser.add_argument(
        "--nome-arquivo",
        help="Nome base dos arquivos gerados, sem extensao.",
    )
    return parser


def load_proposal(path: Path) -> dict[str, object]:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise ValueError("O JSON da proposta deve ser um objeto.")
    return data


def write_outputs(
    proposal: dict[str, object],
    markdown: str,
    output_dir: Path,
    file_base: str,
    fmt: str,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    if fmt in {"md", "both"}:
        md_path = output_dir / f"{file_base}.md"
        md_path.write_text(markdown, encoding="utf-8")
        written.append(md_path)
    if fmt in {"docx", "both"}:
        docx_path = output_dir / f"{file_base}.docx"
        markdown_to_docx(markdown, docx_path)
        written.append(docx_path)
    return written


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    input_path = Path(args.entrada)
    proposal = load_proposal(input_path)

    if args.estrategia:
        proposal = {**proposal, "estrategia_preco": args.estrategia}

    calculation = calculate_proposal(proposal)
    include_comparison = bool(args.comparar or proposal.get("comparar_precos"))
    markdown = render_proposal(proposal, calculation, include_comparison=include_comparison)

    file_base = args.nome_arquivo or slugify(
        "-".join(
            part
            for part in [
                str(proposal.get("cliente", "")),
                str(proposal.get("referencia", "")),
            ]
            if part
        )
    )
    written = write_outputs(proposal, markdown, Path(args.saida), file_base, args.formato)

    print(f"Estrategia: {calculation['strategy']}")
    print(f"Subtotal: {money(calculation['subtotal'])}")
    print(f"Total final: {money(calculation['grand_total'])}")
    for warning in calculation["warnings"]:
        print(f"Aviso: {warning}", file=sys.stderr)
    for path in written:
        print(f"Gerado: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
