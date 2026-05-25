#!/usr/bin/env python3
"""Gerador automático de propostas Flying Studio.

Uso típico:

    # 1) Comparar levantamentos sem gerar DOCX
    python3 gerador.py exemplos/exemplo_galli.yaml --comparar

    # 2) Gerar DOCX usando preço de planilha
    python3 gerador.py exemplos/exemplo_galli.yaml --estrategia planilha

    # 3) Gerar DOCX usando preço médio do histórico do cliente
    python3 gerador.py exemplos/exemplo_galli.yaml --estrategia historico

O arquivo de entrada (YAML ou JSON) descreve cliente, lista de imagens, desconto, etc.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

import yaml

from flying.ai_parser import parse as ai_parse
from flying.docx_writer import _brl, gerar_docx
from flying.historico import Historico
from flying.orcamento import Orcamento, comparar, montar_extras


def _carregar_entrada(caminho: Path) -> dict[str, Any]:
    txt = caminho.read_text(encoding="utf-8")
    if caminho.suffix.lower() in (".yaml", ".yml"):
        return yaml.safe_load(txt)
    return json.loads(txt)


def _imprime_orcamento(orc: Orcamento, titulo: str) -> None:
    print(f"\n=== {titulo} ===")
    print(f"  Estratégia: {orc.estrategia}")
    for cat_nome in ("externas", "internas", "plantas"):
        cat = getattr(orc, cat_nome)
        if not cat.qtd:
            continue
        print(f"  • {cat_nome.capitalize()} ({cat.qtd} itens) — total {_brl(cat.total)}")
        for it in cat.itens:
            print(f"      - {it.descricao_normalizada:<55} {_brl(it.preco):>12}   [{it.fonte}]")
    print(f"  Subtotal: {_brl(orc.subtotal)}")
    if orc.desconto_pct:
        print(f"  Desconto {orc.desconto_pct:g}%: -{_brl(orc.desconto_valor)}")
    print(f"  TOTAL FINAL: {_brl(orc.total_final)}   ({orc.total_imagens} imagens)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gera propostas Flying Studio.")
    parser.add_argument("entrada", type=Path, help="Arquivo YAML/JSON com a descrição do projeto.")
    parser.add_argument("--estrategia", choices=("planilha", "historico", "auto"), default="auto",
                        help="Qual base de preço usar. 'auto' = histórico se existir, senão planilha.")
    parser.add_argument("--comparar", action="store_true",
                        help="Apenas imprime os 2 levantamentos lado a lado e sai.")
    parser.add_argument("--saida", type=Path, default=None,
                        help="Caminho do DOCX de saída (default: saida/<empresa>_<ref>_<estrategia>.docx).")
    parser.add_argument("--mostrar-precos-individuais", action="store_true",
                        help="Inclui coluna de preço por imagem nas tabelas (estilo BRNPAR).")
    args = parser.parse_args(argv)

    if not args.entrada.exists():
        print(f"ERRO: arquivo não encontrado: {args.entrada}", file=sys.stderr)
        return 2

    cfg = _carregar_entrada(args.entrada)

    cliente = cfg["cliente"]
    descricoes = {
        "externas": cfg.get("externas", []) or [],
        "internas": cfg.get("internas", []) or [],
        "plantas":  cfg.get("plantas", [])  or [],
    }
    desconto_pct = float(cfg.get("desconto_pct", 0))

    # Extras: o YAML pode definir tour_virtual, filmes, apps, drone diretamente.
    extras_struct = montar_extras({
        "tour_virtual": cfg.get("tour_virtual", []) or [],
        "filmes":       cfg.get("filmes", []) or [],
        "apps":         cfg.get("apps", []) or [],
        "drone":        cfg.get("drone", []) or [],
        "extras_diversos":  cfg.get("extras", []) or [],
        "extras_detectados": [],
    })

    levantamentos = comparar(cliente["empresa"], descricoes, desconto_pct=desconto_pct)
    plan = levantamentos["planilha"]
    hist = levantamentos["historico"]

    print(f"\n📐 Cliente: {cliente['empresa']}  |  Ref: {cliente['ref']}  |  A/C: {cliente['contato']}")
    print(f"📦 Imagens: {len(descricoes['externas'])} externas + "
          f"{len(descricoes['internas'])} internas + "
          f"{len(descricoes['plantas'])} plantas "
          f"= {len(descricoes['externas']) + len(descricoes['internas']) + len(descricoes['plantas'])} total")
    if desconto_pct:
        print(f"💸 Desconto solicitado: {desconto_pct:g}%")

    _imprime_orcamento(plan, "LEVANTAMENTO 1 — PREÇO DE PLANILHA")

    if hist is not None:
        _imprime_orcamento(hist, f"LEVANTAMENTO 2 — HISTÓRICO DO CLIENTE ({cliente['empresa']})")
        delta = plan.total_final - hist.total_final
        sinal = "mais caro" if delta > 0 else "mais barato" if delta < 0 else "igual ao"
        print(f"\n🔎 Diferença: planilha está {_brl(abs(delta))} {sinal} que histórico.")
    else:
        print(f"\n⚠️  Não há histórico para o cliente '{cliente['empresa']}'. "
              f"Será usado apenas o levantamento por planilha.")

    if args.comparar:
        return 0

    estrategia = args.estrategia
    if estrategia == "auto":
        estrategia = "historico" if hist is not None else "planilha"

    if estrategia == "historico" and hist is None:
        print("ERRO: estratégia 'historico' pedida, mas cliente não tem histórico.", file=sys.stderr)
        return 3

    orc = hist if estrategia == "historico" else plan

    historico_obj = Historico()
    ult = historico_obj.ultima_proposta(cliente["empresa"])
    forma_pgto = ult.get("forma_pagamento") if ult else None
    prazos = ult.get("prazos") if ult else None
    extras = cfg.get("extras") or (ult.get("extras") if ult else None)
    creditos = cfg.get("creditos")
    desconto_label = cfg.get("desconto_label")

    saida = args.saida
    if saida is None:
        slug = f"{cliente['empresa']}_{cliente['ref']}_{estrategia}".replace(" ", "_").replace("/", "-")
        saida = Path("saida") / f"Proposta_Flying_{slug}.docx"

    data = _dt.date.today()
    if "data" in cfg:
        data = _dt.date.fromisoformat(str(cfg["data"]))

    gerar_docx(
        cliente=cliente,
        orc=orc,
        saida=saida,
        data=data,
        mostra_precos_individuais=args.mostrar_precos_individuais or cfg.get("mostrar_precos_individuais", False),
        forma_pagamento=forma_pgto,
        prazos=prazos,
        extras=extras,
        creditos=creditos,
        desconto_label=desconto_label,
        extras_estruturados=extras_struct,
    )

    print(f"\n✅ DOCX gerado em: {saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
