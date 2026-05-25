// Orçamento: porte de flying/orcamento.py
// Faz os 2 levantamentos (planilha vs histórico do cliente).

(function () {
  "use strict";
  const PRECOS = window.FLYING_PRECOS;
  const HIST = window.FLYING_HISTORICO;
  const { norm } = window.FlyingParser;

  const PREFIXOS = {
    externas: "Perspectiva ",
    internas: "Perspectiva ",
    plantas: "Planta Humanizada ",
  };
  const PREFIXOS_OK = {
    externas: ["perspectiva", "estudo de fachada", "estudo cromatic"],
    internas: ["perspectiva"],
    plantas: ["planta"],
  };

  function classificar(descricao, categoria) {
    const bloco = PRECOS[categoria];
    const alvo = norm(descricao);
    for (const linha of bloco.tabela) {
      for (const padrao of linha.padroes) {
        if (new RegExp(padrao).test(alvo)) {
          return { chave: linha.chave, descricao_padrao: linha.descricao, preco: linha.preco };
        }
      }
    }
    return { chave: "default", descricao_padrao: bloco._descricao_padrao, preco: bloco._default };
  }

  function formataDescricao(descUsuario, categoria) {
    const desc = (descUsuario || "").trim();
    const n = norm(desc);
    const okList = PREFIXOS_OK[categoria] || [];
    if (okList.some((p) => n.startsWith(p))) {
      return desc.charAt(0).toUpperCase() + desc.slice(1);
    }
    return PREFIXOS[categoria] + desc;
  }

  function buildOrcamento(estrategia, descricoes, descontoPct) {
    const cats = { externas: { nome: "externas", itens: [] }, internas: { nome: "internas", itens: [] }, plantas: { nome: "plantas", itens: [] } };
    cats.externas.total = 0; cats.internas.total = 0; cats.plantas.total = 0;
    cats.externas.qtd = 0; cats.internas.qtd = 0; cats.plantas.qtd = 0;
    return {
      estrategia, externas: cats.externas, internas: cats.internas, plantas: cats.plantas,
      desconto_pct: descontoPct || 0,
      get subtotal() { return this.externas.total + this.internas.total + this.plantas.total; },
      get desconto_valor() { return this.subtotal * (this.desconto_pct / 100); },
      get total_final() { return this.subtotal - this.desconto_valor; },
      get total_imagens() { return this.externas.qtd + this.internas.qtd + this.plantas.qtd; },
    };
  }

  function pushItem(cat, descUsuario, preco, fonte, categoria) {
    const item = {
      descricao: descUsuario,
      descricao_normalizada: formataDescricao(descUsuario, categoria),
      preco,
      fonte,
    };
    cat.itens.push(item);
    cat.qtd += 1;
    cat.total += preco;
  }

  function orcarPelaPlanilha(descricoes, descontoPct) {
    const orc = buildOrcamento("planilha", descricoes, descontoPct);
    for (const cat of ["externas", "internas", "plantas"]) {
      for (const desc of descricoes[cat] || []) {
        const c = classificar(desc, cat);
        pushItem(orc[cat], desc, c.preco, `planilha:${c.chave}`, cat);
      }
    }
    return orc;
  }

  function _achaCliente(nome) {
    if (!nome) return null;
    const alvo = nome.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    for (const k of Object.keys(HIST)) {
      const kn = k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (kn === alvo) return k;
    }
    return null;
  }

  function _ultimaProposta(nome) {
    const k = _achaCliente(nome);
    if (!k) return null;
    const props = (HIST[k].propostas || []).filter((p) => p.externas);
    if (!props.length) return null;
    return props.slice().sort((a, b) => (a.data || "").localeCompare(b.data || "")).pop();
  }

  function tabelaInferida(nome) {
    const u = _ultimaProposta(nome);
    if (!u) return null;
    const tabela = { externas: {}, internas: {}, plantas: {} };
    for (const cat of ["externas", "internas", "plantas"]) {
      for (const it of (u[cat] && u[cat].itens) || []) {
        tabela[cat][norm(it.desc)] = it.preco;
      }
    }
    return tabela;
  }

  function mediasCategoria(nome) {
    const u = _ultimaProposta(nome);
    if (!u) return null;
    const out = {};
    for (const cat of ["externas", "internas", "plantas"]) {
      if (u[cat] && u[cat].qtd) out[cat] = u[cat].total / u[cat].qtd;
    }
    return out;
  }

  function orcarPeloHistorico(empresa, descricoes, descontoPct) {
    if (!_achaCliente(empresa)) return null;
    const tab = tabelaInferida(empresa) || { externas: {}, internas: {}, plantas: {} };
    const medias = mediasCategoria(empresa) || {};
    const orc = buildOrcamento("historico:" + empresa, descricoes, descontoPct);

    for (const cat of ["externas", "internas", "plantas"]) {
      for (const desc of descricoes[cat] || []) {
        const chave = norm(desc);
        let preco = null, fonte = "";

        if (tab[cat][chave] !== undefined) {
          preco = tab[cat][chave];
          fonte = `historico:${empresa}:item_exato`;
        }
        if (preco === null) {
          for (const [k, v] of Object.entries(tab[cat])) {
            if (chave.includes(k) || k.includes(chave)) {
              preco = v;
              fonte = `historico:${empresa}:item_similar`;
              break;
            }
          }
        }
        if (preco === null && medias[cat] !== undefined) {
          preco = Math.round(medias[cat]);
          fonte = `historico:${empresa}:media_categoria`;
        }
        if (preco === null) {
          const c = classificar(desc, cat);
          preco = c.preco;
          fonte = `fallback_planilha:${c.chave}`;
        }
        pushItem(orc[cat], desc, preco, fonte, cat);
      }
    }
    return orc;
  }

  function comparar(empresa, descricoes, descontoPct) {
    const plan = orcarPelaPlanilha(descricoes, descontoPct);
    const hist = orcarPeloHistorico(empresa, descricoes, descontoPct);
    return { planilha: plan, historico: hist };
  }

  function ultimaPropostaDe(empresa) {
    return _ultimaProposta(empresa);
  }

  window.FlyingOrc = { comparar, orcarPelaPlanilha, orcarPeloHistorico, ultimaPropostaDe };
})();
