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

  // Espaçamento compacto (valores em twips; ~20 twips ≈ 1pt)
  const SP = {
    corpo: 10,
    linha: 220,
    tituloSec: 40,
    subtitulo: 20,
    entreBlocos: 28,
    entreSecoes: 40,
  };
  const TBL = {
    fillTitulo: "EFEBFF",
    fillRodape: "5B3CFF",
    margem: { top: 12, bottom: 12, left: 50, right: 50 },
    borda: { style: "single", size: 4, color: "000000" },
  };

  // ---------- atalhos para geração ----------

  function P(texto, opts = {}) {
    const { TextRun, Paragraph } = window.docx;
    const textoLimpo = (texto || "").trim();
    if (!textoLimpo && !opts.forcar) return null;
    return new Paragraph({
      spacing: { after: opts.after ?? SP.corpo, before: opts.before ?? 0, line: opts.line ?? SP.linha },
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
      spacing: { after: opts.after ?? SP.corpo, before: opts.before ?? 0, line: opts.line ?? SP.linha },
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
      spacing: { after: 16, line: SP.linha },
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
      spacing: { after: 16, line: SP.linha },
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
        spacing: { before: 0, after: 60 },
        children: [new ImageRun({
          data: logoBuffer,
          transformation: { width: 150, height: 59 },
        })],
      }));
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "FLYING studio", bold: true, size: 32, color: COR.primaria, font: FONTE })],
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
      spacing: { before: 40, after: 50 },
      border: { top: { color: COR.primaria, space: 1, style: BorderStyle.SINGLE, size: 10 } },
      children: [new TextRun({ text: "" })],
    });

    const site = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 24 },
      children: [new TextRun({ text: "www.flyingstudio.com.br", size: 24, color: COR.primaria, font: FONTE, bold: true })],
    });

    const endereco = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({
        text: "Av. Eng. Luís Carlos Berrini, 936, 7º andar  ·  Novo Brooklin, São Paulo  ·  Telefone: (11) 2351-4138",
        size: 20, color: COR.textoSoft, font: FONTE,
      })],
    });

    return new Footer({ children: [linha, site, endereco] });
  }

  // ---------- tabelas (modelo Flying: lavanda + Itens | Descrição | Valor) ----------

  function tblBorda() {
    const { BorderStyle } = window.docx;
    return { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  }

  function tblCell(texto, opts = {}) {
    const { TableCell, Paragraph, TextRun, WidthType, ShadingType, AlignmentType } = window.docx;
    const b = tblBorda();
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
          spacing: { before: 0, after: 0, line: SP.linha },
          children: [
            new TextRun({
              text: texto || "",
              bold: !!opts.bold,
              size: opts.size || 20,
              color: opts.color || COR.texto,
              font: FONTE,
            }),
          ],
        }),
      ],
    });
  }

  function tblWrap(rows) {
    const { Table, WidthType } = window.docx;
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      margins: { top: 40, bottom: 40 },
    });
  }

  /** Seção 2.x — cabeçalho lavanda, itens sem preço na linha, total na última linha. */
  function tabelaCategoria(numero, tituloSecao, categoria) {
    const { TableRow, AlignmentType } = window.docx;
    const W = { item: 14, desc: 56, val: 30 };
    const rows = [];

    rows.push(new TableRow({
      children: [
        tblCell(`${numero} ${tituloSecao.toUpperCase()}`, {
          colSpan: 3, fill: TBL.fillTitulo, bold: true, size: 20,
        }),
      ],
    }));
    rows.push(new TableRow({
      children: [
        tblCell("Itens", { width: W.item, bold: true, size: 18, color: COR.textoSoft }),
        tblCell("Descrição dos Serviços", { width: W.desc, bold: true, size: 18, color: COR.textoSoft }),
        tblCell("", { width: W.val }),
      ],
    }));

    categoria.itens.forEach((it, idx) => {
      rows.push(new TableRow({
        children: [
          tblCell(`${numero}.${idx + 1}`, { width: W.item, bold: true, color: COR.primariaDark }),
          tblCell(it.descricao_normalizada, { width: W.desc }),
          tblCell("", { width: W.val }),
        ],
      }));
    });

    rows.push(new TableRow({
      children: [
        tblCell(String(categoria.qtd), { width: W.item, bold: true, fill: TBL.fillRodape, color: COR.branco }),
        tblCell("Valor Total", { width: W.desc, bold: true, fill: TBL.fillRodape, color: COR.branco }),
        tblCell(brl(categoria.total), {
          width: W.val, bold: true, fill: TBL.fillRodape, color: COR.branco, align: AlignmentType.RIGHT,
        }),
      ],
    }));

    return tblWrap(rows);
  }

  /**
   * Totais do projeto (somente layout/posicionamento).
   * Ajusta o texto para o padrão Flying Studio (sem copiar frases do exemplo).
   */
  function renderTotaisProjeto(subtotal, descontoPct, valorFinal, descontoLabel) {
    const descontoValor = subtotal - valorFinal;
    const rot = descontoLabel || `${descontoPct}% de desconto`;

    const out = [];
    out.push(
      P(`INVESTIMENTO TOTAL: ${brl(valorFinal)}`, {
        bold: true,
        size: 20,
        color: COR.textoSoft,
        alignment: window.docx.AlignmentType.CENTER,
        after: 10,
      })
    );
    if (descontoPct > 0) {
      out.push(
        P(`Desconto aplicado (${rot}): -${brl(descontoValor)}`, {
          size: 18,
          color: COR.textoSoft,
          alignment: window.docx.AlignmentType.CENTER,
          after: 10,
        })
      );
    }
    return out;
  }

  /** Capa: cliente / projeto / contato em texto simples (sem caixa roxa). */
  function paragrafosCapaIdentificacao(cliente) {
    const out = [];
    const emp = (cliente.empresa || "CLIENTE").toUpperCase();
    const ref = (cliente.ref || "PROJETO").toUpperCase();
    const contato = (cliente.contato || "").trim();

    out.push(P(emp, { bold: true, size: 44, color: COR.texto, after: SP.subtitulo }));
    out.push(P(ref, { bold: true, size: 32, color: COR.primaria, after: SP.subtitulo }));
    if (contato && contato !== "—") {
      out.push(P(`A/C: ${contato}`, { size: 20, color: COR.textoSoft, after: SP.entreBlocos }));
    }
    return out.filter(Boolean);
  }

  // ---------- DOCUMENTO PRINCIPAL ----------

  function tabelaExtraSubsecao(numero, subsec) {
    const { TableRow, AlignmentType } = window.docx;
    const W = { item: 14, desc: 56, val: 30 };
    const titulo = subsec.rotulo_secao || subsec.rotulo_curto || "SERVIÇO";
    const rows = [];

    rows.push(new TableRow({
      children: [
        tblCell(`${numero} ${titulo.toUpperCase()}`, { colSpan: 3, fill: TBL.fillTitulo, bold: true, size: 20 }),
      ],
    }));
    rows.push(new TableRow({
      children: [
        tblCell("Itens", { width: W.item, bold: true, size: 18, color: COR.textoSoft }),
        tblCell("Descrição dos Serviços", { width: W.desc, bold: true, size: 18, color: COR.textoSoft }),
        tblCell("", { width: W.val }),
      ],
    }));

    const itens = (subsec.itens && subsec.itens.length) ? subsec.itens : [subsec.rotulo_curto || titulo];
    itens.forEach((it, idx) => {
      rows.push(new TableRow({
        children: [
          tblCell(`${numero}.${idx + 1}`, { width: W.item, bold: true, color: COR.primariaDark }),
          tblCell(it, { width: W.desc }),
          tblCell("", { width: W.val }),
        ],
      }));
    });

    const precoTxt = subsec.sem_preco ? "A DEFINIR" : brl(subsec.preco);
    rows.push(new TableRow({
      children: [
        tblCell(String(itens.length), { width: W.item, bold: true, fill: TBL.fillRodape, color: COR.branco }),
        tblCell("Valor Total", { width: W.desc, bold: true, fill: TBL.fillRodape, color: COR.branco }),
        tblCell(precoTxt, { width: W.val, bold: true, fill: TBL.fillRodape, color: COR.branco, align: AlignmentType.RIGHT }),
      ],
    }));

    return tblWrap(rows);
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
    children.push(P("PROPOSTA COMERCIAL", { bold: true, size: 52, color: COR.primaria, before: 0, after: SP.subtitulo }));
    children.push(P("Imagens, Filmes e Tecnologias 3D", { size: 24, color: COR.textoSoft, after: SP.subtitulo }));
    children.push(P(dataExtenso(data).toUpperCase(), { size: 18, color: COR.textoSoft, after: SP.entreBlocos }));
    paragrafosCapaIdentificacao(cliente).forEach((p) => children.push(p));

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ===== APRESENTAÇÃO =====
    children.push(P("01.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("APRESENTAÇÃO", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    children.push(P(
      "A Flying Studio presta serviços de computação gráfica e tecnologias que se aplicam aos lançamentos imobiliários e remanescentes. Em nosso atendimento diário, desenvolvemos laços com projeto e auxiliamos em layout, estudos de projetos e fachadas, de decoração e paisagismo de acordo com cada necessidade.",
      { color: COR.textoSoft, after: SP.corpo }
    ));
    children.push(P(
      "Para projetos de arquitetura, decoração e paisagismo, consulte a NID STUDIO.",
      { color: COR.textoSoft, italics: true, after: SP.entreSecoes }
    ));

    children.push(P("02.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("ITENS A SEREM DESENVOLVIDOS", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    let secaoNum = 0;
    if (orc.externas.qtd) {
      secaoNum++;
      children.push(tabelaCategoria(`2.${secaoNum}`, "ILUSTRAÇÕES EXTERNAS", orc.externas));
      children.push(P("", { after: SP.subtitulo, forcar: true }));
    }
    if (orc.internas.qtd) {
      secaoNum++;
      children.push(tabelaCategoria(`2.${secaoNum}`, "ILUSTRAÇÕES INTERNAS", orc.internas));
      children.push(P("", { after: SP.subtitulo, forcar: true }));
    }
    if (orc.plantas.qtd) {
      secaoNum++;
      children.push(tabelaCategoria(`2.${secaoNum}`, "PLANTAS HUMANIZADAS", orc.plantas));
      children.push(P("", { after: SP.subtitulo, forcar: true }));
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
        }
      }
    }

    if (secaoNum > 0 || (extrasEstruturados && extrasEstruturados.qtd)) {
      renderTotaisProjeto(subtotal, orc.desconto_pct, valorFinal, descontoLabel).forEach((p) => children.push(p));
      children.push(P(`(${extenso(valorFinal)})`, { italics: true, color: COR.textoSoft, after: SP.entreSecoes, size: 18 }));
    }

    if (extras && extras.length) {
      children.push(P("EXTRAS / FILMES", { bold: true, size: 22, color: COR.primariaDark, after: SP.subtitulo, before: SP.entreBlocos }));
      for (const ex of extras) {
        const cortesia = ex.cortesia ? " (CORTESIA)" : "";
        const preco = ex.cortesia ? "" : ` — ${brl(ex.preco)}`;
        children.push(bullet(`${ex.descricao}${preco}${cortesia}`));
      }
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(P("03.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("FORMA DE PAGAMENTO", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    const fp = formaPagamento || [
      { percentual: 50, marco: "Na aprovação desta Proposta" },
      { percentual: 25, marco: "Envio dos Shades" },
      { percentual: 25, marco: "Envio HR — Imagens finais" },
    ];
    for (const parc of fp) {
      const valorParc = valorFinal * (parc.percentual / 100);
      children.push(bulletRich(`${parc.percentual}%  (${brl(valorParc)})`, parc.marco));
    }
    children.push(P("04.", { bold: true, size: 18, color: COR.primaria, before: SP.entreSecoes, after: 0 }));
    children.push(P("PRAZOS DE ENTREGA", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    const pr = prazos || { shades: "20 (Vinte) dias", primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" };
    children.push(bulletRich("Shades", pr.shades));
    children.push(bulletRich("1º Tiro de Apresentação", pr.primeiro_tiro));
    children.push(bulletRich("Revisões", pr.revisoes));
    children.push(P("Os prazos passam a contar após o recebimento de todos os projetos, informações e aprovações de etapas para o desenvolvimento de cada item. Não iniciamos os trabalhos sem o DWG e as aprovações necessárias desta proposta.",
      { italics: true, size: 18, color: COR.textoSoft, before: SP.entreBlocos, after: SP.entreSecoes }));

    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(P("05.", { bold: true, size: 18, color: COR.primaria, after: 0 }));
    children.push(P("MATERIAIS NECESSÁRIOS", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    children.push(bulletRich("Arquitetura", "Plantas · Elevação da Fachada · Estudo de Cores da Fachada · Cortes."));
    children.push(bulletRich("Paisagismo", "Implantação · Detalhamentos · Especificação de Revestimentos · Estudo de Vegetação com Especificação de Espécies · Referências do Mobiliário."));
    children.push(bulletRich("Decoração", "Plantas com Layout · Desenhos de Pisos · Elevações de Paredes · Especificações de Materiais · Projeto de Forro e Iluminação · Descrição ou book de mobiliários."));

    children.push(P("06.", { bold: true, size: 18, color: COR.primaria, before: SP.entreSecoes, after: 0 }));
    children.push(P("CONSIDERAÇÕES", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

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

    children.push(P("07.", { bold: true, size: 18, color: COR.primaria, before: SP.entreSecoes, after: 0 }));
    children.push(P("ENTREGA FINAL", { bold: true, size: 32, color: COR.texto, after: SP.tituloSec }));

    const entregas = [
      ["Formato e Envio", "Todo o material finalizado será enviado digitalmente via servidor FTP, link seguro para download ou cadastrados no Frame.io/Adobe."],
      ["Resolução das Imagens Estáticas", "As imagens finais (\u201CHR\u201D) serão entregues com 6000px no lado maior a 300dpi. Após a entrega do HR, o projeto é considerado concluído. Caso surja a necessidade de novas configurações nessa etapa, ficamos à disposição para avaliar e orçar como um novo serviço."],
      ["Impressão de até 1m", "Caso a Contratante necessite de imagens configuradas para impressões de até 1 (um) metro, a solicitação deve ser feita com antecedência à renderização final, sem custo adicional."],
      ["Impressão acima de 1m", "Para outdoors ou grandes painéis (acima de 1m), favor consultar previamente os valores adicionais de render — custo estimado de 20% do valor da imagem."],
      ["Animações / Filmes", "Os passeios virtuais e filmes integrados serão entregues em Full HD a 30 FPS, ou propostas via RINNO FILMS, consultar."],
    ];
    for (const [titulo, texto] of entregas) children.push(bulletRich(titulo, texto));

    children.push(P(`São Paulo, ${dataExtenso(data)}.`, { color: COR.textoSoft, before: SP.entreSecoes, after: SP.entreBlocos }));
    children.push(P("De acordo,", { after: SP.entreBlocos }));
    children.push(P("____________________________________________________", { color: COR.textoSoft, after: SP.subtitulo }));
    children.push(P(cliente.empresa.toUpperCase(), { bold: true, size: 24, color: COR.primaria, after: SP.corpo }));
    children.push(P(`A/C: ${cliente.contato}`, { color: COR.textoSoft, size: 18 }));

    // ===== DOCUMENTO =====
    const doc = new Document({
      creator: "Flying Studio",
      title: `Proposta ${cliente.empresa} - ${cliente.ref}`,
      description: "Proposta comercial Flying Studio",
      styles: {
        default: {
          document: {
            run: { font: FONTE, size: 22, color: COR.texto },
            paragraph: { spacing: { after: SP.corpo, line: SP.linha } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 900, bottom: 720, left: 1134, right: 1134, header: 720, footer: 600 },
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
