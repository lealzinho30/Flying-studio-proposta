// Geração do DOCX no navegador via biblioteca docx.js (UMD) — carregada via CDN.
// Reproduz fielmente o layout das propostas Flying Studio.

(function () {
  "use strict";

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

  // ---- Geração DOCX usando a lib docx (window.docx) ----

  function P(texto, opts = {}) {
    const { TextRun, Paragraph } = window.docx;
    return new Paragraph({
      spacing: { after: opts.after ?? 80 },
      alignment: opts.alignment,
      children: [new TextRun({ text: texto, bold: !!opts.bold, size: (opts.size || 22), font: "Calibri" })],
    });
  }

  function H(texto, size = 26) { return P(texto, { bold: true, size }); }

  function tabelaCategoria(numero, titulo, categoria, mostraPrecos) {
    const { Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun, AlignmentType } = window.docx;
    const borders = {
      top: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
    };
    function cell(text, opts = {}) {
      return new TableCell({
        width: { size: opts.width || 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: opts.alignment || AlignmentType.LEFT,
          children: [new TextRun({ text, bold: !!opts.bold, size: 22, font: "Calibri" })],
        })],
      });
    }

    const linhas = [];
    const cabec = mostraPrecos
      ? new TableRow({ children: [cell("Itens", { bold: true, width: 12 }), cell("Descrição dos Serviços", { bold: true, width: 64 }), cell("Valor", { bold: true, width: 24, alignment: AlignmentType.RIGHT })] })
      : new TableRow({ children: [cell("Itens", { bold: true, width: 15 }), cell("Descrição dos Serviços", { bold: true, width: 85 })] });
    linhas.push(cabec);

    categoria.itens.forEach((it, idx) => {
      const rowCells = mostraPrecos
        ? [cell(`${numero}.${idx + 1}`, { width: 12 }), cell(it.descricao_normalizada, { width: 64 }), cell(brl(it.preco), { width: 24, alignment: AlignmentType.RIGHT })]
        : [cell(`${numero}.${idx + 1}`, { width: 15 }), cell(it.descricao_normalizada, { width: 85 })];
      linhas.push(new TableRow({ children: rowCells }));
    });

    const rodape = mostraPrecos
      ? new TableRow({ children: [cell(String(categoria.qtd), { bold: true, width: 12 }), cell("Valor Total", { bold: true, width: 64 }), cell(brl(categoria.total), { bold: true, width: 24, alignment: AlignmentType.RIGHT })] })
      : new TableRow({ children: [cell(String(categoria.qtd), { bold: true, width: 15 }), cell(`Valor Total ${brl(categoria.total)}`, { bold: true, width: 85 })] });
    linhas.push(rodape);

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhas, borders });
  }

  async function gerarDocxBlob({ cliente, orc, data, mostrarPrecos, formaPagamento, prazos, descontoLabel, extras }) {
    const { Document, Packer, Paragraph } = window.docx;
    data = data || new Date();
    const children = [];

    children.push(H("PROPOSTA DE IMAGENS, FILMES E TECNOLOGIAS 3D", 28));
    children.push(P(`${cliente.empresa} - REF: ${cliente.ref}`, { bold: true, size: 24 }));
    children.push(P(`A/C: ${cliente.contato}`, { bold: true, size: 24 }));
    children.push(new Paragraph(""));

    children.push(H("1 – APRESENTAÇÃO FLYING STUDIO", 24));
    children.push(P("A Flying Studio presta serviços de computação gráfica e tecnologias que se aplicam aos lançamentos imobiliário e remanescentes. Em nosso atendimento diário, desenvolvemos laços com projeto e auxiliamos em layout, estudos de projetos e fachadas, de decoração e paisagismo de acordo com cada necessidade, consulte a NID STUDIO para projetos."));
    children.push(new Paragraph(""));

    children.push(H("2 – ITENS A SEREM DESENVOLVIDOS / INVESTIMENTOS:", 24));

    if (orc.externas.qtd) {
      children.push(H("2.1 ILUSTRAÇÕES EXTERNAS", 22));
      children.push(tabelaCategoria("2.1", "Externas", orc.externas, mostrarPrecos));
      children.push(new Paragraph(""));
    }
    if (orc.internas.qtd) {
      children.push(H("2.2 ILUSTRAÇÕES INTERNAS", 22));
      children.push(tabelaCategoria("2.2", "Internas", orc.internas, mostrarPrecos));
      children.push(new Paragraph(""));
    }
    if (orc.plantas.qtd) {
      children.push(H("2.3 PLANTAS HUMANIZADAS", 22));
      children.push(tabelaCategoria("2.3", "Plantas", orc.plantas, mostrarPrecos));
      children.push(new Paragraph(""));
    }

    const subtotal = orc.subtotal;
    const descontoValor = subtotal * (orc.desconto_pct / 100);
    const valorFinal = subtotal - descontoValor;

    children.push(P(`${orc.total_imagens} Valor Final ${brl(subtotal)}`, { bold: true }));
    if (orc.desconto_pct > 0) {
      const rotulo = descontoLabel || `${orc.desconto_pct}% de Desconto`;
      children.push(P(`Valor Total do Projeto com ${rotulo} = ${brl(valorFinal)}`, { bold: true }));
    } else {
      children.push(P(`Valor Total do Projeto = ${brl(valorFinal)}`, { bold: true }));
    }
    children.push(new Paragraph(""));

    if (extras && extras.length) {
      children.push(H("2.4 EXTRAS / FILMES", 22));
      for (const ex of extras) {
        const cortesia = ex.cortesia ? " (CORTESIA)" : "";
        const preco = ex.cortesia ? "" : ` - ${brl(ex.preco)}`;
        children.push(P(`• ${ex.descricao}${preco}${cortesia}`));
      }
      children.push(new Paragraph(""));
    }

    children.push(P("INVESTIMENTO PARA O DESENVOLVIMENTOS DOS ITENS ACIMA DESCRITOS:", { bold: true }));
    children.push(P(`${brl(valorFinal)} (${extenso(valorFinal)})`, { bold: true }));
    children.push(new Paragraph(""));

    children.push(P("FORMA DE PAGAMENTO:", { bold: true }));
    const fp = formaPagamento || [
      { percentual: 50, marco: "Na aprovação desta Proposta" },
      { percentual: 25, marco: "Envio dos Shades" },
      { percentual: 25, marco: "Envio HR - Imagens finais" },
    ];
    for (const parc of fp) children.push(P(`${parc.percentual}% - ${parc.marco}.`));
    children.push(new Paragraph(""));

    children.push(H("3 – PRAZOS / SOLICITAÇÕES / CONSIDERAÇÕES / ENTREGAS", 24));
    const pr = prazos || { shades: "20 (Vinte) dias", primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" };
    children.push(P(`Shades – ${pr.shades}`));
    children.push(P(`1º Tiro – ${pr.primeiro_tiro},`));
    children.push(P(`Revisões – ${pr.revisoes}.`));
    children.push(P("OBS: Prazos passam a contar após recebimento de todos os projetos, informações e aprovações de etapas para o desenvolvimento de cada item. Não iniciamos os trabalhos sem recebermos o DWG e aprovações necessárias dessa proposta."));
    children.push(new Paragraph(""));

    children.push(P("SOLICITAÇÕES: Arquivos e definições necessários à execução do serviço.", { bold: true }));
    children.push(P("Arquitetura: • Plantas • Elevação da Fachada • Estudo de Cores da Fachada • Cortes;"));
    children.push(P("Paisagismo: • Implantação • Detalhamentos • Especificação de Revestimentos • Estudo de Vegetação com Especificação de Espécies • Referências do Mobiliário;"));
    children.push(P("Decoração: • Plantas com Layout • Desenhos de Pisos • Elevações de Paredes • Especificações de materiais • Projeto de Forro e Iluminação • Descrição ou book de mobiliários."));
    children.push(new Paragraph(""));

    children.push(P("CONSIDERAÇÕES IMAGENS:", { bold: true }));
    const consideracoes = [
      "Etapas e Tiros de Aprovação: Esta proposta contempla o envio inicial do tiro de Shade, seguido do tiro de apresentação denominado \u201CR00\u201D. Estão inclusas no escopo 03 (três) rodadas de revisões, denominadas \u201CR01\u201D, \u201CR02\u201D e \u201CR03\u201D, culminando na entrega final denominada \u201CHR\u201D (High Resolution).",
      "Ajustes Finos e Adicionais: Damos ênfase que, a partir do tiro \u201CR00\u201D, as rodadas seguintes consistem exclusivamente em ajustes finos. A partir de um eventual quarto tiro de apresentação (denominado \u201CR04\u201D), será cobrado um adicional de 25% do valor da imagem por tiro extra solicitado, bem como quaisquer tiros adicionais solicitados após a entrega do HR.",
      "Plataforma Oficial de Revisão: Para garantir a organização, a agilidade e a precisão técnica das refações, todo o processo de feedback, comentários e aprovações (tanto dos filmes quanto das imagens 3D) será realizado exclusivamente através do software especializado Frame.io/Adobe.",
      "Mecânica de Apontamentos: A Contratada fornecerá à Contratante um link de acesso seguro à plataforma. Através do Frame.io/Adobe, o cliente poderá inserir comentários, desenhar marcações, anexar informações (pdf, foto, dwg, etc) e solicitar ajustes exatamente no frame do vídeo ou no ponto específico da imagem estática que deseja alterar, eliminando ruídos de comunicação.",
      "Alterações de Projeto: Quaisquer alterações nos projetos originais (sejam de design de interiores, arquitetônico ou paisagismo) fornecidos inicialmente implicam em cobranças extras de modelagem, que serão orçadas e aprovadas em comum acordo.",
      "Refação e Remodelagem: No decorrer das rodadas de tiros, havendo mudanças significativas no projeto que resultem na perda de até 50% da imagem já construída (sendo necessária a remodelagem ou retrocesso na etapa de produção), o trabalho será considerado e cobrado como uma imagem nova.",
      "Paralisação do Projeto: Em caso de paralisação total ou parcial do escopo por um período de até 60 (sessenta) dias, deverá ser feito o acerto financeiro imediato das etapas já executadas. Para este cálculo de acerto, considera-se que cada tiro enviado após a aprovação do R00 corresponde a 25% do valor total da imagem.",
      "Cancelamento: Em caso de descontinuidade e cancelamento do produto ou lançamento por qualquer motivo por parte da Contratante, considera-se justa e devida a quitação integral do saldo previsto nesta proposta.",
      "Direitos de Uso: A Contratada cede à Contratante os direitos de uso das imagens produzidas para uso promocional em todo o seu material publicitário, única e exclusivamente vinculadas ao empreendimento contratado, não havendo débitos/atrasos financeiros.",
    ];
    for (const c of consideracoes) children.push(P(`• ${c}`));
    children.push(new Paragraph(""));

    children.push(P("ENTREGA FINAL:", { bold: true }));
    const entregas = [
      "Formato e Envio: Todo o material finalizado será enviado digitalmente via servidor FTP, link seguro para download ou cadastrados no Frame.io/Adobe.",
      "Resolução das Imagens Estáticas: As imagens finais (denominadas \u201CHR\u201D) serão entregues com 6000px em seu lado maior a 300dpi. Após a entrega do HR, o projeto é considerado concluído. Caso surja a necessidade de novas configurações nessa etapa, ficamos à disposição para avaliar e orçar as alterações como um novo serviço.",
      "Caso a Contratante necessite de imagens configuradas para impressões de até 1 (um) metro, a solicitação deve ser feita com antecedência à renderização final, sem custo adicional.",
      "Para imagens com medidas de impressão superiores a 1 (um) metro (como outdoors ou grandes painéis), favor consultar previamente os valores adicionais de render, com custo estimado de 20% do valor da imagem, consultar.",
      "Resolução das Animações/Filmes: Os passeios virtuais e filmes integrados serão entregues finalizados no formato Full HD a 30 FPS ou propostas via RINNO FILMS, consultar.",
    ];
    for (const e of entregas) children.push(P(`• ${e}`));
    children.push(new Paragraph(""));

    children.push(P(`São Paulo, ${dataExtenso(data)}.`));
    children.push(P("De acordo,"));
    children.push(P(cliente.empresa, { bold: true }));

    const doc = new Document({
      creator: "Flying Studio",
      title: `Proposta ${cliente.empresa} - ${cliente.ref}`,
      sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1418 } } }, children }],
    });

    return await Packer.toBlob(doc);
  }

  window.FlyingDocx = { gerarDocxBlob, brl, extenso };
})();
