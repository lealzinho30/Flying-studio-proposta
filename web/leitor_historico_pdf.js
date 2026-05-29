// leitor_historico_pdf.js — extrai do PDF do último orçamento (qualquer formato Flying).

(function () {
  "use strict";
  const { norm } = window.FlyingParser;

  const STORAGE_KEY = "flying_historico_pdf_v1";

  const SECOES_PDF = [
    { cat: "externas", re: /ilustra.{0,10}extern|\bexternas\b|perspectivas?\s+extern/i },
    { cat: "internas", re: /ilustra.{0,10}intern|\binternas\b|perspectivas?\s+intern/i },
    { cat: "plantas", re: /plantas?\s+humaniz|\bplantas\b/i },
    { cat: "servicos", re: /tour\s+virtual|visita\s+virtual|filmes?|anima.{0,6}|aplica|d\.?\s*brave|maquete|drone|tecnolog|multip plataforma/i },
  ];

  function normEmpresa(nome) {
    return (nome || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function parsePreco(str) {
    if (!str) return null;
    const s = String(str).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n < 50 || n > 500000) return null;
    return Math.round(n);
  }

  function ehLinhaTotal(linha) {
    const n = norm(linha);
    return /valor\s+final|investimento\s+total|subtotal|desconto\s+de|total\s+do\s+projeto|total\s+geral/.test(n);
  }

  /** Varre o texto inteiro e pega qualquer R$ (fallback quando o PDF vem “tudo numa linha”). */
  function extrairTodosPrecos(texto) {
    const achados = [];
    const re = /R\$\s*([\d.]{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const preco = parsePreco(m[1]);
      if (!preco) continue;
      const ctx = texto.slice(Math.max(0, m.index - 90), m.index).replace(/\s+/g, " ");
      if (ehLinhaTotal(ctx)) continue;
      if (/\d{1,3}\s*%/.test(ctx) && preco < 5000) continue;
      achados.push({ preco, ctx });
    }
    return achados;
  }

  function montarDePrecosSoltos(precos) {
    const filtrados = precos.filter((p) => p.preco >= 500);
    const lista = filtrados.length ? filtrados : precos;
    if (!lista.length) return {};
    const itens = lista.slice(0, 40).map((p, i) => {
      let desc = limpaDescricao(p.ctx.replace(/R\$.*/i, ""));
      if (!desc || desc.length < 3) desc = `Serviço ${i + 1} (extraído do PDF)`;
      return { desc, preco: p.preco };
    });
    return { servicos: montarBloco(itens) };
  }

  function extrairPrecosLinha(linha) {
    const out = [];
    const re = /R\$\s*([\d.]{2,}(?:,\d{2})?)/gi;
    let m;
    while ((m = re.exec(linha)) !== null) {
      const p = parsePreco(m[1]);
      if (p) out.push({ idx: m.index, preco: p });
    }
    return out;
  }

  function limpaDescricao(raw) {
    return (raw || "")
      .replace(/\s+/g, " ")
      .replace(/^[\d.\)\s\-–—•]+/, "")
      .replace(/\s+R\$\s*[\d.,]+.*$/i, "")
      .replace(/[\s.;,]+$/, "")
      .trim();
  }

  function detectarCategoriaSecao(linha) {
    const n = norm(linha);
    for (const s of SECOES_PDF) {
      if (s.re.test(n)) return s.cat;
    }
    if (/implanta(?!.*terreno)|planta\s+tipo|planta\s+humaniz/i.test(n)) return "plantas";
    return null;
  }

  function inferirCategoriaItem(desc) {
    const n = norm(desc);
    if (/\bplanta\b|implanta|tipo\s+[a-d]\b|mosca/i.test(n)) return "plantas";
    if (/intern|lobby|academia|sauna|festas|coworking|brinquedoteca|lavanderia/i.test(n)) return "internas";
    if (/tour|visita\s+virtual|filme|anima|d\.?\s*brave|aplica|maquete|drone|rinno|takes?\s/i.test(n)) return "servicos";
    if (/perspectiva|fachada|fotomontagem|voo|bird|portaria|piscina|playground/i.test(n)) return "externas";
    return "servicos";
  }

  function montarBloco(itens) {
    const total = itens.reduce((s, x) => s + x.preco, 0);
    return { qtd: itens.length, total, itens };
  }

  function parseValorFinalProjeto(texto) {
    const padroes = [
      /valor\s+final\s+do\s+projeto[^R$]{0,80}R\$\s*([\d.,]+)/i,
      /investimento\s+total[^R$]{0,80}R\$\s*([\d.,]+)/i,
      /valor\s+total\s+do\s+projeto[^R$]{0,80}R\$\s*([\d.,]+)/i,
      /total\s+(?:com\s+desconto)?[^R$]{0,40}R\$\s*([\d.,]+)/i,
    ];
    for (const re of padroes) {
      const m = texto.match(re);
      if (m) {
        const p = parsePreco(m[1]);
        if (p) return p;
      }
    }
    const todos = extrairTodosPrecos(texto);
    if (todos.length) return todos[todos.length - 1].preco;
    return null;
  }

  function limparTokenEmpresa(s) {
    return (s || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b(r\d+|rev\d+|anexo\w*|final|orcamento|proposta)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tituloCasePdf(s) {
    return (s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => {
        const l = w.toLowerCase();
        if (["de", "da", "do", "das", "dos", "e"].includes(l)) return l;
        return l.charAt(0).toUpperCase() + l.slice(1);
      })
      .join(" ");
  }

  function empresaEhLixoPdf(nome) {
    const e = normEmpresa(nome);
    if (!e || e.length < 2) return true;
    if (/DESENVOLVIMENTO|ITENS\s+ACIMA|DESCRI|ORCAMENTO\s+ANTERIOR|VALOR\s+FINAL|INVESTIMENTO\s+TOTAL/.test(e)) {
      return true;
    }
    if (/^O\s+(DESENVOLVIMENTO|ITENS|ORCAMENTO)/.test(e)) return true;
    if (e.length > 42) return true;
    return false;
  }

  /** Orc_Integra_Voluntarios_da_Patria_AnexoI_R04 → empresa + ref */
  function metaFromArquivo(nomeArquivo) {
    const out = { empresa: "", ref: "", contato: "" };
    if (!nomeArquivo) return out;
    const base = nomeArquivo.replace(/\.[a-z0-9]+$/i, "");
    let m = base.match(/^orc[_\s-]+([a-z0-9][a-z0-9_-]*?)_([a-z0-9][a-z0-9_-]+)$/i);
    if (m) {
      out.empresa = m[1].replace(/_/g, " ").trim().toUpperCase();
      let ref = m[2]
        .replace(/_/g, " ")
        .replace(/\banexo\w*\b/gi, "")
        .replace(/\br\d+\b/gi, "")
        .trim();
      out.ref = tituloCasePdf(ref);
      return out;
    }
    out.empresa = empresaDoArquivo(nomeArquivo);
    return out;
  }

  function empresaDoArquivo(nome) {
    const meta = metaFromArquivo(nome);
    return meta.empresa || "";
  }

  function extrairEmpresaDoTextoPdf(texto) {
    const t = texto || "";
    const padroes = [
      /(?:^|\n)\s*cliente\s*[=:\-]\s*([A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇ0-9\s.&'-]{2,48}?)(?=\s*\n|\s+ref\b|\s+projeto\b|\s+a\/?c\b|$)/im,
      /(?:^|\n)\s*empresa\s*[=:\-]\s*([A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇ0-9\s.&'-]{2,48}?)(?=\s*\n|\s+ref\b|\s+projeto\b)/im,
      /\bcliente\s+([A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇ0-9\s&.'-]{2,40}?)\s+projeto\s/i,
      /\bengicastro\b/i,
    ];
    for (const re of padroes) {
      const m = t.match(re);
      if (!m) continue;
      if (!m[1]) return "ENGECASTRO";
      let emp = m[1].split(/\n|ref|projeto|empreendimento|a\/?c/i)[0].trim();
      emp = emp.replace(/[.;,]+$/, "");
      if (emp.length >= 2 && !empresaEhLixoPdf(emp)) return normEmpresa(emp);
    }
    const meta = parseClienteRef(t);
    if (meta.empresa && !empresaEhLixoPdf(meta.empresa)) return normEmpresa(meta.empresa);
    return "";
  }

  function extrairContatoDoTextoPdf(texto) {
    const t = texto || "";
    const padroes = [
      /(?:^|\n)\s*(?:a\/?c|contato)\s*[=:\-]\s*([A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇa-záéíóúâêôãõç\s.'-]{2,45}?)(?=\s*\n|\s+cliente\b|\s+projeto\b|$)/im,
      /aos\s+cuidados\s+de\s+([A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇa-záéíóúâêôãõç\s.'-]{2,45}?)(?=\s*\n|[,.]|$)/i,
    ];
    for (const re of padroes) {
      const m = t.match(re);
      if (m && m[1]) return tituloCasePdf(m[1].trim());
    }
    return "";
  }

  /**
   * Define o cliente do PDF: prioridade texto do PDF > nome do arquivo > formulário.
   */
  function resolverEmpresaHistorico(texto, nomeArquivo, empresaFormulario) {
    const metaArq = metaFromArquivo(nomeArquivo || "");
    const doTextoRaw = extrairEmpresaDoTextoPdf(texto);
    const doTexto = doTextoRaw && !empresaEhLixoPdf(doTextoRaw) ? doTextoRaw : "";
    const doArquivo = metaArq.empresa || empresaDoArquivo(nomeArquivo);
    const doForm = normEmpresa(empresaFormulario || "");
    let empresa = doArquivo || doTexto || doForm;
    let origem = doArquivo ? "arquivo" : doTexto ? "pdf" : "formulario";
    let substituiuForm = false;

    if ((doTexto || doArquivo) && doForm && empresa !== doForm) {
      substituiuForm = true;
      origem = doArquivo ? "arquivo" : "pdf";
      empresa = doArquivo || doTexto;
    }

    return { empresa, origem, substituiuForm, doTexto, doArquivo, doForm, metaArq };
  }

  function ultimoRegistro() {
    const lista = listarRegistros();
    if (!lista.length) return null;
    return lista.slice().sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0))[0];
  }

  function parseItens(texto) {
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let cat = null;
    const buckets = { externas: [], internas: [], plantas: [], servicos: [] };
    let pendentes = [];

    function flushPendentes(precoTotal) {
      if (!pendentes.length || !precoTotal) {
        pendentes = [];
        return;
      }
      const c = cat || inferirCategoriaItem(pendentes[0].desc);
      if (pendentes.length === 1) {
        buckets[c].push({ desc: pendentes[0].desc, preco: precoTotal });
      } else {
        const cada = Math.round(precoTotal / pendentes.length);
        for (const p of pendentes) buckets[c].push({ desc: p.desc, preco: cada });
      }
      pendentes = [];
    }

    for (const linha of linhas) {
      const sec = detectarCategoriaSecao(linha);
      if (sec) {
        flushPendentes(0);
        cat = sec;
        continue;
      }

      const alvo = norm(linha);
      if (/^itens\b|^descri/.test(alvo) && linha.length < 40) continue;

      const precos = extrairPrecosLinha(linha);

      if (/valor\s+total/i.test(alvo) && precos.length) {
        flushPendentes(precos[precos.length - 1].preco);
        continue;
      }

      if (
        /^valor\s+final|^investimento|^subtotal|^desconto/i.test(alvo) &&
        !/perspectiva|planta|filme|tour|aplica|maquete/i.test(alvo)
      ) {
        continue;
      }

      const mNum = linha.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
      if (mNum && !precos.length) {
        const desc = limpaDescricao(mNum[2]);
        if (desc && desc.length > 2 && !/^valor\b/i.test(desc)) {
          pendentes.push({ desc });
        }
        continue;
      }

      if (!precos.length) continue;

      flushPendentes(0);

      for (const { idx, preco } of precos) {
        let desc = limpaDescricao(linha.slice(0, idx)) || limpaDescricao(linha);
        if (!desc || desc.length < 2) continue;
        if (/^total\b|^subtotal\b|^valor\b|^item\b/i.test(desc)) continue;

        const c = cat || inferirCategoriaItem(desc);
        buckets[c].push({ desc, preco });
      }
    }

    const out = {};
    for (const k of Object.keys(buckets)) {
      if (buckets[k].length) out[k] = montarBloco(buckets[k]);
    }
    return out;
  }

  function contarItens(cats) {
    let n = 0;
    for (const k of Object.keys(cats)) n += cats[k].qtd || 0;
    return n;
  }

  function parseDesconto(texto) {
    const m =
      texto.match(/desconto\s+de\s+(\d{1,2})\s*%/i) ||
      texto.match(/(\d{1,2})\s*%\s*(?:de\s+)?desconto/i) ||
      texto.match(/desconto\s*(?:de\s+)?(\d{1,2})\s*%/i);
    if (!m) return { pct: 0, label: "" };
    const pct = parseInt(m[1], 10);
    return { pct: Number.isFinite(pct) ? pct : 0, label: m[0].trim() };
  }

  function parseFormaPagamento(texto) {
    const parcelas = [];
    const bloco = texto.match(
      /(?:forma\s+de\s+pagamento|condi[cç][oõ]es?\s+de\s+pagamento)[\s\S]{0,2000}/i
    );
    const trecho = bloco ? bloco[0] : texto;
    const reLinha = /(\d{1,3})\s*%\s*([^%\n]{6,120}?)(?=\d{1,3}\s*%|$)/gi;
    let m;
    while ((m = reLinha.exec(trecho)) !== null) {
      const pct = parseInt(m[1], 10);
      let marco = (m[2] || "").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
      if (/desconto|parceria|off\b/i.test(marco)) continue;
      if (pct > 0 && pct <= 100 && marco.length > 4) parcelas.push({ percentual: pct, marco });
    }
    if (!parcelas.length) {
      const pad = window.FLYING_PRECOS && window.FLYING_PRECOS.forma_pagamento_padrao;
      if (pad && pad.parcelas) return pad.parcelas.slice();
    }
    return parcelas;
  }

  function parsePrazos(texto) {
    const prazos = {};
    const shades = texto.match(/shades?\s*[:\-]?\s*(\d+\s*\([^)]+\)\s*dias?)/i);
    if (shades) prazos.shades = shades[1].trim();
    const tiro = texto.match(/primeiro\s+tiro[^.]{0,80}?(\d+\s*\([^)]+\)[^.]{0,60})/i);
    if (tiro) prazos.primeiro_tiro = tiro[0].replace(/^.*?:\s*/i, "").trim();
    const rev = texto.match(/revis[oõ]es[^.]{0,40}?(\d+\s*\([^)]+\)\s*dias?[^.]{0,40})/i);
    if (rev) prazos.revisoes = rev[1].trim();
    return Object.keys(prazos).length ? prazos : null;
  }

  function parseClienteRef(texto) {
    let empresa = "";
    let ref = "";
    const mEmp = texto.match(
      /(?:^|\n)\s*(?:cliente|empresa)\s*[=:\-]\s*([A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇ0-9\s.&'-]{2,40})/im
    );
    if (mEmp) empresa = mEmp[1].split(/\n|ref|projeto/i)[0].trim();
    const mRef = texto.match(/(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[=:\-]?\s*([^\n$]{3,60})/i);
    if (mRef) {
      ref = mRef[1].trim();
      if (/^r\$\s*[\d.,]+$/i.test(ref)) ref = "";
      ref = ref.replace(/\s+(?:e\s+)?aos\s+cuidados.*$/i, "");
    }
    if (empresa && empresaEhLixoPdf(empresa)) empresa = "";
    return { empresa, ref };
  }

  function propostaTemDados(p) {
    if (!p) return false;
    return !!(
      (p.externas && p.externas.qtd) ||
      (p.internas && p.internas.qtd) ||
      (p.plantas && p.plantas.qtd) ||
      (p.servicos && p.servicos.qtd) ||
      p.valor_final_projeto
    );
  }

  function parseTexto(texto, metaArquivo) {
    if (!texto || texto.length < 15) return null;
    const t = texto.replace(/\u00a0/g, " ");
    let cats = parseItens(t);
    let nItens = contarItens(cats);
    const valorFinalProjeto = parseValorFinalProjeto(t);
    const forma_pagamento = parseFormaPagamento(t);
    const { pct, label } = parseDesconto(t);
    const precosSoltos = extrairTodosPrecos(t);

    if (!nItens && precosSoltos.length) {
      cats = montarDePrecosSoltos(precosSoltos);
      nItens = contarItens(cats);
    }

    const temSinal =
      nItens >= 1 ||
      (valorFinalProjeto && valorFinalProjeto > 0) ||
      forma_pagamento.length >= 1 ||
      pct > 0 ||
      precosSoltos.length >= 1;

    if (!temSinal) return null;

    if (nItens === 0 && valorFinalProjeto > 0) {
      cats.servicos = {
        qtd: 1,
        total: valorFinalProjeto,
        itens: [{ desc: "Orçamento anterior (valor total do PDF)", preco: valorFinalProjeto }],
      };
      nItens = 1;
    }

    if (cats.servicos && !cats.externas && !cats.internas && !cats.plantas) {
      cats.externas = cats.servicos;
    }

    const meta = parseClienteRef(t);
    const doArquivo = metaFromArquivo(metaArquivo && metaArquivo.nomeArquivo);
    if (!meta.empresa || empresaEhLixoPdf(meta.empresa)) {
      meta.empresa = doArquivo.empresa || "";
    }
    if (!meta.ref && doArquivo.ref) meta.ref = doArquivo.ref;
    const contatoPdf = extrairContatoDoTextoPdf(t);

    return {
      ref: meta.ref || doArquivo.ref || "Último orçamento (PDF)",
      empresa_pdf: meta.empresa ? normEmpresa(meta.empresa) : doArquivo.empresa || "",
      contato_pdf: contatoPdf || "",
      data: new Date().toISOString().slice(0, 10),
      origem: "pdf_upload",
      desconto_pct: pct,
      desconto_label: label || (pct ? `${pct}% de desconto` : ""),
      forma_pagamento,
      prazos: parsePrazos(t) || (window.FLYING_PRECOS && window.FLYING_PRECOS.prazos_padrao) || null,
      valor_final_projeto: valorFinalProjeto,
      externas: cats.externas,
      internas: cats.internas,
      plantas: cats.plantas,
      servicos: cats.servicos,
      _resumo: {
        itens: contarItens(cats),
        tipo: cats.servicos && !cats.externas ? "tecnologias" : "misto",
        media_externa: cats.externas ? Math.round(cats.externas.total / cats.externas.qtd) : null,
        media_interna: cats.internas ? Math.round(cats.internas.total / cats.internas.qtd) : null,
        media_planta: cats.plantas ? Math.round(cats.plantas.total / cats.plantas.qtd) : null,
        media_servicos: cats.servicos ? Math.round(cats.servicos.total / cats.servicos.qtd) : null,
        parcelas: forma_pagamento.length,
        valor_final: valorFinalProjeto,
      },
    };
  }

  function loadStore() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveStore(store) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  let memStore = loadStore();

  function registrar(empresa, proposta, meta) {
    const key = normEmpresa(empresa);
    if (!key || !proposta) return;
    memStore[key] = {
      empresa: key,
      proposta,
      nomeArquivo: (meta && meta.nomeArquivo) || "",
      atualizado: Date.now(),
    };
    saveStore(memStore);
  }

  function getRegistro(empresa) {
    const key = normEmpresa(empresa);
    if (!key) return null;
    return memStore[key] || null;
  }

  function listarRegistros() {
    return Object.values(memStore);
  }

  function ultimaProposta(empresa) {
    const ent = getRegistro(empresa);
    return ent && ent.proposta ? ent.proposta : null;
  }

  function temCliente(empresa) {
    return propostaTemDados(ultimaProposta(empresa));
  }

  function limpar(empresa) {
    if (empresa) delete memStore[normEmpresa(empresa)];
    else memStore = {};
    saveStore(memStore);
  }

  function resumoHtml(proposta) {
    if (!proposta || !proposta._resumo) return "";
    const r = proposta._resumo;
    const partes = [];
    if (r.itens) partes.push(`${r.itens} item(ns) no PDF`);
    if (r.tipo === "tecnologias") partes.push("proposta de tecnologias");
    if (r.media_externa) partes.push(`média externa R$${r.media_externa.toLocaleString("pt-BR")}`);
    if (r.media_servicos) partes.push(`média serviços R$${r.media_servicos.toLocaleString("pt-BR")}`);
    if (r.parcelas) partes.push(`${r.parcelas} parcela(s)`);
    if (proposta.desconto_pct) {
      partes.push(`desconto ${proposta.desconto_pct}% no PDF (não aplicado — diga no chat se quiser)`);
    }
    if (r.valor_final) partes.push(`total R$${r.valor_final.toLocaleString("pt-BR")}`);
    return partes.join(" · ");
  }

  /** Média unitária do contrato anterior (para propostas adicionais). */
  function mediaUnitariaPreferida(proposta, parsed) {
    if (!proposta || !proposta._resumo) return 0;
    const r = proposta._resumo;
    const nPla = (parsed && parsed.plantas && parsed.plantas.length) || 0;
    const nInt = (parsed && parsed.internas && parsed.internas.length) || 0;
    const nExt = (parsed && parsed.externas && parsed.externas.length) || 0;
    if (nPla && r.media_planta) return r.media_planta;
    if (nInt && r.media_interna) return r.media_interna;
    if (nExt && r.media_externa) return r.media_externa;
    if (r.media_servicos) return r.media_servicos;
    const vals = [r.media_externa, r.media_interna, r.media_planta, r.media_servicos].filter(Boolean);
    if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
    if (proposta.valor_final_projeto && r.itens > 0) {
      return proposta.valor_final_projeto / r.itens;
    }
    return 0;
  }

  window.FlyingHistoricoPdf = {
    parseTexto,
    empresaDoArquivo,
    metaFromArquivo,
    empresaEhLixoPdf,
    extrairEmpresaDoTextoPdf,
    extrairContatoDoTextoPdf,
    resolverEmpresaHistorico,
    extrairTodosPrecos,
    registrar,
    getRegistro,
    listarRegistros,
    ultimoRegistro,
    ultimaProposta,
    temCliente,
    limpar,
    resumoHtml,
    normEmpresa,
    propostaTemDados,
    parseClienteRef,
    mediaUnitariaPreferida,
  };
})();
