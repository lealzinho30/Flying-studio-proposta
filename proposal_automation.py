#!/usr/bin/env python3
"""Gerador simples de propostas Flying Studio.

Fluxo principal:
1) Ler um arquivo JSON com cliente, referencia e lista de imagens.
2) Escolher a tabela de preco: planilha padrao ou ultimo projeto do cliente.
3) Gerar texto da proposta no padrao utilizado nos PDFs.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


CATEGORIAS = (
    ("externas", "ILUSTRACOES EXTERNAS", "Perspectiva"),
    ("internas", "ILUSTRACOES INTERNAS", "Perspectiva"),
    ("plantas", "PLANTAS BAIXAS", "Planta Humanizada"),
)

APRESENTACAO = (
    "A Flying Studio presta servicos de computacao grafica e tecnologias "
    "que se aplicam aos lancamentos imobiliarios e remanescentes. "
    "Em nosso atendimento diario, desenvolvemos lacos com projeto e auxiliamos "
    "em layout, estudos de projetos e fachadas, de decoracao e paisagismo de "
    "acordo com cada necessidade."
)


@dataclass
class ResultadoPrecificacao:
    unitarios: dict[str, float]
    origem: dict[str, str]
    projeto_cliente_usado: str | None = None


def normalizar(texto: str) -> str:
    ascii_text = (
        unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    )
    return " ".join(ascii_text.lower().split())


def carregar_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def salvar_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def moeda_brl(valor: float) -> str:
    base = f"{valor:,.2f}"
    return "R$" + base.replace(",", "X").replace(".", ",").replace("X", ".")


def arred(valor: float) -> float:
    return round(float(valor) + 1e-9, 2)


def parse_data(valor: str | None) -> date:
    if not valor:
        return date(1900, 1, 1)
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return date(1900, 1, 1)


def carregar_itens(payload: dict[str, Any]) -> dict[str, list[str]]:
    itens_payload = payload.get("itens", {})
    itens: dict[str, list[str]] = {}

    for categoria, _titulo, prefixo in CATEGORIAS:
        bruto = itens_payload.get(categoria, [])
        if isinstance(bruto, int):
            itens[categoria] = [
                f"{prefixo} {categoria[:-1].capitalize()} {indice:02d}"
                for indice in range(1, bruto + 1)
            ]
            continue

        if isinstance(bruto, list):
            processados: list[str] = []
            for nome in bruto:
                item = str(nome).strip()
                if not item:
                    continue
                item_norm = normalizar(item)
                if item_norm.startswith(normalizar(prefixo)):
                    processados.append(item)
                else:
                    processados.append(f"{prefixo} {item}")
            itens[categoria] = processados
            continue

        raise ValueError(
            f"Categoria '{categoria}' deve ser lista de strings ou numero inteiro."
        )

    return itens


def media_ponderada_historico(historico: list[dict[str, Any]]) -> dict[str, float]:
    acumulado: dict[str, dict[str, float]] = {
        categoria: {"quantidade": 0.0, "total": 0.0} for categoria, _, _ in CATEGORIAS
    }

    for projeto in historico:
        categorias = projeto.get("categorias", {})
        for categoria, _, _ in CATEGORIAS:
            bloco = categorias.get(categoria, {})
            qtd = float(bloco.get("quantidade", 0) or 0)
            total = float(bloco.get("total", 0) or 0)
            if qtd > 0 and total > 0:
                acumulado[categoria]["quantidade"] += qtd
                acumulado[categoria]["total"] += total

    medias: dict[str, float] = {}
    for categoria, _, _ in CATEGORIAS:
        qtd = acumulado[categoria]["quantidade"]
        total = acumulado[categoria]["total"]
        medias[categoria] = (total / qtd) if qtd > 0 else 0.0
    return medias


def ultimo_projeto_cliente(
    historico: list[dict[str, Any]], cliente: str
) -> dict[str, Any] | None:
    alvo = normalizar(cliente)
    filtrados = [
        projeto for projeto in historico if normalizar(projeto.get("cliente", "")) == alvo
    ]
    if not filtrados:
        return None
    return max(filtrados, key=lambda p: parse_data(p.get("data")))


def unitarios_do_projeto(projeto: dict[str, Any]) -> dict[str, float]:
    categorias = projeto.get("categorias", {})
    unitarios: dict[str, float] = {}

    for categoria, _, _ in CATEGORIAS:
        bloco = categorias.get(categoria, {})
        qtd = float(bloco.get("quantidade", 0) or 0)
        total = float(bloco.get("total", 0) or 0)
        unitarios[categoria] = (total / qtd) if qtd > 0 and total > 0 else 0.0
    return unitarios


def resolver_precificacao(
    modo: str,
    cliente: str,
    historico: list[dict[str, Any]],
    precos_planilha: dict[str, float],
) -> ResultadoPrecificacao:
    if modo == "planilha":
        return ResultadoPrecificacao(
            unitarios={
                categoria: arred(float(precos_planilha[categoria]))
                for categoria, _, _ in CATEGORIAS
            },
            origem={categoria: "planilha_padrao" for categoria, _, _ in CATEGORIAS},
            projeto_cliente_usado=None,
        )

    medias = media_ponderada_historico(historico)
    ultimo = ultimo_projeto_cliente(historico, cliente)
    unitarios_ultimo = unitarios_do_projeto(ultimo) if ultimo else {}

    unitarios: dict[str, float] = {}
    origem: dict[str, str] = {}
    for categoria, _, _ in CATEGORIAS:
        valor = float(unitarios_ultimo.get(categoria, 0) or 0)
        if valor > 0:
            unitarios[categoria] = arred(valor)
            origem[categoria] = "ultimo_projeto_cliente"
            continue

        media = float(medias.get(categoria, 0) or 0)
        if media > 0:
            unitarios[categoria] = arred(media)
            origem[categoria] = "media_historica_global"
            continue

        unitarios[categoria] = arred(float(precos_planilha[categoria]))
        origem[categoria] = "planilha_padrao_fallback"

    return ResultadoPrecificacao(
        unitarios=unitarios,
        origem=origem,
        projeto_cliente_usado=ultimo.get("referencia") if ultimo else None,
    )


def calcular_totais(
    itens: dict[str, list[str]], unitarios: dict[str, float], desconto_percentual: float
) -> dict[str, Any]:
    categorias: dict[str, Any] = {}
    subtotal = 0.0
    total_imagens = 0

    for categoria, _, _ in CATEGORIAS:
        quantidade = len(itens[categoria])
        total = arred(quantidade * float(unitarios[categoria]))
        subtotal += total
        total_imagens += quantidade
        categorias[categoria] = {
            "quantidade": quantidade,
            "unitario": arred(float(unitarios[categoria])),
            "total": total,
        }

    subtotal = arred(subtotal)
    desconto_valor = arred(subtotal * (desconto_percentual / 100.0))
    total_final = arred(subtotal - desconto_valor)
    return {
        "categorias": categorias,
        "total_imagens": total_imagens,
        "subtotal": subtotal,
        "desconto_percentual": desconto_percentual,
        "desconto_valor": desconto_valor,
        "total_final": total_final,
    }


def gerar_texto_proposta(
    payload: dict[str, Any],
    itens: dict[str, list[str]],
    totais: dict[str, Any],
    modo: str,
    resultado_precificacao: ResultadoPrecificacao,
) -> str:
    empresa = payload.get("empresa", "CLIENTE")
    referencia = payload.get("referencia", "PROJETO")
    atencao = payload.get("a_c", "CONTATO")
    cidade_data = payload.get("cidade_data", "")

    linhas: list[str] = []
    linhas.append("PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D")
    linhas.append(f"{empresa} - REF: {referencia}")
    linhas.append(f"A/C: {atencao}")
    linhas.append("")
    linhas.append("1 - APRESENTACAO FLYING STUDIO")
    linhas.append(APRESENTACAO)
    linhas.append("")
    linhas.append("2 - ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:")

    if modo == "cliente" and resultado_precificacao.projeto_cliente_usado:
        linhas.append(
            "Base de preco: ultimo projeto do cliente "
            f"('{resultado_precificacao.projeto_cliente_usado}')."
        )
    elif modo == "cliente":
        linhas.append("Base de preco: media historica global (cliente sem historico).")
    else:
        linhas.append("Base de preco: planilha padrao.")

    for indice_secao, (categoria, titulo, _prefixo) in enumerate(CATEGORIAS, start=1):
        linhas.append(f"2.{indice_secao} {titulo}")
        linhas.append("Itens Descricao dos Servicos")
        for indice_item, descricao in enumerate(itens[categoria], start=1):
            linhas.append(f"2.{indice_secao}.{indice_item} {descricao}")

        bloco = totais["categorias"][categoria]
        linhas.append(f"{bloco['quantidade']} Valor Total {moeda_brl(bloco['total'])}")

    linhas.append(f"{totais['total_imagens']} Valor Final {moeda_brl(totais['subtotal'])}")
    linhas.append(f"Valor Total do Projeto = {moeda_brl(totais['subtotal'])}")

    desconto_percentual = float(totais["desconto_percentual"])
    if desconto_percentual > 0:
        linhas.append(
            "Valor Total do Projeto com "
            f"{desconto_percentual:g}% de Desconto = {moeda_brl(totais['total_final'])}"
        )

    linhas.append("INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:")
    linhas.append(
        moeda_brl(totais["total_final"] if desconto_percentual > 0 else totais["subtotal"])
    )
    linhas.append("FORMA DE PAGAMENTO:")
    linhas.append("50% - Na aprovacao desta Proposta.")
    linhas.append("25% - Envio dos Shades")
    linhas.append("25% - Envio HR - Imagens finais")
    linhas.append("")
    linhas.append("3 - PRAZOS / SOLICITACOES / CONSIDERACOES / ENTREGAS")
    linhas.append("Shades - 20 (Vinte) dias uteis")
    linhas.append("1o Tiro - 15 (Quinze) dias uteis apos a aprovacao dos Shades")
    linhas.append("Revisoes - 10 (Dez) dias uteis para contemplar e enviar novos tiros")
    if cidade_data:
        linhas.append("")
        linhas.append(cidade_data)
    linhas.append("De acordo,")
    linhas.append(empresa)

    return "\n".join(linhas) + "\n"


def comando_analisar(args: argparse.Namespace) -> int:
    historico = carregar_json(Path(args.historico))
    medias = media_ponderada_historico(historico)

    print("Media ponderada por categoria (historico):")
    for categoria, _, _ in CATEGORIAS:
        print(f"- {categoria}: {moeda_brl(medias[categoria])}")

    clientes = sorted({projeto.get("cliente", "") for projeto in historico if projeto.get("cliente")})
    print("\nClientes encontrados no historico:")
    for cliente in clientes:
        print(f"- {cliente}")
    return 0


def comando_gerar(args: argparse.Namespace) -> int:
    payload = carregar_json(Path(args.entrada))
    historico = carregar_json(Path(args.historico))
    precos_planilha = carregar_json(Path(args.precos_planilha))

    itens = carregar_itens(payload)
    cliente_para_busca = payload.get("cliente") or payload.get("empresa") or ""
    desconto = float(payload.get("desconto_percentual", 0) or 0)

    resultado = resolver_precificacao(
        modo=args.modo,
        cliente=cliente_para_busca,
        historico=historico,
        precos_planilha=precos_planilha,
    )
    totais = calcular_totais(itens, resultado.unitarios, desconto)
    texto = gerar_texto_proposta(payload, itens, totais, args.modo, resultado)

    saida = Path(args.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(texto, encoding="utf-8")

    resumo = {
        "cliente_consultado": cliente_para_busca,
        "modo_precificacao": args.modo,
        "projeto_cliente_usado": resultado.projeto_cliente_usado,
        "origem_por_categoria": resultado.origem,
        "unitarios": resultado.unitarios,
        "totais": totais,
        "saida_proposta": str(saida),
    }

    if args.saida_resumo:
        salvar_json(Path(args.saida_resumo), resumo)
    else:
        print(json.dumps(resumo, ensure_ascii=False, indent=2))

    if args.comparar:
        alternativo = "cliente" if args.modo == "planilha" else "planilha"
        outro_resultado = resolver_precificacao(
            modo=alternativo,
            cliente=cliente_para_busca,
            historico=historico,
            precos_planilha=precos_planilha,
        )
        outro_total = calcular_totais(itens, outro_resultado.unitarios, desconto)
        print("\nComparativo rapido:")
        print(f"- Modo atual ({args.modo}): {moeda_brl(totais['total_final'])}")
        print(f"- Modo alternativo ({alternativo}): {moeda_brl(outro_total['total_final'])}")

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Automacao de propostas (externas, internas e plantas)."
    )
    subparsers = parser.add_subparsers(dest="comando", required=True)

    analisar = subparsers.add_parser(
        "analisar", help="Mostra medias historicas e clientes cadastrados."
    )
    analisar.add_argument(
        "--historico",
        default="data/historico_propostas.json",
        help="Arquivo JSON com historico de projetos.",
    )
    analisar.set_defaults(func=comando_analisar)

    gerar = subparsers.add_parser(
        "gerar", help="Gera proposta com base no arquivo de entrada."
    )
    gerar.add_argument("--entrada", required=True, help="JSON com dados do projeto.")
    gerar.add_argument(
        "--saida",
        default="out/proposta_gerada.txt",
        help="Arquivo texto de saida da proposta.",
    )
    gerar.add_argument(
        "--saida-resumo",
        default="out/resumo_precificacao.json",
        help="Arquivo JSON com detalhes dos calculos. Use vazio para imprimir no stdout.",
    )
    gerar.add_argument(
        "--historico",
        default="data/historico_propostas.json",
        help="Arquivo JSON com historico de projetos.",
    )
    gerar.add_argument(
        "--precos-planilha",
        default="data/precos_planilha.json",
        help="Arquivo JSON com tabela padrao da planilha.",
    )
    gerar.add_argument(
        "--modo",
        choices=("planilha", "cliente"),
        default="planilha",
        help="Metodo de precificacao.",
    )
    gerar.add_argument(
        "--comparar",
        action="store_true",
        help="Mostra comparativo de total com o outro modo.",
    )
    gerar.set_defaults(func=comando_gerar)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
