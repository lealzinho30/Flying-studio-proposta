"""Gera o DOCX da proposta no formato Flying Studio.

Reproduz o layout e os textos exatos das propostas reais (apresentação,
condições, prazos, considerações, entrega final).
"""
from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Any

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

from .orcamento import Orcamento

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _brl(valor: float) -> str:
    s = f"{valor:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R${s}"


def _data_extenso(data: _dt.date) -> str:
    return f"{data.day:02d} de {MESES_PT[data.month - 1]} de {data.year}"


_UNIDADES = ["", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove",
             "Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete",
             "Dezoito", "Dezenove"]
_DEZENAS = ["", "", "Vinte", "Trinta", "Quarenta", "Cinquenta", "Sessenta", "Setenta", "Oitenta", "Noventa"]
_CENTENAS = ["", "Cento", "Duzentos", "Trezentos", "Quatrocentos", "Quinhentos",
             "Seiscentos", "Setecentos", "Oitocentos", "Novecentos"]


def _ate_999(n: int) -> str:
    if n == 0:
        return ""
    if n == 100:
        return "Cem"
    partes: list[str] = []
    c, r = divmod(n, 100)
    if c:
        partes.append(_CENTENAS[c])
    if r < 20:
        if r:
            partes.append(_UNIDADES[r])
    else:
        d, u = divmod(r, 10)
        partes.append(_DEZENAS[d])
        if u:
            partes.append(f"{_DEZENAS[d]} e {_UNIDADES[u]}")
            partes.pop(-2)
    return " e ".join(partes)


def _numero_extenso_basico(valor: float) -> str:
    """Reais por extenso (cobre até centenas de milhões; centavos ignorados — em
    propostas o valor é sempre cheio)."""
    inteiro = int(round(valor))
    if inteiro == 0:
        return "Zero Reais"

    milhoes, resto = divmod(inteiro, 1_000_000)
    milhares, unidades = divmod(resto, 1_000)

    blocos: list[str] = []
    if milhoes:
        rotulo = "Milhão" if milhoes == 1 else "Milhões"
        blocos.append(f"{_ate_999(milhoes)} {rotulo}")
    if milhares:
        if milhares == 1:
            blocos.append("Mil")
        else:
            blocos.append(f"{_ate_999(milhares)} Mil")
    if unidades:
        blocos.append(_ate_999(unidades))

    texto = ", ".join(blocos) if len(blocos) > 1 else blocos[0]
    rotulo_real = "Real" if inteiro == 1 else "Reais"
    return f"{texto} {rotulo_real}"


def _set_run(run, *, bold=False, size=11, color=None):
    run.font.name = "Calibri"
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def _add_titulo(doc: Document, texto: str, *, size: int = 14):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run(texto)
    _set_run(r, bold=True, size=size)
    return p


def _add_paragrafo(doc: Document, texto: str, *, bold=False, size=11):
    p = doc.add_paragraph()
    r = p.add_run(texto)
    _set_run(r, bold=bold, size=size)
    return p


def _tabela_categoria(doc: Document, titulo: str, numero: str, categoria, *, mostra_precos_individuais: bool):
    """Renderiza uma seção tipo '2.1 ILUSTRAÇÕES EXTERNAS' + tabela."""
    _add_titulo(doc, f"{numero} {titulo.upper()}", size=12)

    cols = 3 if mostra_precos_individuais else 2
    tab = doc.add_table(rows=1 + categoria.qtd + 1, cols=cols)
    tab.style = "Light Grid Accent 1"
    tab.autofit = True

    cab = tab.rows[0].cells
    cab[0].text = "Itens"
    cab[1].text = "Descrição dos Serviços"
    if mostra_precos_individuais:
        cab[2].text = "Valor"
    for c in cab:
        for p in c.paragraphs:
            for r in p.runs:
                _set_run(r, bold=True, size=11)

    for idx, item in enumerate(categoria.itens, start=1):
        linha = tab.rows[idx].cells
        linha[0].text = f"{numero}.{idx}"
        linha[1].text = item.descricao_normalizada
        if mostra_precos_individuais:
            linha[2].text = _brl(item.preco)
            for p in linha[2].paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    rod = tab.rows[-1].cells
    rod[0].text = str(categoria.qtd)
    rod[1].text = "Valor Total"
    valor_cell = rod[-1] if mostra_precos_individuais else rod[1]
    if not mostra_precos_individuais:
        rod[1].text = f"Valor Total {_brl(categoria.total)}"
    else:
        valor_cell.text = _brl(categoria.total)
        for p in valor_cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for c in rod:
        for p in c.paragraphs:
            for r in p.runs:
                _set_run(r, bold=True, size=11)
    doc.add_paragraph()


def gerar_docx(
    *,
    cliente: dict[str, str],
    orc: Orcamento,
    saida: Path,
    data: _dt.date | None = None,
    mostra_precos_individuais: bool = False,
    forma_pagamento: list[dict[str, Any]] | None = None,
    prazos: dict[str, str] | None = None,
    extras: list[dict[str, Any]] | None = None,
    creditos: list[dict[str, Any]] | None = None,
    desconto_label: str | None = None,
) -> Path:
    """Gera o DOCX da proposta.

    cliente: {"empresa": str, "ref": str, "contato": str}
    orc:     resultado de orcamento.orcar_pela_planilha / orcar_pelo_historico
    """
    data = data or _dt.date.today()
    doc = Document()

    secao = doc.sections[0]
    secao.left_margin = Cm(2.5)
    secao.right_margin = Cm(2.5)
    secao.top_margin = Cm(2.0)
    secao.bottom_margin = Cm(2.0)

    _add_titulo(doc, "PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D", size=14)
    _add_paragrafo(doc, f"{cliente['empresa']} - REF: {cliente['ref']}", bold=True, size=12)
    _add_paragrafo(doc, f"A/C: {cliente['contato']}", bold=True, size=12)
    doc.add_paragraph()

    _add_titulo(doc, "1 – APRESENTAÇÃO FLYING STUDIO", size=12)
    _add_paragrafo(
        doc,
        "A Flying Studio presta serviços de computação gráfica e tecnologias que se "
        "aplicam aos lançamentos imobiliário e remanescentes. Em nosso atendimento "
        "diário, desenvolvemos laços com projeto e auxiliamos em layout, estudos de "
        "projetos e fachadas, de decoração e paisagismo de acordo com cada "
        "necessidade, consulte a NID STUDIO para projetos.",
    )
    doc.add_paragraph()

    _add_titulo(doc, "2 – ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:", size=12)

    if orc.externas.qtd:
        _tabela_categoria(doc, "Ilustrações Externas", "2.1", orc.externas, mostra_precos_individuais=mostra_precos_individuais)
    if orc.internas.qtd:
        _tabela_categoria(doc, "Ilustrações Internas", "2.2", orc.internas, mostra_precos_individuais=mostra_precos_individuais)
    if orc.plantas.qtd:
        _tabela_categoria(doc, "Plantas Humanizadas", "2.3", orc.plantas, mostra_precos_individuais=mostra_precos_individuais)

    subtotal = orc.subtotal
    creditos_total = sum(c.get("valor", 0) for c in (creditos or []))
    valor_apos_creditos = subtotal - creditos_total
    desconto_valor = valor_apos_creditos * (orc.desconto_pct / 100.0)
    valor_final = valor_apos_creditos - desconto_valor

    _add_paragrafo(doc, f"{orc.total_imagens} Valor Final {_brl(subtotal)}", bold=True)

    if creditos:
        for cred in creditos:
            _add_paragrafo(doc, f"{cred['descricao']}: {_brl(cred['valor'])}")
        _add_paragrafo(doc, f"Valor Final do Projeto = {_brl(valor_apos_creditos)}", bold=True)

    if orc.desconto_pct > 0:
        rotulo = desconto_label or f"{orc.desconto_pct:g}% de Desconto"
        _add_paragrafo(
            doc,
            f"Valor Total do Projeto com {rotulo} = {_brl(valor_final)}",
            bold=True,
        )
    else:
        _add_paragrafo(doc, f"Valor Total do Projeto = {_brl(valor_final)}", bold=True)
    doc.add_paragraph()

    if extras:
        _add_titulo(doc, "2.4 EXTRAS / FILMES", size=12)
        for ex in extras:
            cortesia = " (CORTESIA)" if ex.get("cortesia") else ""
            preco_label = "" if ex.get("cortesia") else f" - {_brl(ex['preco'])}"
            _add_paragrafo(doc, f"• {ex['descricao']}{preco_label}{cortesia}")
        doc.add_paragraph()

    _add_paragrafo(doc, "INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:", bold=True)
    _add_paragrafo(doc, f"{_brl(valor_final)} ({_numero_extenso_basico(valor_final)})", bold=True)
    doc.add_paragraph()

    _add_paragrafo(doc, "FORMA DE PAGAMENTO:", bold=True)
    fp = forma_pagamento or [
        {"percentual": 50, "marco": "Na aprovação desta Proposta"},
        {"percentual": 25, "marco": "Envio dos Shades"},
        {"percentual": 25, "marco": "Envio HR - Imagens finais"},
    ]
    for parc in fp:
        _add_paragrafo(doc, f"{parc['percentual']}% - {parc['marco']}.")
    doc.add_paragraph()

    _add_titulo(doc, "3 – PRAZOS / SOLICITAÇÕES / CONSIDERAÇÕES / ENTREGAS", size=12)
    pr = prazos or {
        "shades": "20 (Vinte) dias",
        "primeiro_tiro": "15 (Quinze) dias após a aprovação dos Shades",
        "revisoes": "10 (Dez) dias para contemplar e enviar novos tiros",
    }
    _add_paragrafo(doc, f"Shades – {pr['shades']}")
    _add_paragrafo(doc, f"1º Tiro – {pr['primeiro_tiro']},")
    _add_paragrafo(doc, f"Revisões – {pr['revisoes']}.")
    _add_paragrafo(
        doc,
        "OBS: Prazos passam a contar após recebimento de todos os projetos, "
        "informações e aprovações de etapas para o desenvolvimento de cada item. "
        "Não iniciamos os trabalhos sem recebermos o DWG e aprovações necessárias dessa proposta.",
    )
    doc.add_paragraph()

    _add_paragrafo(doc, "SOLICITAÇÕES: Arquivos e definições necessários à execução do serviço.", bold=True)
    _add_paragrafo(doc, "Arquitetura: • Plantas • Elevação da Fachada • Estudo de Cores da Fachada • Cortes;")
    _add_paragrafo(
        doc,
        "Paisagismo: • Implantação • Detalhamentos • Especificação de Revestimentos • "
        "Estudo de Vegetação com Especificação de Espécies • Referências do Mobiliário;",
    )
    _add_paragrafo(
        doc,
        "Decoração: • Plantas com Layout • Desenhos de Pisos • Elevações de Paredes • "
        "Especificações de materiais • Projeto de Forro e Iluminação • Descrição ou book de mobiliários.",
    )
    doc.add_paragraph()

    _add_paragrafo(doc, "CONSIDERAÇÕES IMAGENS:", bold=True)
    consideracoes = [
        "Etapas e Tiros de Aprovação: Esta proposta contempla o envio inicial do tiro de Shade, seguido do tiro de apresentação denominado “R00”. Estão inclusas no escopo 03 (três) rodadas de revisões, denominadas “R01”, “R02” e “R03”, culminando na entrega final denominada “HR” (High Resolution).",
        "Ajustes Finos e Adicionais: Damos ênfase que, a partir do tiro “R00”, as rodadas seguintes consistem exclusivamente em ajustes finos. A partir de um eventual quarto tiro de apresentação (denominado “R04”), será cobrado um adicional de 25% do valor da imagem por tiro extra solicitado, bem como quaisquer tiros adicionais solicitados após a entrega do HR.",
        "Plataforma Oficial de Revisão: Para garantir a organização, a agilidade e a precisão técnica das refações, todo o processo de feedback, comentários e aprovações (tanto dos filmes quanto das imagens 3D) será realizado exclusivamente através do software especializado Frame.io/Adobe.",
        "Mecânica de Apontamentos: A Contratada fornecerá à Contratante um link de acesso seguro à plataforma. Através do Frame.io/Adobe, o cliente poderá inserir comentários, desenhar marcações, anexar informações (pdf, foto, dwg, etc) e solicitar ajustes exatamente no frame do vídeo ou no ponto específico da imagem estática que deseja alterar, eliminando ruídos de comunicação.",
        "Alterações de Projeto: Quaisquer alterações nos projetos originais (sejam de design de interiores, arquitetônico ou paisagismo) fornecidos inicialmente implicam em cobranças extras de modelagem, que serão orçadas e aprovadas em comum acordo.",
        "Refação e Remodelagem: No decorrer das rodadas de tiros, havendo mudanças significativas no projeto que resultem na perda de até 50% da imagem já construída (sendo necessária a remodelagem ou retrocesso na etapa de produção), o trabalho será considerado e cobrado como uma imagem nova.",
        "Paralisação do Projeto: Em caso de paralisação total ou parcial do escopo por um período de até 60 (sessenta) dias, deverá ser feito o acerto financeiro imediato das etapas já executadas. Para este cálculo de acerto, considera-se que cada tiro enviado após a aprovação do R00 corresponde a 25% do valor total da imagem.",
        "Cancelamento: Em caso de descontinuidade e cancelamento do produto ou lançamento por qualquer motivo por parte da Contratante, considera-se justa e devida a quitação integral do saldo previsto nesta proposta.",
        "Direitos de Uso: A Contratada cede à Contratante os direitos de uso das imagens produzidas para uso promocional em todo o seu material publicitário, única e exclusivamente vinculadas ao empreendimento contratado, não havendo débitos/atrasos financeiros.",
    ]
    for c in consideracoes:
        _add_paragrafo(doc, f"• {c}")
    doc.add_paragraph()

    _add_paragrafo(doc, "ENTREGA FINAL:", bold=True)
    entregas = [
        "Formato e Envio: Todo o material finalizado será enviado digitalmente via servidor FTP, link seguro para download ou cadastrados no Frame.io/Adobe.",
        "Resolução das Imagens Estáticas: As imagens finais (denominadas “HR”) serão entregues com 6000px em seu lado maior a 300dpi. Após a entrega do HR, o projeto é considerado concluído. Caso surja a necessidade de novas configurações nessa etapa, ficamos à disposição para avaliar e orçar as alterações como um novo serviço.",
        "Caso a Contratante necessite de imagens configuradas para impressões de até 1 (um) metro, a solicitação deve ser feita com antecedência à renderização final, sem custo adicional.",
        "Para imagens com medidas de impressão superiores a 1 (um) metro (como outdoors ou grandes painéis), favor consultar previamente os valores adicionais de render, com custo estimado de 20% do valor da imagem, consultar.",
        "Resolução das Animações/Filmes: Os passeios virtuais e filmes integrados serão entregues finalizados no formato Full HD a 30 FPS ou propostas via RINNO FILMS, consultar.",
    ]
    for e in entregas:
        _add_paragrafo(doc, f"• {e}")
    doc.add_paragraph()

    _add_paragrafo(doc, f"São Paulo, {_data_extenso(data)}.")
    _add_paragrafo(doc, "De acordo,")
    _add_paragrafo(doc, cliente["empresa"], bold=True)

    saida.parent.mkdir(parents=True, exist_ok=True)
    doc.save(saida)
    return saida
