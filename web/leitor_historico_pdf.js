// leitor_historico_pdf.js — extrai do PDF do último orçamento:
// itens/preços por categoria, desconto, forma de pagamento e prazos.
//
// API:
//   window.FlyingHistoricoPdf.parseTexto(texto) -> proposta | null
//   window.FlyingHistoricoPdf.registrar(empresa, proposta)
//   window.FlyingHistoricoPdf.ultimaProposta(empresa)
//   window.FlyingHistoricoPdf.temCliente(empresa)
//   window.FlyingHistoricoPdf.limpar(empresa?)

(function () {
  "use strict";
  const { norm } = window.FlyingParser;

  const STORAGE_KEY = "flying_historico_pdf_v1";

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

  function detectarCategoria(linha, atual) {
    const n = norm(linha);
    if (/ilustra.{0,6}extern|perspectivas?\s+extern|\bexternas\b/.test(n)) return "externas";
    if (/ilustra.{0,6}intern|perspectivas?\s+intern|\binternas\b/.test(n)) return "internas";
    if (/plantas?\s+humaniz|plantas?\s+baix|\bplantas\b|implanta/.test(n)) return "plantas";
    return atual;
  }

  function montarBloco(itens) {
    const total = itens.reduce((s, x) => s + x.preco, 0);
    return { qtd: itens.length, total, itens };
  }

  function parseItens(texto) {
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let cat = null;
    const buckets = { externas: [], internas: [], plantas: [] };

    for (const linha of linhas) {
      cat = detectarCategoria(linha, cat);
      const precos = extrairPrecosLinha(linha);
      if (!precos.length) continue;

      const alvo = norm(linha);
      const pareceTotal =
        /total|subtotal|investimento|valor\s+final|desconto|pagamento|prazo/i.test(linha) &&
        precos.length === 1;
      if (pareceTotal && !/perspectiva|planta|implanta|fachada|filme|tour|app/i.test(alvo)) continue;

      for (const { idx, preco } of precos) {
        let desc = limpaDescricao(linha.slice(0, idx));
        if (!desc || desc.length < 3) {
          desc = limpaDescricao(linha);
        }
        if (!desc || desc.length < 3) continue;
        if (/^total\b|^subtotal\b|^valor\b/i.test(desc)) continue;

        const c =
          cat ||
          (/\bplanta\b|implanta/.test(norm(desc)) ? "plantas" : null) ||
          (/\bperspectiva\b/.test(norm(desc)) && /intern|lobby|academia|sauna|festas|coworking/.test(norm(desc))
            ? "internas"
            : null) ||
          (/\bperspectiva\b|fachada|fotomontagem|voo|bird/.test(norm(desc)) ? "externas" : null) ||
          "externas";

        buckets[c].push({ desc, preco });
      }
    }

    const out = {};
    for (const k of ["externas", "internas", "plantas"]) {
      if (buckets[k].length) out[k] = montarBloco(buckets[k]);
    }
    return out;
  }

  function parseDesconto(texto) {
    const m =
      texto.match(/(\d{1,2})\s*%\s*(?:de\s+)?desconto/i) ||
      texto.match(/desconto\s*(?:de\s+)?(\d{1,2})\s*%/i) ||
      texto.match(/desconto\s+especial\s+de\s+(\d{1,2})\s*%/i);
    if (!m) return { pct: 0, label: "" };
    const pct = parseInt(m[1], 10);
    const label = m[0].trim();
    return { pct: Number.isFinite(pct) ? pct : 0, label };
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
      let marco = (m[2] || "").replace(/\s+/g, " ").trim();
      marco = marco.replace(/[.;,]+$/, "").trim();
      if (/desconto|parceria|off\b/i.test(marco)) continue;
      if (pct > 0 && pct <= 100 && marco.length > 4) {
        parcelas.push({ percentual: pct, marco });
      }
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
    const mRef = texto.match(/(?:ref(?:er[eê]ncia)?|projeto)\s*[:\-]?\s*([^\n]{3,60})/i);
    if (mRef) ref = mRef[1].trim();
    return { empresa, ref };
  }

  function parseTexto(texto) {
    if (!texto || texto.length < 80) return null;
    const t = texto.replace(/\u00a0/g, " ");
    const cats = parseItens(t);
    const nItens =
      (cats.externas && cats.externas.qtd || 0) +
      (cats.internas && cats.internas.qtd || 0) +
      (cats.plantas && cats.plantas.qtd || 0);
    if (!nItens || nItens < 2) return null;

    const { pct, label } = parseDesconto(t);
    const forma_pagamento = parseFormaPagamento(t);
    const prazos = parsePrazos(t);
    const meta = parseClienteRef(t);

    return {
      ref: meta.ref || "Último orçamento (PDF)",
      data: new Date().toISOString().slice(0, 10),
      origem: "pdf_upload",
      desconto_pct: pct,
      desconto_label: label || (pct ? `${pct}% de desconto` : ""),
      forma_pagamento,
      prazos: prazos || (window.FLYING_PRECOS && window.FLYING_PRECOS.prazos_padrao) || null,
      externas: cats.externas,
      internas: cats.internas,
      plantas: cats.plantas,
      _resumo: {
        itens: nItens,
        media_externa: cats.externas ? Math.round(cats.externas.total / cats.externas.qtd) : null,
        media_interna: cats.internas ? Math.round(cats.internas.total / cats.internas.qtd) : null,
        media_planta: cats.plantas ? Math.round(cats.plantas.total / cats.plantas.qtd) : null,
        parcelas: forma_pagamento.length,
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
    return !!ultimaProposta(empresa);
  }

  function limpar(empresa) {
    if (empresa) {
      delete memStore[normEmpresa(empresa)];
    } else {
      memStore = {};
    }
    saveStore(memStore);
  }

  function resumoHtml(proposta) {
    if (!proposta || !proposta._resumo) return "";
    const r = proposta._resumo;
    const partes = [`${r.itens} itens lidos do PDF`];
    if (r.media_externa) partes.push(`média externa R$${r.media_externa.toLocaleString("pt-BR")}`);
    if (r.media_interna) partes.push(`média interna R$${r.media_interna.toLocaleString("pt-BR")}`);
    if (r.media_planta) partes.push(`média planta R$${r.media_planta.toLocaleString("pt-BR")}`);
    if (r.parcelas) partes.push(`${r.parcelas} parcela(s) de pagamento`);
    if (proposta.desconto_pct) partes.push(`desconto ${proposta.desconto_pct}%`);
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
  };
})();
