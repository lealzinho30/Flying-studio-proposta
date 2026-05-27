// Geração do DOCX no navegador (docx.js) — layout Flying_Cliente_AnexoI_R00
// Modelo: PROPOSTA… / CLIENTE·PROJETO / A/C. · tabelas 2.x contínuas · investimento · seção 3 única

(function () {
  "use strict";

  function brl(valor) {
    const s = (Math.round(valor * 100) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `R$${s}`;
  }

  function valorNumerico(valor) {
    return (Math.round(valor * 100) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  function dataExtenso(d) {
    return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  const UN = ["", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove"];
  const DZ = ["", "", "Vinte", "Trinta", "Quarenta", "Cinquenta", "Sessenta", "Setenta", "Oitenta", "Noventa"];
  const CT = ["", "Cento", "Duzentos", "Trezentos", "Quatrocentos", "Quinhentos", "Seiscentos", "Setecentos", "Oitocentos", "Novecentos"];

  function ate999(n) {
    if (n === 0) return "";
    if (n === 100) return "Cem";
    const partes = [];
    const c = Math.floor(n / 100);
    const r = n % 100;
    if (c) partes.push(CT[c]);
    if (r < 20) {
      if (r) partes.push(UN[r]);
    } else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (u) partes.push(`${DZ[d]} e ${UN[u]}`);
      else partes.push(DZ[d]);
    }
    return partes.join(" e ");
  }

  function extenso(valor) {
    const inteiro = Math.round(valor);
    if (inteiro === 0) return "Zero Reais";
    const milhoes = Math.floor(inteiro / 1_000_000);
    const resto = inteiro % 1_000_000;
    const milhares = Math.floor(resto / 1000);
    const unid = resto % 1000;
    const blocos = [];
    if (milhoes) blocos.push(`${ate999(milhoes)} ${milhoes === 1 ? "Milhão" : "Milhões"}`);
    if (milhares) blocos.push(milhares === 1 ? "Mil" : `${ate999(milhares)} Mil`);
    if (unid) blocos.push(ate999(unid));
    const txt = blocos.length > 1 ? blocos.join(", ") : blocos[0];
    return `${txt} ${inteiro === 1 ? "Real" : "Reais"}`;
  }

  const COR = {
    primaria: "7C5CFF",
    texto: "000000",
    textoSoft: "333333",
    branco: "FFFFFF",
  };
  const FONTE = "Calibri Light";
  const TAM = 20; // docx: half-points → 10 pt
  const HIGHLIGHT = "yellow";

  // after/before em twips (1/20 pt). ~240 ≈ uma linha em 10 pt entre parágrafos.
  const SP = {
    corpo: 240,
    linha: 240,
    tituloSec: 240,
    entreSecoes: 240,
    bullet: 200,
  };

  // Logo oficial no cabeçalho (~4,5 cm).
  const LOGO_HEADER_LARGURA = 156;
  const PAGE = {
    top: 1701,
    bottom: 1304,
    left: 1417,
    right: 1417,
    header: 680,
    footer: 567,
  };

  const TBL = {
    fillSecao: "9484C4",
    margem: { top: 10, bottom: 10, left: 50, right: 50 },
    col: { item: 12, desc: 56, val: 32 },
  };

  function P(texto, opts = {}) {
    const { TextRun, Paragraph, UnderlineType } = window.docx;
    const textoLimpo = (texto || "").trim();
    if (!textoLimpo && !opts.forcar) return null;
    const runOpts = {
      text: texto,
      bold: !!opts.bold,
      italics: !!opts.italics,
      size: opts.size ?? TAM,
      color: opts.color || COR.texto,
      font: FONTE,
    };
    if (opts.highlight) runOpts.highlight = HIGHLIGHT;
    if (opts.underline) runOpts.underline = { type: UnderlineType.SINGLE };
    const spacing = {
      after: opts.after ?? SP.corpo,
      before: opts.before ?? 0,
      line: opts.line ?? SP.linha,
    };
    if (opts.lineRule) spacing.lineRule = opts.lineRule;
    return new Paragraph({
      spacing,
      alignment: opts.alignment,
      indent: opts.indent,
      children: [new TextRun(runOpts)],
    });
  }

  function PRich(runs, opts = {}) {
    const { Paragraph } = window.docx;
    return new Paragraph({
      spacing: { after: opts.after ?? SP.corpo, before: opts.before ?? 0, line: opts.line ?? SP.linha },
      alignment: opts.alignment,
      indent: opts.indent,
      children: runs,
    });
  }

  function R(texto, opts = {}) {
    const { TextRun, UnderlineType } = window.docx;
    const o = {
      text: texto,
      bold: !!opts.bold,
      italics: !!opts.italics,
      size: opts.size ?? TAM,
      color: opts.color || COR.texto,
      font: FONTE,
    };
    if (opts.highlight) o.highlight = HIGHLIGHT;
    if (opts.underline) o.underline = { type: UnderlineType.SINGLE };
    return new TextRun(o);
  }

  function secaoHeading(numero, titulo, opts = {}) {
    return P(`${numero} — ${titulo}`, {
      bold: true,
      size: TAM,
      after: SP.tituloSec,
      before: opts.before ?? 0,
    });
  }

  function tituloBloco(texto, opts = {}) {
    return P(texto, { bold: true, size: TAM, after: opts.after ?? SP.corpo, before: opts.before ?? 0, underline: !!opts.underline });
  }

  function bulletSimples(texto) {
    const { Paragraph, TextRun } = window.docx;
    return new Paragraph({
      spacing: { after: SP.bullet, line: SP.linha },
      indent: { left: 360, hanging: 180 },
      children: [
        new TextRun({ text: "• ", size: TAM, font: FONTE, color: COR.texto }),
        new TextRun({ text: texto, size: TAM, font: FONTE, color: COR.texto }),
      ],
    });
  }

  function bulletRotulo(rotulo, texto) {
    const { Paragraph, TextRun } = window.docx;
    return new Paragraph({
      spacing: { after: SP.bullet, line: SP.linha },
      indent: { left: 360, hanging: 180 },
      children: [
        new TextRun({ text: "• ", size: TAM, font: FONTE, color: COR.texto }),
        new TextRun({ text: `${rotulo}: `, bold: true, size: TAM, font: FONTE, color: COR.texto }),
        new TextRun({ text: texto, size: TAM, font: FONTE, color: COR.texto }),
      ],
    });
  }

  function linhaPctPagamento(pct, marco) {
    return P(`${pct}% - ${marco}`, { indent: { left: 720 }, after: SP.bullet });
  }

  async function fetchAsset(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 8000);
    try {
      return await fetch(url, { signal: ctrl.signal, cache: "force-cache" });
    } finally {
      clearTimeout(timer);
    }
  }

  async function carregarLogoHeader() {
    try {
      const resp = await fetchAsset("assets/flying_logo_header_exact.png", 12000);
      if (!resp.ok) throw new Error("logo http " + resp.status);
      const buffer = await resp.arrayBuffer();
      let naturalW = 610;
      let naturalH = 238;
      try {
        const bmp = await createImageBitmap(new Blob([buffer], { type: "image/png" }));
        naturalW = bmp.width;
        naturalH = bmp.height;
        bmp.close();
      } catch (_) { /* noop */ }
      const width = LOGO_HEADER_LARGURA;
      const height = Math.max(1, Math.round((width * naturalH) / naturalW));
      return { buffer, width, height };
    } catch (e) {
      console.warn("Logo do cabeçalho não carregou:", e);
      return null;
    }
  }

  /** Linha horizontal (borda inferior em parágrafo vazio). */
  function paragrafoLinha(cor, opts = {}) {
    const { Paragraph, TextRun, BorderStyle } = window.docx;
    return new Paragraph({
      spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
      border: {
        bottom: {
          color: cor,
          space: 1,
          style: BorderStyle.SINGLE,
          size: opts.size ?? 6,
        },
      },
      children: [new TextRun({ text: "" })],
    });
  }

  /**
   * Cabeçalho Flying (robusto no Word): logo oficial em parágrafo (sem célula) + linha abaixo.
   * Isso evita recorte do lado esquerdo da marca.
   */
  function montarHeader(logo) {
    const { Header, Paragraph, ImageRun, AlignmentType, TextRun } = window.docx;

    const pLogo = logo
      ? new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 80, after: 40 },
          children: [
            new ImageRun({
              data: logo.buffer,
              transformation: { width: logo.width, height: logo.height },
            }),
          ],
        })
      : new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: "FLYING studio", bold: true, size: 24, color: COR.primaria, font: FONTE })],
        });

    const pLinha = paragrafoLinha(TBL.fillSecao, { size: 6, before: 0, after: 0 });

    return new Header({ children: [pLogo, pLinha] });
  }


  // Alternativa robusta: desenha o "cabeçalho" no topo do corpo (sem usar Header do Word).
  function blocoTopoVisual(logo) {
    const { Paragraph, ImageRun, AlignmentType, TextRun } = window.docx;
    const partes = [];
    if (logo) {
      partes.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 40 },
        children: [new ImageRun({ data: logo.buffer, transformation: { width: logo.width, height: logo.height } })],
      }));
    } else {
      partes.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: "FLYING studio", bold: true, size: 24, color: COR.primaria, font: FONTE })],
      }));
    }
    partes.push(paragrafoLinha(TBL.fillSecao, { size: 6, before: 0, after: SP.corpo }));
    return partes;
  }

  /** Assinatura: data, “De acordo,”, espaço para rubrica, linha e cliente centralizado. */
  function blocoAssinatura(cliente, data) {
    const { AlignmentType, LineRuleType } = window.docx;
    const partes = [];
    const nomeCliente = (cliente.empresa || "CLIENTE").toUpperCase();

    partes.push(P(`São Paulo, ${dataExtenso(data)}.`, { before: SP.entreSecoes, after: SP.corpo }));
    partes.push(P("De acordo,", { after: SP.corpo }));

    for (let i = 0; i < 4; i += 1) {
      partes.push(P("", { forcar: true, after: 240, line: 240, lineRule: LineRuleType.EXACT }));
    }

    partes.push(paragrafoLinha(COR.texto, { after: 160, size: 6 }));
    partes.push(P(nomeCliente, {
      bold: true,
      alignment: AlignmentType.CENTER,
      after: 0,
    }));

    return partes.filter(Boolean);
  }

  function montarFooter() {
    const { Footer, Paragraph, TextRun, AlignmentType, BorderStyle } = window.docx;
    const linha = new Paragraph({
      spacing: { before: 30, after: 40 },
      border: { top: { color: COR.primaria, space: 1, style: BorderStyle.SINGLE, size: 8 } },
      children: [new TextRun({ text: "" })],
    });
    const site = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: "www.flyingstudio.com.br", size: TAM, color: COR.primaria, font: FONTE, bold: true })],
    });
    const endereco = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: "Av. Eng. Luís Carlos Berrini, 936, 7º andar - Novo Brooklin, São Paulo - Telefone: (11) 2351-4138",
        size: TAM,
        color: COR.textoSoft,
        font: FONTE,
      })],
    });
    return new Footer({ children: [linha, site, endereco] });
  }

  function tblBorda() {
    const { BorderStyle } = window.docx;
    return { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  }

  function tblCell(texto, opts = {}) {
    const { TableCell, Paragraph, TextRun, WidthType, ShadingType, AlignmentType } = window.docx;
    const b = tblBorda();
    const runs = opts.runs || [
      new TextRun({
        text: texto || "",
        bold: !!opts.bold,
        size: opts.size ?? TAM,
        color: opts.color || COR.texto,
        font: FONTE,
        highlight: opts.highlight ? HIGHLIGHT : undefined,
      }),
    ];
    return new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      columnSpan: opts.colSpan,
      shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
      verticalAlign: "center",
      margins: TBL.margem,
      borders: { top: b, bottom: b, left: b, right: b },
      children: [
        new Paragraph({
          alignment: opts.align || AlignmentType.LEFT,
          spacing: { before: 0, after: 0, line: 220 },
          children: runs,
        }),
      ],
    });
  }

  function cabecalhoProposta(cliente) {
    const emp = (cliente.empresa || "CLIENTE").toUpperCase();
    const ref = (cliente.ref || "PROJETO").toUpperCase();
    const contato = (cliente.contato || "—").trim();
    return [
      P("PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D", { bold: true, after: SP.corpo }),
      P(`${emp} — REF: ${ref}`, { bold: true, after: SP.corpo }),
      P(`A/C. ${contato}`, { bold: true, after: SP.entreSecoes }),
    ].filter(Boolean);
  }

  function coletarSubsecoesInvestimento(orc, extrasEstruturados) {
    const blocos = [];
    let secaoNum = 0;

    function add(titulo, categoria) {
      if (!categoria || !categoria.qtd) return;
      secaoNum += 1;
      blocos.push({
        numero: `2.${secaoNum}`,
        titulo,
        linhas: categoria.itens.map((it) => it.descricao_normalizada),
        qtd: categoria.qtd,
        total: categoria.total,
      });
    }

    add("ILUSTRAÇÕES EXTERNAS", orc.externas);
    add("ILUSTRAÇÕES INTERNAS", orc.internas);
    add("IMPLANTAÇÕES/PLANTAS HUMANIZADAS", orc.plantas);

    if (extrasEstruturados && extrasEstruturados.qtd > 0) {
      const grupos = [
        extrasEstruturados.tour_virtual,
        extrasEstruturados.filmes,
        extrasEstruturados.apps,
        extrasEstruturados.maquete,
        extrasEstruturados.drone,
        extrasEstruturados.estudo_fachada,
        extrasEstruturados.diversos,
      ];
      for (const grupo of grupos) {
        if (!grupo || !grupo.subsecoes || !grupo.subsecoes.length) continue;
        for (const sub of grupo.subsecoes) {
          secaoNum += 1;
          const titulo = (sub.rotulo_secao || sub.rotulo_curto || "SERVIÇO").toUpperCase();
          const itens = (sub.itens && sub.itens.length) ? sub.itens : [sub.rotulo_curto || titulo];
          blocos.push({
            numero: `2.${secaoNum}`,
            titulo,
            linhas: itens,
            qtd: itens.length,
            total: sub.preco,
            sem_preco: !!sub.sem_preco,
          });
        }
      }
    }
    return blocos;
  }

  function precoCelula(bloco) {
    if (bloco.sem_preco) return "A DEFINIR";
    return brl(bloco.total);
  }

  function linhasSubsecaoTabela(bloco) {
    const { TableRow, AlignmentType } = window.docx;
    const W = TBL.col;
    const rows = [];

    rows.push(new TableRow({
      children: [
        tblCell(`${bloco.numero} ${bloco.titulo}`, { colSpan: 3, fill: TBL.fillSecao, bold: true }),
      ],
    }));
    rows.push(new TableRow({
      children: [
        tblCell("Itens", { width: W.item, align: AlignmentType.CENTER }),
        tblCell("Descrição dos Serviços", { width: W.desc, colSpan: 2, align: AlignmentType.CENTER }),
      ],
    }));

    bloco.linhas.forEach((desc, idx) => {
      rows.push(new TableRow({
        children: [
          tblCell(`${bloco.numero}.${idx + 1}`, { width: W.item, align: AlignmentType.CENTER }),
          tblCell(desc, { width: W.desc, colSpan: 2 }),
        ],
      }));
    });

    rows.push(new TableRow({
      children: [
        tblCell(String(bloco.qtd), { width: W.item, align: AlignmentType.CENTER }),
        tblCell("Valor Total", { width: W.desc, bold: true }),
        tblCell(precoCelula(bloco), { width: W.val, bold: true, align: AlignmentType.RIGHT }),
      ],
    }));

    return rows;
  }

  function linhasTotaisFinaisTabela(totalItens, valorFinal) {
    const { TableRow, AlignmentType } = window.docx;
    const W = TBL.col;
    return [
      new TableRow({
        children: [
          tblCell(String(totalItens), { width: W.item, align: AlignmentType.CENTER }),
          tblCell("Valor Final", { width: W.desc, bold: true }),
          tblCell(brl(valorFinal), {
            width: W.val, bold: true, align: AlignmentType.RIGHT,
          }),
        ],
      }),
      new TableRow({
        children: [
          tblCell(`Valor Total do Projeto = ${brl(valorFinal)}`, {
            colSpan: 3, bold: true, align: AlignmentType.CENTER,
          }),
        ],
      }),
    ];
  }

  function tabelaInvestimentosContinua(blocos, totalItens, valorFinal) {
    const { Table, WidthType } = window.docx;
    const rows = [];
    for (const bloco of blocos) rows.push(...linhasSubsecaoTabela(bloco));
    if (blocos.length) rows.push(...linhasTotaisFinaisTabela(totalItens, valorFinal));
    if (!rows.length) return null;
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      margins: { top: 0, bottom: 0 },
    });
  }

  async function gerarDocxBlob({
    cliente, orc, data, mostrarPrecos, formaPagamento, prazos,
    descontoLabel, extras, extrasEstruturados,
  }) {
    const { Document, Packer } = window.docx;

    data = data || new Date();
    const headerLogo = await carregarLogoHeader();

    const subtotalImagens = orc.subtotal;
    const totalExtras = (extrasEstruturados && extrasEstruturados.total) || 0;
    const subtotal = subtotalImagens + totalExtras;
    const valorFinal = subtotal - subtotal * (orc.desconto_pct / 100);
    const qtdImagens = orc.total_imagens;
    const qtdExtras = (extrasEstruturados && extrasEstruturados.qtd) || 0;

    const blocosInvest = coletarSubsecoesInvestimento(orc, extrasEstruturados);
    const totalItens = qtdImagens + qtdExtras;
    const children = [];

    blocoTopoVisual(headerLogo).forEach((p) => children.push(p));
    cabecalhoProposta(cliente).forEach((p) => children.push(p));

    children.push(secaoHeading("1", "APRESENTAÇÃO FLYING STUDIO"));
    children.push(P(
      "A Flying Studio presta serviços de computação gráfica e tecnologias que se aplicam aos lançamentos imobiliários e remanescentes. Em nosso atendimento diário, desenvolvemos laços com projeto e auxiliamos em layout, estudos de projetos e fachadas, de decoração e paisagismo de acordo com cada necessidade.",
      { after: SP.corpo }
    ));
    children.push(P(
      "Para projetos de arquitetura, decoração e paisagismo, consulte a NID STUDIO.",
      { italics: true, after: SP.entreSecoes }
    ));

    children.push(secaoHeading("2", "ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:"));
    const tblInvest = tabelaInvestimentosContinua(blocosInvest, totalItens, valorFinal);
    if (tblInvest) children.push(tblInvest);

    if (blocosInvest.length) {
      children.push(tituloBloco("INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:", {
        before: SP.corpo,
        after: SP.corpo,
      }));
      children.push(PRich([
        R(brl(valorFinal), { bold: true }),
        R(` (${extenso(valorFinal)})`, {}),
      ], { after: SP.entreSecoes }));

      if (orc.desconto_pct > 0) {
        const rot = descontoLabel || `${orc.desconto_pct}% de desconto`;
        children.push(P(
          `Obs.: desconto ${rot} aplicado sobre o subtotal de ${brl(subtotal)}.`,
          { color: COR.textoSoft, after: SP.corpo }
        ));
      }
    }

    if (extras && extras.length) {
      for (const ex of extras) {
        const cortesia = ex.cortesia ? " (CORTESIA)" : "";
        const preco = ex.cortesia ? "" : ` — ${brl(ex.preco)}`;
        children.push(bulletSimples(`${ex.descricao}${preco}${cortesia}`));
      }
    }

    children.push(tituloBloco("FORMA DE PAGAMENTO:", { underline: true, before: SP.entreSecoes, after: SP.corpo }));
    const fp = formaPagamento || [
      { percentual: 50, marco: "Na aprovação desta Proposta" },
      { percentual: 25, marco: "Envio dos Shades" },
      { percentual: 25, marco: "Envio HR — Imagens finais" },
    ];
    for (const parc of fp) {
      children.push(linhaPctPagamento(parc.percentual, parc.marco));
    }

    children.push(secaoHeading("3", "PRAZOS / SOLICITAÇÕES / CONSIDERAÇÕES / ENTREGAS", { before: SP.entreSecoes }));

    const pr = prazos || {
      shades: "20 (Vinte) dias",
      primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades",
      revisoes: "10 (Dez) dias para contemplar e enviar novos tiros",
    };
    children.push(bulletRotulo("Shades", pr.shades));
    children.push(bulletRotulo("1º Tiro de Apresentação", pr.primeiro_tiro));
    children.push(bulletRotulo("Revisões", pr.revisoes));
    children.push(PRich([
      R("OBS: ", { bold: true }),
      R("Os prazos passam a contar após o recebimento de todos os projetos, informações e aprovações de etapas para o desenvolvimento de cada item. Não iniciamos os trabalhos sem o DWG e as aprovações necessárias desta proposta."),
    ], { after: SP.entreSecoes }));

    children.push(P("SOLICITAÇÕES: Arquivos e definições necessários à execução do serviço.", { bold: true, after: SP.corpo }));
    children.push(bulletRotulo("Arquitetura", "Plantas · Elevação da Fachada · Estudo de Cores da Fachada · Cortes."));
    children.push(bulletRotulo("Paisagismo", "Implantação · Detalhamentos · Especificação de Revestimentos · Estudo de Vegetação com Especificação de Espécies · Referências do Mobiliário."));
    children.push(bulletRotulo("Decoração", "Plantas com Layout · Desenhos de Pisos · Elevações de Paredes · Especificações de Materiais · Projeto de Forro e Iluminação · Descrição ou book de mobiliários."));

    children.push(P("CONSIDERAÇÕES IMAGENS:", { bold: true, before: SP.entreSecoes, after: SP.corpo }));
    const consideracoes = [
      ["Etapas e Tiros de Aprovação", "Esta proposta contempla o envio inicial do tiro de Shade, seguido do tiro de apresentação denominado \u201CR00\u201D. Estão inclusas no escopo 03 (três) rodadas de revisões, denominadas \u201CR01\u201D, \u201CR02\u201D e \u201CR03\u201D, culminando na entrega final denominada \u201CHR\u201D (High Resolution)."],
      ["Ajustes Finos e Adicionais", "A partir do tiro \u201CR00\u201D, as rodadas seguintes consistem exclusivamente em ajustes finos. A partir de um eventual quarto tiro de apresentação (\u201CR04\u201D), será cobrado um adicional de 25% do valor da imagem por tiro extra solicitado, bem como quaisquer tiros adicionais solicitados após a entrega do HR."],
      ["Plataforma Oficial de Revisão", "Para garantir a organização, a agilidade e a precisão técnica das refações, todo o processo de feedback, comentários e aprovações (filmes e imagens 3D) será realizado exclusivamente através do software Frame.io/Adobe."],
      ["Mecânica de Apontamentos", "A Contratada fornecerá à Contratante um link de acesso seguro à plataforma. Pelo Frame.io/Adobe, o cliente poderá inserir comentários, desenhar marcações, anexar informações (pdf, foto, dwg, etc.) e solicitar ajustes exatamente no frame do vídeo ou no ponto específico da imagem estática que deseja alterar."],
      ["Alterações de Projeto", "Quaisquer alterações nos projetos originais (sejam de design de interiores, arquitetônico ou paisagismo) fornecidos inicialmente implicam em cobranças extras de modelagem, que serão orçadas e aprovadas em comum acordo."],
      ["Refação e Remodelagem", "Havendo mudanças significativas no projeto que resultem na perda de até 50% da imagem já construída, o trabalho será considerado e cobrado como uma imagem nova."],
      ["Paralisação do Projeto", "Em caso de paralisação total ou parcial do escopo por um período de até 60 (sessenta) dias, deverá ser feito o acerto financeiro imediato das etapas já executadas. Considera-se que cada tiro enviado após a aprovação do R00 corresponde a 25% do valor total da imagem."],
      ["Cancelamento", "Em caso de descontinuidade e cancelamento do produto ou lançamento por qualquer motivo por parte da Contratante, considera-se justa e devida a quitação integral do saldo previsto nesta proposta."],
      ["Direitos de Uso", "A Contratada cede à Contratante os direitos de uso das imagens produzidas para uso promocional em todo o seu material publicitário, única e exclusivamente vinculadas ao empreendimento contratado, não havendo débitos/atrasos financeiros."],
    ];
    for (const [titulo, texto] of consideracoes) children.push(bulletRotulo(titulo, texto));

    children.push(P("ENTREGA FINAL:", { bold: true, before: SP.entreSecoes, after: SP.corpo }));
    const entregas = [
      ["Formato e Envio", "Todo o material finalizado será enviado digitalmente via servidor FTP, link seguro para download ou cadastrados no Frame.io/Adobe."],
      ["Resolução das Imagens Estáticas", "As imagens finais (\u201CHR\u201D) serão entregues com 6000px no lado maior a 300dpi. Após a entrega do HR, o projeto é considerado concluído. Caso surja a necessidade de novas configurações nessa etapa, ficamos à disposição para avaliar e orçar as alterações como um novo serviço."],
      ["Impressão de até 1m", "Caso a Contratante necessite de imagens configuradas para impressões de até 1 (um) metro, a solicitação deve ser feita com antecedência à renderização final, sem custo adicional."],
      ["Impressão acima de 1m", "Para outdoors ou grandes painéis (acima de 1m), favor consultar previamente os valores adicionais de render — custo estimado de 20% do valor da imagem."],
      ["Animações / Filmes", "Os passeios virtuais e filmes integrados serão entregues em Full HD a 30 FPS, ou propostas via RINNO FILMS, consultar."],
    ];
    for (const [titulo, texto] of entregas) children.push(bulletRotulo(titulo, texto));

    blocoAssinatura(cliente, data).forEach((p) => children.push(p));

    const doc = new Document({
      creator: "Flying Studio",
      title: `Proposta ${cliente.empresa} - ${cliente.ref}`,
      styles: {
        default: {
          document: {
            run: { font: FONTE, size: TAM, color: COR.texto },
            paragraph: { spacing: { after: SP.corpo, line: SP.linha } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: PAGE.top,
              bottom: PAGE.bottom,
              left: PAGE.left,
              right: PAGE.right,
              header: PAGE.header,
              footer: PAGE.footer,
            },
          },
        },
        footers: { default: montarFooter() },
        children,
      }],
    });

    return await Packer.toBlob(doc);
  }

  window.FlyingDocx = { gerarDocxBlob, brl, extenso };
})();
