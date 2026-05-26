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
    if (!Number.isFinite(n) || n < 80 || n > 500000) return null;
    return Math.round(n);
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
    const m =
      texto.match(/valor\s+final\s+do\s+projeto[^R$]*R\$\s*([\d.,]+)/i) ||
      texto.match(/investimento\s+total[^R$]*R\$\s*([\d.,]+)/i) ||
      texto.match(/valor\s+total\s+do\s+projeto[^R$]*R\$\s*([\d.,]+)/i);
    if (!m) return null;
    return parsePreco(m[1]);
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
      /(?:forma\s+de\s+pagamento|condi[cç][oõ]es?\s+de\s+pagamento)[\s\S]{0,1500}/i
    );
    const trecho = bloco ? bloco[0] : texto;
    const reLinha = /^(\d{1,3})\s*%\s*(.+)$/gim;
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
    const mEmp = texto.match(/(?:cliente|para|proposta\s+para)\s*[:\-]?\s*([A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇ0-9\s.&-]{2,40})/i);
    if (mEmp) empresa = mEmp[1].split(/\n|ref|projeto/i)[0].trim();
    const mRef = texto.match(/(?:ref(?:er[eê]ncia)?|projeto)\s*[:\-]?\s*([^\n$]{3,60})/i);
    if (mRef) {
      ref = mRef[1].trim();
      if (/^r\$\s*[\d.,]+$/i.test(ref)) ref = "";
    }
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

  function parseTexto(texto) {
    if (!texto || texto.length < 40) return null;
    const t = texto.replace(/\u00a0/g, " ");
    const cats = parseItens(t);
    const nItens = contarItens(cats);
    const valorFinalProjeto = parseValorFinalProjeto(t);
    const forma_pagamento = parseFormaPagamento(t);
    const { pct, label } = parseDesconto(t);

    const temSinal =
      nItens >= 1 ||
      valorFinalProjeto > 0 ||
      forma_pagamento.length >= 2 ||
      pct > 0;

    if (!temSinal) return null;

    if (nItens === 0 && valorFinalProjeto > 0) {
      cats.servicos = {
        qtd: 1,
        total: valorFinalProjeto,
        itens: [{ desc: "Valor do último orçamento (PDF)", preco: valorFinalProjeto }],
      };
    }

    if (cats.servicos && !cats.externas && !cats.internas && !cats.plantas) {
      cats.externas = cats.servicos;
    }

    const meta = parseClienteRef(t);

    return {
      ref: meta.ref || "Último orçamento (PDF)",
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
    if (proposta.desconto_pct) partes.push(`desconto ${proposta.desconto_pct}%`);
    if (r.valor_final) partes.push(`total R$${r.valor_final.toLocaleString("pt-BR")}`);
    return partes.join(" · ");
  }

  window.FlyingHistoricoPdf = {
    parseTexto,
    registrar,
    getRegistro,
    listarRegistros,
    ultimaProposta,
    temCliente,
    limpar,
    resumoHtml,
    normEmpresa,
    propostaTemDados,
  };
})();
