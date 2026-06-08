// Geração do DOCX no navegador (docx.js) — modelo Flying 2026 (sem tabelas)
// PROPOSTA… / CLIENTE - REF / A/C: · listas por categoria · investimento · seção 3 única

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
    texto: "404040",
    textoSoft: "404040",
    branco: "FFFFFF",
  };
  const FONTE = "Calibri Light";
  const TAM = 20; // half-points → 10 pt (modelo Word)
  const HIGHLIGHT = "yellow";

  // Modelo Word: depois 10 pt, entrelinhas múltiplo 1,15, justificado.
  const SP = {
    corpo: 200,
    linha: 276,
    tituloSec: 200,
    entreSecoes: 200,
    bullet: 200,
    prazoRecuo: 360,
  };

  const PAGE = {
    top: 1417,
    bottom: 1304,
    left: 1417,
    right: 1417,
  };

  const TITULOS_INVEST = {
    "ILUSTRAÇÕES EXTERNAS": "Ilustrações Externas",
    "ILUSTRAÇÕES INTERNAS": "Ilustrações Internas",
    "IMPLANTAÇÕES/PLANTAS HUMANIZADAS": "Plantas Humanizadas",
  };

  function tituloInvestimentoDisplay(titulo) {
    const t = (titulo || "").trim();
    if (TITULOS_INVEST[t]) return TITULOS_INVEST[t];
    return t
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function estiloParagrafo(opts = {}) {
    const { AlignmentType, LineRuleType } = window.docx;
    return {
      after: opts.after ?? SP.corpo,
      before: opts.before ?? 0,
      line: opts.line ?? SP.linha,
      lineRule: opts.lineRule ?? LineRuleType.AUTO,
      alignment: opts.alignment ?? (opts.semJustificar ? undefined : AlignmentType.JUSTIFIED),
      indent: opts.indent,
    };
  }

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
    const par = estiloParagrafo(opts);
    return new Paragraph({
      spacing: {
        after: par.after,
        before: par.before,
        line: par.line,
        lineRule: par.lineRule,
      },
      alignment: par.alignment,
      indent: par.indent,
      children: [new TextRun(runOpts)],
    });
  }

  function PRich(runs, opts = {}) {
    const { Paragraph } = window.docx;
    const par = estiloParagrafo(opts);
    return new Paragraph({
      spacing: {
        after: par.after,
        before: par.before,
        line: par.line,
        lineRule: par.lineRule,
      },
      alignment: par.alignment,
      indent: par.indent,
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
    const { AlignmentType } = window.docx;
    return P(`${numero} — ${titulo}`, {
      bold: true,
      size: TAM,
      after: SP.tituloSec,
      before: opts.before ?? 0,
      alignment: AlignmentType.LEFT,
      semJustificar: true,
    });
  }

  function tituloBloco(texto, opts = {}) {
    const { AlignmentType } = window.docx;
    return P(texto, {
      bold: true,
      size: TAM,
      after: opts.after ?? SP.corpo,
      before: opts.before ?? 0,
      underline: !!opts.underline,
      alignment: AlignmentType.LEFT,
      semJustificar: true,
    });
  }

  function bulletSimples(texto) {
    const { Paragraph, TextRun, AlignmentType, LineRuleType } = window.docx;
    return new Paragraph({
      spacing: { after: SP.bullet, line: SP.linha, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.LEFT,
      indent: { left: 360, hanging: 180 },
      children: [
        new TextRun({ text: "• ", size: TAM, font: FONTE, color: COR.texto }),
        new TextRun({ text: texto, size: TAM, font: FONTE, color: COR.texto }),
      ],
    });
  }

  function bulletRotulo(rotulo, texto) {
    const { Paragraph, LineRuleType, AlignmentType } = window.docx;
    return new Paragraph({
      spacing: { after: SP.bullet, line: SP.linha, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: 360, hanging: 180 },
      children: [
        R("• ", {}),
        R(`${rotulo}: `, { bold: true }),
        R(texto, {}),
      ],
    });
  }

  function linhaPrazo(rotulo, texto) {
    const marco = (texto || "").replace(/[.,]+$/, "");
    return PRich([R(`${rotulo} `, { bold: true }), R(`– ${marco}`)], {
      indent: { left: SP.prazoRecuo },
      semJustificar: true,
      alignment: undefined,
    });
  }

  function linhaSolicitacao(rotulo, itens) {
    const txt = itens.map((i) => `• ${i}`).join(" ");
    return PRich([R(`${rotulo}: `, { bold: true }), R(txt)]);
  }

  function linhaPctPagamento(pct, marco) {
    const m = (marco || "").trim().replace(/[.,]+$/, "");
    return P(`${pct}% - ${m}.`, {
      indent: { left: SP.prazoRecuo },
      semJustificar: true,
      alignment: undefined,
      after: SP.bullet,
    });
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

  /** Assinatura: data, “De acordo,”, espaço para rubrica, linha e cliente centralizado. */
  function blocoAssinatura(cliente, data) {
    const { AlignmentType, LineRuleType } = window.docx;
    const partes = [];
    const nomeCliente = (cliente.empresa || "CLIENTE").toUpperCase();

    partes.push(P(`São Paulo, ${dataExtenso(data)}.`, {
      before: SP.entreSecoes,
      after: SP.corpo,
      semJustificar: true,
      alignment: AlignmentType.LEFT,
    }));
    partes.push(P("De acordo,", {
      after: 120,
      semJustificar: true,
      alignment: AlignmentType.LEFT,
    }));
    partes.push(paragrafoLinha(COR.texto, { before: 80, after: 80, size: 6 }));
    partes.push(P(nomeCliente, {
      bold: true,
      alignment: AlignmentType.CENTER,
      after: 0,
      semJustificar: true,
    }));

    return partes.filter(Boolean);
  }

  function cabecalhoProposta(cliente) {
    const emp = (cliente.empresa || "CLIENTE").toUpperCase();
    const ref = (cliente.ref || "PROJETO").toUpperCase();
    const contato = (cliente.contato || "—").trim();
    const { AlignmentType } = window.docx;
    const cab = { bold: true, after: SP.corpo, alignment: AlignmentType.LEFT, semJustificar: true };
    return [
      P("PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D", cab),
      P(`${emp} – REF: ${ref}`, cab),
      P(`A/C: ${contato}`, { ...cab, after: SP.entreSecoes }),
    ].filter(Boolean);
  }

  function paragrafoApresentacaoInicial() {
    const partes = [];
    partes.push(PRich([
      R("Nascemos para dar forma ao invisível", { bold: true }),
      R(" – Em 9 de maio de 2011, a Flying Studio nasceu com a missão de transformar projetos em experiências visuais que comunicam arquitetura, paisagismo e decoração com clareza e emoção. Como diz o provérbio, "),
      R("uma imagem vale mais do que mil palavras", { italics: true, underline: true }),
      R("."),
    ]));
    partes.push(PRich([
      R("Muito além das perspectivas", { bold: true }),
      R(" – Esse sempre foi o nosso lema e, ao longo dos anos, evoluímos para sermos a ponte entre a ideia e a materialização do empreendimento. Desenvolvemos filmes, tours virtuais e tecnologias 3D que elevam o lançamento imobiliário e fortalecem a narrativa de cada projeto."),
    ]));
    partes.push(PRich([
      R("Nossa evolução foi um despertar", { bold: true }),
      R(" – A arte sempre será o nosso core, mas hoje integramos imagens, filmes e experiências digitais em um hub criativo. Do D.brave à Realidade Aumentada, das Salas Imersivas aos filmes cinematográficos, ajudamos incorporadoras e arquitetos a transformar empreendimentos em cases de sucesso."),
    ], { after: SP.entreSecoes }));
    return partes;
  }

  function coletarSubsecoesInvestimento(orc, extrasEstruturados) {
    const blocos = [];
    let secaoNum = 0;

    function add(titulo, categoria) {
      if (!categoria || !categoria.qtd) return;
      secaoNum += 1;
      blocos.push({
        numero: secaoNum,
        titulo,
        tituloDisplay: tituloInvestimentoDisplay(titulo),
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
            numero: secaoNum,
            titulo,
            tituloDisplay: tituloInvestimentoDisplay(titulo),
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

  function blocoInvestimentoLista(bloco) {
    const partes = [];
    const { AlignmentType } = window.docx;
    partes.push(P(`${bloco.numero}. ${bloco.tituloDisplay}`, {
      bold: true,
      after: SP.bullet,
      before: bloco.numero > 1 ? SP.corpo : 0,
      alignment: AlignmentType.LEFT,
      semJustificar: true,
    }));
    for (const desc of bloco.linhas) {
      partes.push(bulletSimples(desc));
    }
    if (bloco.sem_preco) {
      partes.push(P("Valor total: A DEFINIR", { bold: true, after: SP.corpo }));
    } else {
      partes.push(P(`Valor total: ${valorNumerico(bloco.total)}`, { bold: true, after: SP.corpo }));
    }
    return partes;
  }

  function calcularTotaisInvestimento(orc, extrasEstruturados) {
    const subtotalImagens = orc.subtotal;
    const totalExtras = (extrasEstruturados && extrasEstruturados.total) || 0;
    const subtotal = subtotalImagens + totalExtras;
    const descontoPct = orc.desconto_pct || 0;
    // Desconto só sobre imagens (padrão Flying); extras entram sem desconto.
    const descontoValor = subtotalImagens * (descontoPct / 100);
    const valorFinal = subtotalImagens - descontoValor + totalExtras;
    return { subtotalImagens, totalExtras, subtotal, descontoPct, descontoValor, valorFinal };
  }

  async function gerarDocxBlob({
    cliente, orc, data, mostrarPrecos, formaPagamento, prazos,
    descontoLabel, extras, extrasEstruturados,
  }) {
    const { Document, Packer } = window.docx;

    data = data || new Date();

    const totais = calcularTotaisInvestimento(orc, extrasEstruturados);
    const { subtotal, valorFinal, descontoPct, descontoValor } = totais;
    const qtdImagens = orc.total_imagens;
    const qtdExtras = (extrasEstruturados && extrasEstruturados.qtd) || 0;

    const blocosInvest = coletarSubsecoesInvestimento(orc, extrasEstruturados);
    const totalItens = qtdImagens + qtdExtras;
    const children = [];

    cabecalhoProposta(cliente).forEach((p) => children.push(p));

    children.push(secaoHeading("1", "APRESENTAÇÃO FLYING STUDIO"));
    paragrafoApresentacaoInicial().forEach((p) => children.push(p));

    children.push(secaoHeading("2", "ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:"));
    for (const bloco of blocosInvest) {
      blocoInvestimentoLista(bloco).forEach((p) => children.push(p));
    }

    if (descontoPct > 0 && blocosInvest.length) {
      children.push(PRich([
        R(`Desconto de ${descontoPct}% aplicado sobre imagens`, { bold: true }),
        R(` (${descontoLabel || `${descontoPct}%`}): `),
        R(`-${brl(descontoValor)}`, { bold: true }),
      ], { after: SP.corpo }));
    }

    if (blocosInvest.length) {
      children.push(tituloBloco("INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:", {
        before: SP.corpo,
        after: SP.corpo,
      }));
      children.push(PRich([
        R(brl(valorFinal), { bold: true }),
        R(` (${extenso(valorFinal)})`, {}),
      ], { after: SP.entreSecoes }));
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
    children.push(linhaPrazo("Shades", pr.shades));
    children.push(linhaPrazo("1º Tiro", pr.primeiro_tiro));
    children.push(linhaPrazo("Revisões", pr.revisoes));
    children.push(PRich([
      R("OBS: ", { bold: true }),
      R("Os prazos passam a contar após o recebimento de todos os projetos, informações e aprovações de etapas para o desenvolvimento de cada item. Não iniciamos os trabalhos sem o DWG e as aprovações necessárias desta proposta."),
    ], { after: SP.entreSecoes }));

    children.push(PRich([
      R("SOLICITAÇÕES: ", { bold: true }),
      R("Arquivos e definições necessários à execução do serviço."),
    ], { after: SP.corpo }));
    children.push(linhaSolicitacao("Arquitetura", [
      "Plantas",
      "Elevação da Fachada",
      "Estudo de Cores da Fachada",
      "Cortes",
    ]));
    children.push(linhaSolicitacao("Paisagismo", [
      "Implantação",
      "Detalhamentos",
      "Especificação de Revestimentos",
      "Estudo de Vegetação com Especificação de Espécies",
      "Referências do Mobiliário",
    ]));
    children.push(linhaSolicitacao("Decoração", [
      "Plantas com Layout",
      "Desenhos de Pisos",
      "Elevações de Paredes",
      "Especificações de materiais",
      "Projeto de Forro e Iluminação",
      "Descrição ou book de mobiliários",
    ]));

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
    for (const [titulo, texto] of consideracoes) {
      children.push(bulletRotulo(titulo, texto));
      if (titulo === "Mecânica de Apontamentos") {
        children.push(P(
          "Para garantir agilidade e facilitar o processo de adaptação, sugerimos a visualização do guia prático em vídeo de como realizar revisões dentro da plataforma.",
          { italics: true, underline: true, indent: { left: 360 }, after: SP.bullet }
        ));
      }
    }

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
            paragraph: { spacing: { after: SP.corpo, line: SP.linha, lineRule: "auto" } },
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
            },
          },
        },
        children,
      }],
    });

    const conteudoBlob = await Packer.toBlob(doc);
    if (window.FlyingTimbrado && window.FlyingTimbrado.aplicarPapelTimbrado) {
      return window.FlyingTimbrado.aplicarPapelTimbrado(conteudoBlob);
    }
    return conteudoBlob;
  }

  window.FlyingDocx = { gerarDocxBlob, brl, extenso, calcularTotaisInvestimento };
})();
