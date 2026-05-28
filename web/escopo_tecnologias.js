// escopo_tecnologias.js — catálogo da planilha + seleção explícita (sem auto-inclusão).
//
// API:
//   FlyingEscopo.catalogo() -> grupos
//   FlyingEscopo.render() / getSelecionados() / limpar()
//   FlyingEscopo.aplicarNoParsed(parsed, selecionados)

(function () {
  "use strict";

  function brl(n) {
    return `R$${Number(n).toLocaleString("pt-BR")}`;
  }

  function catalogo() {
    const P = window.FLYING_PRECOS;
    if (!P) return [];

    const grupos = [];

    const tv = P.tour_virtual;
    if (tv && tv.ambientes) {
      grupos.push({
        id: "tour_virtual",
        titulo: "Tour Virtual / Visita Web",
        itens: tv.ambientes
          .filter((a) => a.chave !== "outro")
          .map((a) => ({
            tipo: "tour_virtual",
            chave: a.chave,
            rotulo: a.rotulo,
            preco: a.preco,
            detalhe: (tv._itens_padrao || []).slice(0, 2).join(" · "),
          })),
      });
    }

    const fl = P.filmes;
    if (fl && fl.catalogo) {
      grupos.push({
        id: "filmes",
        titulo: "Filmes e Animações",
        itens: fl.catalogo.map((f) => ({
          tipo: "filme",
          chave: f.chave,
          rotulo: f.rotulo,
          preco: f.preco,
          detalhe: f.itens && f.itens[0] ? f.itens[0] : "",
        })),
      });
    }

    const app = P.apps;
    if (app && app.catalogo) {
      grupos.push({
        id: "apps",
        titulo: "Aplicações e Experiências Digitais",
        itens: app.catalogo.map((a) => ({
          tipo: "app",
          chave: a.chave,
          rotulo: a.rotulo,
          preco: a.preco,
          detalhe: a.itens && a.itens[0] ? a.itens[0] : "",
        })),
      });
    }

    if (P.maquete_eletronica) {
      const m = P.maquete_eletronica;
      grupos.push({
        id: "maquete",
        titulo: "Maquete Eletrônica",
        itens: [{
          tipo: "maquete",
          chave: m.chave,
          rotulo: m.rotulo,
          preco: m.preco,
          detalhe: "Modelagem 3D + render 360°",
        }],
      });
    }

    if (P.estudo_fachada) {
      const e = P.estudo_fachada;
      grupos.push({
        id: "estudo_fachada",
        titulo: "Estudo de Fachada / Cromática",
        itens: [{
          tipo: "estudo_fachada",
          chave: e.chave,
          rotulo: e.rotulo,
          preco: e.preco,
          detalhe: "Serviço dedicado (não é perspectiva comum)",
        }],
      });
    }

    const dr = P.drone;
    if (dr && dr.catalogo) {
      grupos.push({
        id: "drone",
        titulo: "Drone / Fotografia Aérea",
        itens: dr.catalogo.map((d) => ({
          tipo: "drone",
          chave: d.chave,
          rotulo: d.rotulo,
          preco: d.preco,
          detalhe: "",
        })),
      });
    }

    return grupos;
  }

  function render(containerId) {
    const el = document.getElementById(containerId || "escopo-tecnologias-grid");
    if (!el) return;
    const grupos = catalogo();
    let html = "";
    for (const g of grupos) {
      html += `<div class="escopo-grupo" data-grupo="${g.id}">`;
      html += `<h4 class="escopo-grupo-titulo">${g.titulo}</h4>`;
      html += `<div class="escopo-itens">`;
      for (const it of g.itens) {
        const id = `escopo-${it.tipo}-${it.chave}`;
        html += `<label class="escopo-item">`;
        html += `<input type="checkbox" class="escopo-check" id="${id}" data-tipo="${it.tipo}" data-chave="${it.chave}" data-rotulo="${it.rotulo.replace(/"/g, "&quot;")}">`;
        html += `<span class="escopo-item-texto"><strong>${it.rotulo}</strong>`;
        html += `<span class="escopo-preco">${brl(it.preco)}</span>`;
        if (it.detalhe) html += `<span class="escopo-detalhe">${it.detalhe}</span>`;
        html += `</span></label>`;
      }
      html += `</div></div>`;
    }
    el.innerHTML = html || "<p class=\"escopo-vazio\">Catálogo de tecnologias não carregou.</p>";
  }

  function getSelecionados() {
    const out = [];
    document.querySelectorAll(".escopo-check:checked").forEach((cb) => {
      out.push({
        tipo: cb.dataset.tipo,
        chave: cb.dataset.chave,
        rotulo: cb.dataset.rotulo || cb.dataset.chave,
      });
    });
    return out;
  }

  function limpar() {
    document.querySelectorAll(".escopo-check").forEach((cb) => { cb.checked = false; });
  }

  function itemPorChave(tipo, chave) {
    for (const g of catalogo()) {
      const it = g.itens.find((x) => x.tipo === tipo && x.chave === chave);
      if (it) return it;
    }
    return null;
  }

  function aplicarNoParsed(parsed, selecionados) {
    if (!parsed || !selecionados || !selecionados.length) return parsed;

    for (const sel of selecionados) {
      const meta = itemPorChave(sel.tipo, sel.chave);
      const rotulo = (meta && meta.rotulo) || sel.rotulo || sel.chave;

      if (sel.tipo === "tour_virtual") {
        parsed.tour_virtual = parsed.tour_virtual || [];
        if (!parsed.tour_virtual.some((x) => (window.FlyingParser.norm(x)).includes(sel.chave))) {
          parsed.tour_virtual.push(rotulo);
        }
      } else if (sel.tipo === "filme") {
        parsed.filmes = parsed.filmes || [];
        if (!parsed.filmes.some((x) => window.FlyingParser.norm(x).includes(window.FlyingParser.norm(rotulo)))) {
          parsed.filmes.push(rotulo);
        }
      } else if (sel.tipo === "app") {
        parsed.apps = parsed.apps || [];
        if (!parsed.apps.some((x) => window.FlyingParser.norm(x).includes(window.FlyingParser.norm(rotulo)))) {
          parsed.apps.push(rotulo);
        }
      } else if (sel.tipo === "drone") {
        parsed.drone = parsed.drone || [];
        if (!parsed.drone.some((x) => window.FlyingParser.norm(x).includes(sel.chave))) {
          parsed.drone.push(rotulo);
        }
      } else if (sel.tipo === "maquete" || sel.tipo === "estudo_fachada") {
        parsed.extras_diversos = parsed.extras_diversos || [];
        if (!parsed.extras_diversos.some((x) => window.FlyingParser.norm(x).includes(sel.chave))) {
          parsed.extras_diversos.push(rotulo);
        }
      }
    }
    return parsed;
  }

  function sincronizarCheckboxes(parsed) {
    if (!parsed) return;
    const map = {
      tour_virtual: parsed.tour_virtual || [],
      filme: parsed.filmes || [],
      app: parsed.apps || [],
      drone: parsed.drone || [],
    };
    document.querySelectorAll(".escopo-check").forEach((cb) => {
      const tipo = cb.dataset.tipo;
      const chave = cb.dataset.chave;
      const lista = map[tipo];
      if (!lista) return;
      const n = window.FlyingParser.norm;
      const hit = lista.some((txt) => {
        const t = n(txt);
        return t.includes(n(chave)) || t.includes(n(cb.dataset.rotulo || ""));
      });
      if (hit) cb.checked = true;
    });
  }

  window.FlyingEscopo = {
    catalogo,
    render,
    getSelecionados,
    limpar,
    aplicarNoParsed,
    sincronizarCheckboxes,
    itemPorChave,
  };
})();
