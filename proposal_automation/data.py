"""Dados base extraidos da planilha e dos PDFs de referencia."""

from __future__ import annotations

from decimal import Decimal


GROUP_TITLES = {
    "externas": "ILUSTRACOES EXTERNAS",
    "internas": "ILUSTRACOES INTERNAS",
    "plantas": "PLANTAS HUMANIZADAS / PLANTAS BAIXAS",
}

GROUP_PREFIXES = {
    "externas": "Perspectiva",
    "internas": "Perspectiva",
    "plantas": "Planta Humanizada",
}

# Valores da planilha padrao Flying Studio, focados no escopo inicial:
# imagens externas, imagens internas e plantas.
PRICE_TABLE = {
    "fotomontagem_drone_flying": {
        "group": "externas",
        "label": "Fotomontagem / COM FotoDrone por conta da Flying",
        "amount": Decimal("4500.00"),
    },
    "fachada_fotomontagem_voo": {
        "group": "externas",
        "label": "Perspectivas Fachadas / Fotomontagem / Voos",
        "amount": Decimal("3000.00"),
    },
    "externa_diversa": {
        "group": "externas",
        "label": "Perspectivas Externas Diversas",
        "amount": Decimal("1900.00"),
    },
    "interna_diversa": {
        "group": "internas",
        "label": "Perspectivas Internas Diversas",
        "amount": Decimal("1750.00"),
    },
    "planta_pavimento": {
        "group": "plantas",
        "label": "Planta Humanizada Pavimentos (Terreo, Rooftop, Estacionamento, Bolotario)",
        "amount": Decimal("3000.00"),
    },
    "planta_tipo": {
        "group": "plantas",
        "label": "Plantas Humanizada Tipo",
        "amount": Decimal("1200.00"),
    },
    "planta_isometrica_3d": {
        "group": "plantas",
        "label": "Plantas Tipo Isometrica / 3D",
        "amount": Decimal("1900.00"),
    },
}

# Historico de propostas lidas dos PDFs enviados. O valor medio por grupo e
# usado quando a estrategia selecionada for "cliente".
PROJECT_HISTORY = [
    {
        "date": "2026-05-19",
        "client": "GALLI",
        "reference": "SAID AIACH",
        "discount_percent": Decimal("12"),
        "groups": {
            "externas": {"count": 9, "total": Decimal("19300.00")},
            "internas": {"count": 5, "total": Decimal("8750.00")},
            "plantas": {"count": 4, "total": Decimal("10200.00")},
        },
    },
    {
        "date": "2026-05-01",
        "client": "HABRAS",
        "reference": "ITAQUA JAPONES",
        "discount_percent": Decimal("10"),
        "groups": {
            "externas": {"count": 8, "total": Decimal("18500.00")},
            "internas": {"count": 12, "total": Decimal("21000.00")},
            "plantas": {"count": 8, "total": Decimal("11400.00")},
        },
    },
    {
        "date": "2026-05-01",
        "client": "BRNPAR",
        "reference": "NC AVARE",
        "discount_percent": Decimal("8"),
        "groups": {
            "externas": {"count": 5, "total": Decimal("13000.00")},
            "internas": {"count": 6, "total": Decimal("10800.00")},
            "plantas": {"count": 3, "total": Decimal("5400.00")},
        },
    },
    {
        "date": "2026-05-01",
        "client": "CASA VIVA",
        "reference": "PRESTES MAIA",
        "discount_percent": Decimal("22"),
        "groups": {
            "externas": {"count": 8, "total": Decimal("15800.00")},
            "internas": {"count": 8, "total": Decimal("14000.00")},
            "plantas": {"count": 5, "total": Decimal("8300.00")},
        },
    },
]

INTRODUCTION = (
    "A Flying Studio presta servicos de computacao grafica e tecnologias que se "
    "aplicam aos lancamentos imobiliario e remanescentes. Em nosso atendimento "
    "diario, desenvolvemos lacos com projeto e auxiliamos em layout, estudos de "
    "projetos e fachadas, de decoracao e paisagismo de acordo com cada necessidade, "
    "consulte a NID STUDIO para projetos."
)

DEFAULT_PAYMENT_TERMS = [
    "50% - Na aprovacao desta Proposta.",
    "25% - Envio dos Shades",
    "25% - Envio HR - Imagens finais",
]

DEFAULT_DEADLINES = [
    "Shades - 20 (Vinte) dias uteis",
    "1o Tiro - 15 (Quinze) dias uteis apos a aprovacao dos Shades.",
    "Revisoes - 10 (Dez) dias uteis para contemplar e enviar novos tiros.",
]

REQUESTS = [
    "Arquitetura: Plantas, Elevacao da Fachada, Estudo de Cores da Fachada e Cortes.",
    "Paisagismo: Implantacao, Detalhamentos, Especificacao de Revestimentos, Estudo de Vegetacao com Especificacao de Especies e Referencias do Mobiliario.",
    "Decoracao: Plantas com Layout, Desenhos de Pisos, Elevacoes de Paredes, Especificacoes de materiais, Projeto de Forro e Iluminacao, Descricao ou book de mobiliarios.",
]

IMAGE_CONSIDERATIONS = [
    "Etapas e Tiros de Aprovacao: esta proposta contempla o envio inicial do tiro de Shade, seguido do tiro de apresentacao denominado R00. Estao inclusas no escopo 03 (tres) rodadas de revisoes, denominadas R01, R02 e R03, culminando na entrega final denominada HR (High Resolution).",
    "Ajustes Finos e Adicionais: a partir do tiro R00, as rodadas seguintes consistem exclusivamente em ajustes finos. A partir de um eventual quarto tiro de apresentacao, denominado R04, sera cobrado um adicional de 25% do valor da imagem por tiro extra solicitado.",
    "Plataforma Oficial de Revisao: todo o processo de feedback, comentarios e aprovacoes sera realizado preferencialmente atraves do Frame.io/Adobe.",
    "Alteracoes de Projeto: quaisquer alteracoes nos projetos originais fornecidos inicialmente implicam em cobrancas extras de modelagem, que serao orcadas e aprovadas em comum acordo.",
    "Refacao e Remodelagem: havendo mudancas significativas no projeto que resultem na perda de ate 50% da imagem ja construida, o trabalho sera considerado e cobrado como uma imagem nova.",
    "Direitos de Uso: a Contratada cede a Contratante os direitos de uso das imagens produzidas para uso promocional vinculado exclusivamente ao empreendimento contratado, nao havendo debitos ou atrasos financeiros.",
]

FINAL_DELIVERY = [
    "Todo o material finalizado sera enviado digitalmente via servidor FTP, link seguro para download ou cadastrado no Frame.io/Adobe.",
    "As imagens finais, denominadas HR, serao entregues com 6000px em seu lado maior a 300dpi.",
    "Para imagens com medidas de impressao superiores a 1 metro, favor consultar previamente os valores adicionais de render.",
]
