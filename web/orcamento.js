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

  function _historicoPdf() {
    return window.FlyingHistoricoPdf || null;
  }

  function _achaCliente(nome) {
    if (!nome) return null;
    const alvo = nome.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const hp = _historicoPdf();
    if (hp && hp.temCliente(nome)) return alvo;
    for (const k of Object.keys(HIST)) {
      const kn = k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (kn === alvo) return k;
    }
    return null;
  }

  function _ultimaProposta(nome) {
    const hp = _historicoPdf();
    if (hp) {
      const imp = hp.ultimaProposta(nome);
      if (imp && imp.externas) return imp;
    }
    const k = _achaCliente(nome);
    if (!k || !HIST[k]) return null;
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
    if (!_ultimaProposta(empresa)) return null;
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

  // ================== EXTRAS (Tour Virtual / Filmes / Apps / Drone) ==================

  // Tenta achar a melhor variante na lista do catálogo dado uma descrição livre.
  function _matchVariante(texto, catalogo) {
    if (!catalogo) return null;
    const alvo = norm(texto);
    for (const item of catalogo) {
      for (const padrao of item.padroes || []) {
        if (new RegExp(padrao).test(alvo)) return item;
      }
    }
    return catalogo.find((x) => x.chave === "outro") || null;
  }

  // Constrói a estrutura de extras a partir do que o parser entregou.
  function montarExtras(parsed) {
    const PRECOS = window.FLYING_PRECOS;
    const out = {
      tour_virtual: { titulo: "VISITA VIRTUAL WEB – MULTIPLATAFORMA", subsecoes: [] },
      filmes:       { titulo: "FILMES E ANIMAÇÕES", subsecoes: [] },
      apps:         { titulo: "APLICAÇÕES E EXPERIÊNCIAS DIGITAIS", subsecoes: [] },
      drone:        { titulo: "DRONE / FOTOGRAFIA AÉREA", subsecoes: [] },
      maquete:      { titulo: "MAQUETE ELETRÔNICA", subsecoes: [] },
      estudo_fachada: { titulo: "ESTUDO DE FACHADA / CROMÁTICA", subsecoes: [] },
      diversos:     { titulo: "OUTROS SERVIÇOS", subsecoes: [] },
      total: 0,
      qtd: 0,
    };

    const TV = PRECOS.tour_virtual;
    const FL = PRECOS.filmes;
    const APP = PRECOS.apps;
    const DR = PRECOS.drone;
    const MQ = PRECOS.maquete_eletronica;
    const EF = PRECOS.estudo_fachada;

    // Tour Virtual
    for (const desc of parsed.tour_virtual || []) {
      const v = _matchVariante(desc, TV.ambientes);
      if (v) {
        out.tour_virtual.subsecoes.push({
          chave: v.chave,
          rotulo_secao: `${TV._titulo_secao} – ${v.rotulo}`,
          rotulo_curto: v.rotulo,
          preco: v.preco,
          itens: TV._itens_padrao.slice(),
          desc_original: desc,
        });
      }
    }
    // Filmes (cabeçalho explícito)
    for (const desc of parsed.filmes || []) {
      const v = _matchVariante(desc, FL.catalogo);
      if (v && v.chave !== undefined) {
        out.filmes.subsecoes.push({
          chave: v.chave, rotulo_secao: v.rotulo, rotulo_curto: v.rotulo,
          preco: v.preco, itens: (v.itens || []).slice(),
          desc_original: desc,
        });
      }
    }
    // Apps
    for (const desc of parsed.apps || []) {
      const v = _matchVariante(desc, APP.catalogo);
      if (v) {
        out.apps.subsecoes.push({
          chave: v.chave, rotulo_secao: v.rotulo, rotulo_curto: v.rotulo,
          preco: v.preco, itens: (v.itens || []).slice(),
          desc_original: desc,
        });
      }
    }
    // Drone
    for (const desc of parsed.drone || []) {
      const v = _matchVariante(desc, DR.catalogo);
      if (v) {
        out.drone.subsecoes.push({
          chave: v.chave, rotulo_secao: v.rotulo, rotulo_curto: v.rotulo,
          preco: v.preco, itens: [], desc_original: desc,
        });
      }
    }

    // Detectados soltos (catch-all do parser)
    for (const det of parsed.extras_detectados || []) {
      const subsec = {
        chave: det.chave,
        rotulo_secao: det.rotulo,
        rotulo_curto: det.rotulo,
        preco: det.preco,
        itens: [],
        desc_original: det.rotulo,
      };
      if (det.tipo === "tour_virtual") {
        if (out.tour_virtual.subsecoes.some((s) => s.chave === det.chave)) continue;
        subsec.rotulo_secao = `${TV._titulo_secao} – ${det.rotulo}`;
        subsec.itens = TV._itens_padrao.slice();
        out.tour_virtual.subsecoes.push(subsec);
      } else if (det.tipo === "filme") {
        if (out.filmes.subsecoes.some((s) => s.chave === det.chave)) continue;
        const meta = (FL.catalogo || []).find((x) => x.chave === det.chave);
        subsec.itens = (meta && meta.itens) || [];
        out.filmes.subsecoes.push(subsec);
      } else if (det.tipo === "app") {
        if (out.apps.subsecoes.some((s) => s.chave === det.chave)) continue;
        const meta = (APP.catalogo || []).find((x) => x.chave === det.chave);
        subsec.itens = (meta && meta.itens) || [];
        out.apps.subsecoes.push(subsec);
      } else if (det.tipo === "drone") {
        if (out.drone.subsecoes.some((s) => s.chave === det.chave)) continue;
        out.drone.subsecoes.push(subsec);
      } else if (det.tipo === "maquete") {
        subsec.itens = MQ.itens.slice();
        if (!out.maquete.subsecoes.length) out.maquete.subsecoes.push(subsec);
      } else if (det.tipo === "estudo_fachada") {
        subsec.itens = EF.itens.slice();
        if (!out.estudo_fachada.subsecoes.length) out.estudo_fachada.subsecoes.push(subsec);
      }
    }

    // Diversos (não categorizados — preço a definir).
    // Antes de adicionar, descarta itens que já viraram tour virtual/filme/app/etc.
    const _todasSubsecoes = []
      .concat(out.tour_virtual.subsecoes, out.filmes.subsecoes, out.apps.subsecoes,
              out.drone.subsecoes, out.maquete.subsecoes, out.estudo_fachada.subsecoes);
    for (const desc of parsed.extras_diversos || []) {
      const descNorm = norm(desc);
      const jaProcessado = _todasSubsecoes.some((sub) => {
        const target = norm(sub.desc_original || sub.rotulo_curto || "");
        return target && (descNorm.includes(target) || target.includes(descNorm));
      });
      // Também ignora se bate com algum padrão conhecido do catálogo
      const baterCat = (cats) => (cats || []).some((c) => (c.padroes || []).some((p) => new RegExp(p).test(descNorm)));
      const conhecido = jaProcessado
        || baterCat(PRECOS.tour_virtual && PRECOS.tour_virtual.ambientes)
        || baterCat(PRECOS.filmes && PRECOS.filmes.catalogo)
        || baterCat(PRECOS.apps && PRECOS.apps.catalogo)
        || baterCat(PRECOS.drone && PRECOS.drone.catalogo)
        || (MQ && (MQ.padroes || []).some((p) => new RegExp(p).test(descNorm)))
        || (EF && (EF.padroes || []).some((p) => new RegExp(p).test(descNorm)));
      if (conhecido) continue;
      // Senão, adiciona como diverso
      out.diversos.subsecoes.push({
        chave: "diverso",
        rotulo_secao: desc.toUpperCase(),
        rotulo_curto: desc,
        preco: 0,
        itens: [],
        desc_original: desc,
        sem_preco: true,
      });
    }

    // Totais
    for (const grupo of Object.keys(out)) {
      if (grupo === "total" || grupo === "qtd") continue;
      const subs = out[grupo].subsecoes;
      out[grupo].total = subs.reduce((s, x) => s + (x.preco || 0), 0);
      out[grupo].qtd = subs.length;
      out.total += out[grupo].total;
      out.qtd += out[grupo].qtd;
    }

    return out;
  }

  window.FlyingOrc = { comparar, orcarPelaPlanilha, orcarPeloHistorico, ultimaPropostaDe, montarExtras };
})();
