// Geração do DOCX no navegador via biblioteca docx.js (UMD).
// Layout profissional com identidade Flying Studio (logo + paleta + tipografia).
//
// Paleta (timbrado oficial):
//   primary roxo:       #7C5CFF
//   primary roxo dark:  #5B3CFF
//   acento verde lima:  #C2F542
//   cinza texto:        #1F2330
//   cinza médio:        #5C6473
//   cinza light:        #E7E9EE
//   off-white:          #F7F8FB
//
// Endereço/contato (do timbrado):
//   www.flyingstudio.com.br
//   Av. Eng. Luís Carlos Berrini, 936, 7º andar - Novo Brooklin, São Paulo
//   Telefone: (11) 2351-4138

(function () {
  "use strict";

  // ---------- helpers de moeda / data / extenso ----------

  function brl(valor) {
    const s = (Math.round(valor * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `R$${s}`;
  }
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  function dataExtenso(d) { return `${String(d.getDate()).padStart(2, "0")} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; }

  const UN = ["", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito", "Dezenove"];
  const DZ = ["", "", "Vinte", "Trinta", "Quarenta", "Cinquenta", "Sessenta", "Setenta", "Oitenta", "Noventa"];
  const CT = ["", "Cento", "Duzentos", "Trezentos", "Quatrocentos", "Quinhentos", "Seiscentos", "Setecentos", "Oitocentos", "Novecentos"];
  function ate999(n) {
    if (n === 0) return "";
    if (n === 100) return "Cem";
    const partes = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c) partes.push(CT[c]);
    if (r < 20) {
      if (r) partes.push(UN[r]);
    } else {
      const d = Math.floor(r / 10), u = r % 10;
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

  // ---------- paleta ----------
  const COR = {
    primaria: "7C5CFF",
    primariaDark: "5B3CFF",
    acento: "9DDB1A",
    texto: "1F2330",
    textoSoft: "5C6473",
    cinzaLight: "E7E9EE",
    offWhite: "F7F8FB",
    branco: "FFFFFF",
  };
  const FONTE = "Calibri";

  // ---------- atalhos para geração ----------

  function P(texto, opts = {}) {
    const { TextRun, Paragraph } = window.docx;
    return new Paragraph({
      spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: opts.line ?? 300 },
      alignment: opts.alignment,
      indent: opts.indent,
      children: [new TextRun({
        text: texto,
        bold: !!opts.bold,
        italics: !!opts.italics,
        size: opts.size || 22,
        color: opts.color || COR.texto,
        font: FONTE,
      })],
    });
  }

  function PRich(runs, opts = {}) {
    const { Paragraph } = window.docx;
    return new Paragraph({
      spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: opts.line ?? 300 },
      alignment: opts.alignment,
      children: runs,
    });
  }

  function R(texto, opts = {}) {
    const { TextRun } = window.docx;
    return new TextRun({
      text: texto,
      bold: !!opts.bold,
      italics: !!opts.italics,
      size: opts.size || 22,
      color: opts.color || COR.texto,
      font: FONTE,
    });
  }

  function bullet(texto, opts = {}) {
    const { Paragraph, TextRun } = window.docx;
    return new Paragraph({
      spacing: { after: 60, line: 280 },
      indent: { left: 360, hanging: 200 },
      children: [
        new TextRun({ text: "•  ", color: COR.primaria, bold: true, size: 22, font: FONTE }),
        new TextRun({ text: texto, size: 22, color: COR.texto, font: FONTE }),
      ],
    });
  }

  function bulletRich(label, restoTexto) {
    const { Paragraph, TextRun } = window.docx;
    return new Paragraph({
      spacing: { after: 80, line: 280 },
      indent: { left: 360, hanging: 200 },
      children: [
        new TextRun({ text: "•  ", color: COR.primaria, bold: true, size: 22, font: FONTE }),
        new TextRun({ text: label + ": ", bold: true, size: 22, color: COR.texto, font: FONTE }),
        new TextRun({ text: restoTexto, size: 22, color: COR.texto, font: FONTE }),
      ],
    });
  }

  // ---------- header / footer ----------

  async function carregarLogoBuffer() {
    try {
      const resp = await fetch("assets/flying_logo.png");
      if (!resp.ok) throw new Error("logo http " + resp.status);
      return await resp.arrayBuffer();
    } catch (e) {
      console.warn("Logo não pôde ser carregado:", e);
      return null;
    }
  }

  function montarHeader(logoBuffer) {
    const { Header, Paragraph, ImageRun, AlignmentType, TextRun, BorderStyle } = window.docx;
    const children = [];

    // Logo no canto superior direito (se carregou)
    if (logoBuffer) {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 80 },
        children: [new ImageRun({
          data: logoBuffer,
          transformation: { width: 110, height: 43 }, // pixels — proporção do logo (305x119)
        })],
      }));
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "FLYING studio", bold: true, size: 28, color: COR.primaria, font: FONTE })],
      }));
    }

    // Linha lavanda fina abaixo
    children.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      border: { bottom: { color: COR.primaria, space: 1, style: BorderStyle.SINGLE, size: 8 } },
      children: [new TextRun({ text: "" })],
    }));

    return new Header({ children });
  }

  function montarFooter() {
    const { Footer, Paragraph, TextRun, AlignmentType, BorderStyle } = window.docx;

    // Linha fina lavanda
    const linha = new Paragraph({
      spacing: { before: 0, after: 60 },
      border: { top: { color: COR.primaria, space: 1, style: BorderStyle.SINGLE, size: 8 } },
      children: [new TextRun({ text: "" })],
    });

    const site = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: "www.flyingstudio.com.br", size: 18, color: COR.primaria, font: FONTE, bold: true })],
    });

    const endereco = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [new TextRun({
        text: "Av. Eng. Luís Carlos Berrini, 936, 7º andar  ·  Novo Brooklin, São Paulo  ·  Telefone: (11) 2351-4138",
        size: 16, color: COR.textoSoft, font: FONTE,
      })],
    });

    return new Footer({ children: [linha, site, endereco] });
  }

  // ---------- tabelas estilizadas ----------

  function tabelaCategoria(numero, categoria, mostraPrecos) {
    const { Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun, AlignmentType, ShadingType } = window.docx;

    const borderHidden = { style: BorderStyle.NONE, size: 0, color: COR.branco };
    const borderSoft = { style: BorderStyle.SINGLE, size: 4, color: COR.cinzaLight };

    function cell(text, opts = {}) {
      return new TableCell({
        width: { size: opts.width || 30, type: WidthType.PERCENTAGE },
        shading: opts.shading ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shading } : undefined,
        verticalAlign: "center",
        margins: { top: 110, bottom: 110, left: 160, right: 160 },
        borders: {
          top: opts.borderTop ?? borderSoft,
          bottom: opts.borderBottom ?? borderSoft,
          left: borderHidden, right: borderHidden,
        },
        children: [new Paragraph({
          alignment: opts.alignment || AlignmentType.LEFT,
          spacing: { before: 0, after: 0, line: 240 },
          children: [new TextRun({ text, bold: !!opts.bold, size: opts.size || 22, color: opts.color || COR.texto, font: FONTE })],
        })],
      });
    }

    const linhas = [];

    // Cabeçalho (roxo + texto branco)
    const cabec = mostraPrecos
      ? new TableRow({ tableHeader: true, children: [
          cell("ITEM", { bold: true, color: COR.branco, shading: COR.primaria, width: 12, size: 18 }),
          cell("DESCRIÇÃO DO SERVIÇO", { bold: true, color: COR.branco, shading: COR.primaria, width: 64, size: 18 }),
          cell("VALOR", { bold: true, color: COR.branco, shading: COR.primaria, width: 24, size: 18, alignment: AlignmentType.RIGHT }),
        ]})
      : new TableRow({ tableHeader: true, children: [
          cell("ITEM", { bold: true, color: COR.branco, shading: COR.primaria, width: 15, size: 18 }),
          cell("DESCRIÇÃO DO SERVIÇO", { bold: true, color: COR.branco, shading: COR.primaria, width: 85, size: 18 }),
        ]});
    linhas.push(cabec);

    // Linhas (zebra)
    categoria.itens.forEach((it, idx) => {
      const zebra = idx % 2 === 1 ? COR.offWhite : null;
      const cells = mostraPrecos
        ? [
            cell(`${numero}.${idx + 1}`, { width: 12, color: COR.primariaDark, bold: true, shading: zebra }),
            cell(it.descricao_normalizada, { width: 64, shading: zebra }),
            cell(brl(it.preco), { width: 24, alignment: AlignmentType.RIGHT, bold: true, shading: zebra }),
          ]
        : [
            cell(`${numero}.${idx + 1}`, { width: 15, color: COR.primariaDark, bold: true, shading: zebra }),
            cell(it.descricao_normalizada, { width: 85, shading: zebra }),
          ];
      linhas.push(new TableRow({ children: cells }));
    });

    // Rodapé (subtotal da categoria)
    const rodape = mostraPrecos
      ? new TableRow({ children: [
          cell(`${categoria.qtd}`, { bold: true, color: COR.branco, shading: COR.primariaDark, width: 12 }),
          cell("Subtotal", { bold: true, color: COR.branco, shading: COR.primariaDark, width: 64 }),
          cell(brl(categoria.total), { bold: true, color: COR.branco, shading: COR.primariaDark, width: 24, alignment: AlignmentType.RIGHT }),
        ]})
      : new TableRow({ children: [
          cell(`${categoria.qtd}`, { bold: true, color: COR.branco, shading: COR.primariaDark, width: 15 }),
          cell(`Subtotal     ${brl(categoria.total)}`, { bold: true, color: COR.branco, shading: COR.primariaDark, width: 85 }),
        ]});
    linhas.push(rodape);

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: linhas,
      borders: {
        top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden,
        insideHorizontal: borderSoft,
        insideVertical: borderHidden,
      },
    });
  }

  // ---------- caixa de "investimento total" (capa) ----------

  function caixaResumoCapa({ cliente, qtdImg, qtdExtras, valorBruto, valorFinal, descontoPct, descontoLabel }) {
    const { Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, ShadingType, BorderStyle } = window.docx;
    const borderHidden = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

    function row(label, valor, opts = {}) {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: COR.primaria },
            margins: { top: 110, bottom: 110, left: 200, right: 100 },
            borders: { top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 18, color: COR.branco, font: FONTE })],
            })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: opts.destaque ? COR.primariaDark : COR.primaria },
            margins: { top: 110, bottom: 110, left: 100, right: 200 },
            borders: { top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                text: valor,
                bold: true,
                size: opts.destaque ? 32 : 22,
                color: opts.destaque ? COR.acento : COR.branco,
                font: FONTE,
              })],
            })],
          }),
        ],
      });
    }

    const linhas = [
      row("CLIENTE", cliente.empresa.toUpperCase()),
      row("PROJETO", cliente.ref.toUpperCase()),
      row("AOS CUIDADOS DE", cliente.contato.toUpperCase()),
    ];
    if (qtdImg > 0) linhas.push(row("IMAGENS", `${qtdImg} unidades`));
    if (qtdExtras && qtdExtras > 0) linhas.push(row("SERVIÇOS EXTRAS", `${qtdExtras} ${qtdExtras === 1 ? "item" : "itens"}`));
    if (descontoPct > 0) {
      linhas.push(row("VALOR BRUTO", brl(valorBruto)));
      linhas.push(row(`DESCONTO (${descontoLabel || (descontoPct + "%")})`, "-" + brl(valorBruto - valorFinal)));
    }
    linhas.push(row("INVESTIMENTO", brl(valorFinal), { destaque: true }));

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: linhas,
      borders: { top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden, insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: COR.primariaDark }, insideVertical: borderHidden },
    });
  }

  // ---------- DOCUMENTO PRINCIPAL ----------

  // ---------- tabela de subseção EXTRA (Tour Virtual, Filme, App, etc) ----------
  // Estilo idêntico aos screenshots: header roxo claro com título da subseção,
  // linhas internas com numeração 2.X.Y, valor total ao final.
  function tabelaExtraSubsecao(numero, subsec) {
    const { Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun, AlignmentType, ShadingType } = window.docx;
    const borderHidden = { style: BorderStyle.NONE, size: 0, color: COR.branco };
    const borderSoft = { style: BorderStyle.SINGLE, size: 4, color: COR.cinzaLight };

    function cell(text, opts = {}) {
      return new TableCell({
        width: { size: opts.width || 30, type: WidthType.PERCENTAGE },
        shading: opts.shading ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shading } : undefined,
        verticalAlign: "center",
        margins: { top: 110, bottom: 110, left: 160, right: 160 },
        borders: {
          top: opts.borderTop ?? borderSoft,
          bottom: opts.borderBottom ?? borderSoft,
          left: borderHidden, right: borderHidden,
        },
        children: [new Paragraph({
          alignment: opts.alignment || AlignmentType.LEFT,
          spacing: { before: 0, after: 0, line: 240 },
          children: [new TextRun({ text, bold: !!opts.bold, size: opts.size || 22, color: opts.color || COR.texto, font: FONTE })],
        })],
      });
    }

    const rows = [];

    // Cabeçalho da subseção (fundo roxo claro com TÍTULO COMPLETO)
    rows.push(new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "EFEBFF" }, // roxo bem claro
          margins: { top: 130, bottom: 130, left: 200, right: 200 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: COR.primaria },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: COR.primaria },
            left: borderHidden, right: borderHidden,
          },
          children: [new Paragraph({
            children: [
              new TextRun({ text: `${numero}  `, bold: true, size: 22, color: COR.primariaDark, font: FONTE }),
              new TextRun({ text: subsec.rotulo_secao, bold: true, size: 22, color: COR.primariaDark, font: FONTE }),
            ],
          })],
          columnSpan: 2,
        }),
      ],
    }));

    // Cabeçalho colunas (cinza escuro)
    rows.push(new TableRow({
      children: [
        cell("Itens", { bold: true, width: 18, size: 18, color: COR.textoSoft }),
        cell("Descrição dos Serviços", { bold: true, width: 82, size: 18, color: COR.textoSoft }),
      ],
    }));

    // Itens
    const itens = (subsec.itens && subsec.itens.length) ? subsec.itens : [subsec.rotulo_curto];
    itens.forEach((it, idx) => {
      rows.push(new TableRow({
        children: [
          cell(`${numero}.${idx + 1}`, { width: 18, color: COR.primariaDark, bold: true }),
          cell(it, { width: 82 }),
        ],
      }));
    });

    // Rodapé com valor total
    if (subsec.sem_preco) {
      rows.push(new TableRow({
        children: [
          cell(String(itens.length), { bold: true, width: 18, color: COR.branco, shading: COR.primariaDark }),
          cell("Valor Total — A DEFINIR", { bold: true, width: 82, color: COR.branco, shading: COR.primariaDark }),
        ],
      }));
    } else {
      rows.push(new TableRow({
        children: [
          cell(String(itens.length), { bold: true, width: 18, color: COR.branco, shading: COR.primariaDark }),
          new TableCell({
            width: { size: 82, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: COR.primariaDark },
            margins: { top: 110, bottom: 110, left: 160, right: 160 },
            borders: { top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden },
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Valor Total", bold: true, size: 22, color: COR.branco, font: FONTE }),
                new TextRun({ text: "                                                                                                            ", size: 22 }),
                new TextRun({ text: brl(subsec.preco), bold: true, size: 22, color: COR.branco, font: FONTE }),
              ],
            })],
          }),
        ],
      }));
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: borderHidden, bottom: borderHidden, left: borderHidden, right: borderHidden,
        insideHorizontal: borderSoft, insideVertical: borderHidden,
      },
    });
  }

  async function gerarDocxBlob({ cliente, orc, data, mostrarPrecos, formaPagamento, prazos, descontoLabel, extras, extrasEstruturados }) {
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak,
      LevelFormat,
    } = window.docx;

    data = data || new Date();
    const logoBuffer = await carregarLogoBuffer();

    // Subtotal de imagens + extras estruturados
    const subtotalImagens = orc.subtotal;
    const totalExtras = (extrasEstruturados && extrasEstruturados.total) || 0;
    const subtotal = subtotalImagens + totalExtras;
    const descontoValor = subtotal * (orc.desconto_pct / 100);
    const valorFinal = subtotal - descontoValor;
    const qtdImagens = orc.total_imagens;
    const qtdExtras = (extrasEstruturados && extrasEstruturados.qtd) || 0;

    const children = [];

    // ===== CAPA =====
    children.push(P("PROPOSTA COMERCIAL", { bold: true, size: 56, color: COR.primaria, before: 800, after: 60 }));
    children.push(P("Imagens, Filmes e Tecnologias 3D", { size: 26, color: COR.textoSoft, after: 600 }));
    children.push(P(dataExtenso(data).toUpperCase(), { size: 18, color: COR.textoSoft, after: 800 }));

    // Caixa cliente / investimento
    children.push(caixaResumoCapa({
      cliente,
      qtdImg: qtdImagens,
      qtdExtras,
      valorBruto: subtotal,
      valorFinal,
      descontoPct: orc.desconto_pct,
      descontoLabel,
    }));
    children.push(P("", { after: 200 }));

    children.push(P(`Por extenso: ${extenso(valorFinal)}.`, { italics: true, size: 18, color: COR.textoSoft, alignment: AlignmentType.CENTER, after: 600 }));

    // Quebra de página
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ===== PÁGINA 2: APRESENTAÇÃO =====
    children.push(P("01.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("APRESENTAÇÃO", { bold: true, size: 36, color: COR.texto, after: 240 }));

    children.push(P(
      "A Flying Studio presta serviços de computação gráfica e tecnologias que se aplicam aos lançamentos imobiliários e remanescentes. Em nosso atendimento diário, desenvolvemos laços com projeto e auxiliamos em layout, estudos de projetos e fachadas, de decoração e paisagismo de acordo com cada necessidade.",
      { color: COR.textoSoft, after: 200 }
    ));
    children.push(P(
      "Para projetos de arquitetura, decoração e paisagismo, consulte a NID STUDIO.",
      { color: COR.textoSoft, italics: true, after: 600 }
    ));

    // ===== PÁGINA 2: ITENS / INVESTIMENTO =====
    children.push(P("02.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("ITENS A SEREM DESENVOLVIDOS", { bold: true, size: 36, color: COR.texto, after: 320 }));

    let secaoNum = 0;
    if (orc.externas.qtd) {
      secaoNum++;
      children.push(P("ILUSTRAÇÕES EXTERNAS", { bold: true, size: 22, color: COR.primariaDark, after: 120, before: 200 }));
      children.push(tabelaCategoria(`2.${secaoNum}`, orc.externas, mostrarPrecos));
      children.push(P("", { after: 200 }));
    }
    if (orc.internas.qtd) {
      secaoNum++;
      children.push(P("ILUSTRAÇÕES INTERNAS", { bold: true, size: 22, color: COR.primariaDark, after: 120, before: 200 }));
      children.push(tabelaCategoria(`2.${secaoNum}`, orc.internas, mostrarPrecos));
      children.push(P("", { after: 200 }));
    }
    if (orc.plantas.qtd) {
      secaoNum++;
      children.push(P("PLANTAS HUMANIZADAS", { bold: true, size: 22, color: COR.primariaDark, after: 120, before: 200 }));
      children.push(tabelaCategoria(`2.${secaoNum}`, orc.plantas, mostrarPrecos));
      children.push(P("", { after: 200 }));
    }

    // ====== EXTRAS (Tour Virtual / Filmes / Apps / Maquete / Drone / Estudo Fachada) ======
    if (extrasEstruturados && extrasEstruturados.qtd > 0) {
      const grupos = [
        ["tour_virtual", extrasEstruturados.tour_virtual],
        ["filmes", extrasEstruturados.filmes],
        ["apps", extrasEstruturados.apps],
        ["maquete", extrasEstruturados.maquete],
        ["drone", extrasEstruturados.drone],
        ["estudo_fachada", extrasEstruturados.estudo_fachada],
        ["diversos", extrasEstruturados.diversos],
      ];
      for (const [_chave, grupo] of grupos) {
        if (!grupo || !grupo.subsecoes.length) continue;
        for (const sub of grupo.subsecoes) {
          secaoNum++;
          children.push(tabelaExtraSubsecao(`2.${secaoNum}`, sub));
          children.push(P("", { after: 160 }));
        }
      }
    }

    // Totais
    const totaisRuns = [];
    if (qtdImagens) {
      totaisRuns.push(R("Imagens: ", { color: COR.textoSoft }));
      totaisRuns.push(R(`${qtdImagens}`, { bold: true }));
    }
    if (qtdExtras) {
      if (totaisRuns.length) totaisRuns.push(R("    ·    ", { color: COR.textoSoft }));
      totaisRuns.push(R("Serviços extras: ", { color: COR.textoSoft }));
      totaisRuns.push(R(`${qtdExtras}`, { bold: true }));
    }
    if (totaisRuns.length) totaisRuns.push(R("    ·    ", { color: COR.textoSoft }));
    totaisRuns.push(R("Valor bruto: ", { color: COR.textoSoft }));
    totaisRuns.push(R(brl(subtotal), { bold: true }));
    children.push(PRich(totaisRuns, { before: 240, after: 60 }));

    if (orc.desconto_pct > 0) {
      const rotulo = descontoLabel || `${orc.desconto_pct}% de Desconto`;
      children.push(PRich(
        [
          R("Desconto aplicado: ", { color: COR.textoSoft }),
          R(rotulo, { bold: true }),
          R("    ·    Valor do desconto: ", { color: COR.textoSoft }),
          R("-" + brl(descontoValor), { bold: true, color: COR.primariaDark }),
        ],
        { after: 60 }
      ));
    }

    children.push(P("", { after: 100 }));

    // Faixa "Investimento total" destacada
    children.push(PRich(
      [R("INVESTIMENTO TOTAL  ", { bold: true, size: 26, color: COR.primaria }),
       R(brl(valorFinal), { bold: true, size: 36, color: COR.primariaDark })],
      { alignment: AlignmentType.LEFT, after: 60 }
    ));
    children.push(P(`(${extenso(valorFinal)})`, { italics: true, color: COR.textoSoft, after: 400 }));

    // Extras
    if (extras && extras.length) {
      children.push(P("EXTRAS / FILMES", { bold: true, size: 22, color: COR.primariaDark, after: 120, before: 200 }));
      for (const ex of extras) {
        const cortesia = ex.cortesia ? " (CORTESIA)" : "";
        const preco = ex.cortesia ? "" : ` — ${brl(ex.preco)}`;
        children.push(bullet(`${ex.descricao}${preco}${cortesia}`));
      }
      children.push(P("", { after: 200 }));
    }

    // ===== PÁGINA 3: FORMA DE PAGAMENTO + PRAZOS =====
    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(P("03.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("FORMA DE PAGAMENTO", { bold: true, size: 36, color: COR.texto, after: 240 }));

    const fp = formaPagamento || [
      { percentual: 50, marco: "Na aprovação desta Proposta" },
      { percentual: 25, marco: "Envio dos Shades" },
      { percentual: 25, marco: "Envio HR — Imagens finais" },
    ];
    for (const parc of fp) {
      const valorParc = valorFinal * (parc.percentual / 100);
      children.push(bulletRich(`${parc.percentual}%  (${brl(valorParc)})`, parc.marco));
    }
    children.push(P("", { after: 400 }));

    children.push(P("04.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("PRAZOS DE ENTREGA", { bold: true, size: 36, color: COR.texto, after: 240 }));

    const pr = prazos || { shades: "20 (Vinte) dias", primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" };
    children.push(bulletRich("Shades", pr.shades));
    children.push(bulletRich("1º Tiro de Apresentação", pr.primeiro_tiro));
    children.push(bulletRich("Revisões", pr.revisoes));
    children.push(P("Os prazos passam a contar após o recebimento de todos os projetos, informações e aprovações de etapas para o desenvolvimento de cada item. Não iniciamos os trabalhos sem o DWG e as aprovações necessárias desta proposta.",
      { italics: true, size: 18, color: COR.textoSoft, before: 160, after: 400 }));

    // ===== PÁGINA 4: SOLICITAÇÕES DE PROJETO =====
    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(P("05.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("MATERIAIS NECESSÁRIOS", { bold: true, size: 36, color: COR.texto, after: 240 }));

    children.push(bulletRich("Arquitetura", "Plantas · Elevação da Fachada · Estudo de Cores da Fachada · Cortes."));
    children.push(bulletRich("Paisagismo", "Implantação · Detalhamentos · Especificação de Revestimentos · Estudo de Vegetação com Especificação de Espécies · Referências do Mobiliário."));
    children.push(bulletRich("Decoração", "Plantas com Layout · Desenhos de Pisos · Elevações de Paredes · Especificações de Materiais · Projeto de Forro e Iluminação · Descrição ou book de mobiliários."));
    children.push(P("", { after: 400 }));

    // ===== CONSIDERAÇÕES =====
    children.push(P("06.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("CONSIDERAÇÕES", { bold: true, size: 36, color: COR.texto, after: 240 }));

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
    for (const [titulo, texto] of consideracoes) children.push(bulletRich(titulo, texto));
    children.push(P("", { after: 400 }));

    // ===== ENTREGA FINAL =====
    children.push(P("07.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("ENTREGA FINAL", { bold: true, size: 36, color: COR.texto, after: 240 }));

    const entregas = [
      ["Formato e Envio", "Todo o material finalizado será enviado digitalmente via servidor FTP, link seguro para download ou cadastrados no Frame.io/Adobe."],
      ["Resolução das Imagens Estáticas", "As imagens finais (\u201CHR\u201D) serão entregues com 6000px no lado maior a 300dpi. Após a entrega do HR, o projeto é considerado concluído. Caso surja a necessidade de novas configurações nessa etapa, ficamos à disposição para avaliar e orçar como um novo serviço."],
      ["Impressão de até 1m", "Caso a Contratante necessite de imagens configuradas para impressões de até 1 (um) metro, a solicitação deve ser feita com antecedência à renderização final, sem custo adicional."],
      ["Impressão acima de 1m", "Para outdoors ou grandes painéis (acima de 1m), favor consultar previamente os valores adicionais de render — custo estimado de 20% do valor da imagem."],
      ["Animações / Filmes", "Os passeios virtuais e filmes integrados serão entregues em Full HD a 30 FPS, ou propostas via RINNO FILMS, consultar."],
    ];
    for (const [titulo, texto] of entregas) children.push(bulletRich(titulo, texto));
    children.push(P("", { after: 600 }));

    // ===== ASSINATURA =====
    children.push(P(`São Paulo, ${dataExtenso(data)}.`, { color: COR.textoSoft, after: 600 }));
    children.push(P("De acordo,", { after: 800 }));
    children.push(P("____________________________________________________", { color: COR.textoSoft, after: 60 }));
    children.push(P(cliente.empresa.toUpperCase(), { bold: true, size: 24, color: COR.primaria, after: 60 }));
    children.push(P(`A/C: ${cliente.contato}`, { color: COR.textoSoft, size: 18 }));

    // ===== DOCUMENTO =====
    const doc = new Document({
      creator: "Flying Studio",
      title: `Proposta ${cliente.empresa} - ${cliente.ref}`,
      description: "Proposta comercial Flying Studio",
      styles: {
        default: {
          document: { run: { font: FONTE, size: 22, color: COR.texto } },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1700, bottom: 1300, left: 1418, right: 1418, header: 720, footer: 600 },
          },
        },
        headers: { default: montarHeader(logoBuffer) },
        footers: { default: montarFooter() },
        children,
      }],
    });

    return await Packer.toBlob(doc);
  }

  window.FlyingDocx = { gerarDocxBlob, brl, extenso };
})();
