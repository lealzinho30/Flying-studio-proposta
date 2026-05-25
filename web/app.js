// app.js — controlador principal da SPA
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const form = $("form-proposta");
  const erro = $("erro");

  let docxBlob = null;
  let docxNome = "Proposta_Flying.docx";
  let estadoUltimo = null;

  function slug(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase() || "PROPOSTA";
  }

  function mostrarErro(msg) {
    if (msg) {
      erro.textContent = msg;
      erro.classList.remove("hidden");
    } else {
      erro.classList.add("hidden");
    }
  }

  function trocarTela(qual) {
    $("tela-form").classList.toggle("hidden", qual !== "form");
    $("tela-resultado").classList.toggle("hidden", qual !== "resultado");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderResumo(orc, prefixoId) {
    const { brl } = window.FlyingDocx;
    const ul = $(`resumo-${prefixoId}`);
    if (ul) {
      ul.innerHTML = "";
      const linhas = [
        ["Externas", orc.externas],
        ["Internas", orc.internas],
        ["Plantas", orc.plantas],
      ];
      for (const [nome, c] of linhas) {
        const li = document.createElement("li");
        li.innerHTML = `${nome}: <strong>${brl(c.total)}</strong> (${c.qtd})`;
        ul.appendChild(li);
      }
    }
    $(`subtotal-${prefixoId}`).textContent = `Subtotal: ${brl(orc.subtotal)}`;
    if (orc.desconto_pct > 0) {
      $(`desc-${prefixoId}`).textContent = `Desconto ${orc.desconto_pct}%: -${brl(orc.desconto_valor)}`;
      $(`desc-${prefixoId}`).classList.remove("hidden");
    } else {
      $(`desc-${prefixoId}`).textContent = "";
      $(`desc-${prefixoId}`).classList.add("hidden");
    }
    $(`total-${prefixoId}`).textContent = brl(orc.total_final);
  }

  function renderTabelas(orc) {
    const { brl } = window.FlyingDocx;
    const wrap = $("r-tabelas");
    wrap.innerHTML = "";
    const cats = [
      ["Ilustrações Externas", orc.externas],
      ["Ilustrações Internas", orc.internas],
      ["Plantas Humanizadas", orc.plantas],
    ];
    for (const [nome, cat] of cats) {
      if (!cat.qtd) continue;
      const div = document.createElement("div");
      div.className = "bloco-cat";
      div.innerHTML = `
        <h3>${nome} · <span class="muted">${cat.qtd} item(ns)</span></h3>
        <table class="itens">
          <thead><tr><th>#</th><th>Descrição</th><th>Preço</th><th>Fonte</th></tr></thead>
          <tbody></tbody>
          <tfoot><tr><td colspan="2"><strong>Total ${cat.qtd} itens</strong></td><td class="preco"><strong>${brl(cat.total)}</strong></td><td></td></tr></tfoot>
        </table>`;
      const tb = div.querySelector("tbody");
      cat.itens.forEach((it, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="num">${i + 1}</td><td>${it.descricao_normalizada}</td><td class="preco">${brl(it.preco)}</td><td class="fonte">${it.fonte}</td>`;
        tb.appendChild(tr);
      });
      wrap.appendChild(div);
    }
  }

  async function gerar(e) {
    e && e.preventDefault();
    mostrarErro("");
    const texto = $("descricao").value.trim();
    if (!texto) { mostrarErro("Descreva o projeto antes de gerar."); return; }

    const estrategiaForm = document.querySelector('input[name="estrategia"]:checked').value;
    const parsed = window.FlyingParser.parse(texto);

    if (estrategiaForm !== "auto" || parsed.estrategia === "auto") {
      parsed.estrategia = estrategiaForm;
    }

    const cliente = parsed.cliente;
    const descricoes = {
      externas: parsed.externas || [],
      internas: parsed.internas || [],
      plantas: parsed.plantas || [],
    };
    const descontoPct = parseFloat(parsed.desconto_pct) || 0;

    const { planilha: plan, historico: hist } = window.FlyingOrc.comparar(cliente.empresa, descricoes, descontoPct);

    let estrategia = parsed.estrategia;
    if (estrategia === "auto") estrategia = hist ? "historico" : "planilha";
    if (estrategia === "historico" && !hist) {
      parsed._avisos.push(`Cliente '${cliente.empresa}' não está no histórico — usando planilha.`);
      estrategia = "planilha";
    }
    const orc = estrategia === "historico" ? hist : plan;

    // ===== render do resultado =====
    $("r-titulo").innerHTML = `${cliente.empresa} <span class="grad">· ${cliente.ref}</span>`;
    const total = (descricoes.externas.length + descricoes.internas.length + descricoes.plantas.length);
    $("r-meta").innerHTML = `A/C: <strong>${cliente.contato}</strong> · ${total} imagens · Desconto ${descontoPct}% · Estratégia escolhida: <strong>${estrategia}</strong> <span class="origem-tag">parser: ${parsed._origem}</span>`;

    const av = $("r-avisos");
    av.innerHTML = "";
    if (parsed._avisos && parsed._avisos.length) {
      for (const a of parsed._avisos) {
        const d = document.createElement("div");
        d.className = "alerta-suave";
        d.textContent = "⚠ " + a;
        av.appendChild(d);
      }
    }

    $("cartao-plan").classList.toggle("destaque", estrategia === "planilha");
    renderResumo(plan, "plan");

    const cartaoHist = $("cartao-hist");
    const histDiv = $("hist-conteudo");
    cartaoHist.classList.toggle("destaque", estrategia === "historico");
    cartaoHist.classList.toggle("desabilitado", !hist);
    if (hist) {
      histDiv.innerHTML = `
        <ul class="resumo" id="resumo-hist"></ul>
        <p class="subtotal" id="subtotal-hist"></p>
        <p class="desc" id="desc-hist"></p>
        <p class="total" id="total-hist"></p>`;
      renderResumo(hist, "hist");
    } else {
      histDiv.innerHTML = `
        <p class="sem-hist">Cliente <strong>${cliente.empresa}</strong> não está no histórico ainda.</p>
        <p class="sem-hist-sub">A próxima vez que esse cliente fizer uma proposta, esse cartão já vai mostrar o preço dele.</p>`;
    }

    $("r-estrategia-rotulo").textContent = `(estratégia ${estrategia})`;
    renderTabelas(orc);
    $("r-texto-original").textContent = texto;

    // ===== gera o DOCX em memória =====
    const ult = window.FlyingOrc.ultimaPropostaDe(cliente.empresa);
    const formaPagamento = ult && ult.forma_pagamento;
    const prazos = ult && ult.prazos;
    const blob = await window.FlyingDocx.gerarDocxBlob({
      cliente,
      orc,
      data: new Date(),
      mostrarPrecos: parsed.mostrar_precos_individuais,
      formaPagamento,
      prazos,
      descontoLabel: parsed.desconto_label,
      extras: null,
    });

    docxBlob = blob;
    docxNome = `Proposta_Flying_${slug(cliente.empresa)}_${slug(cliente.ref)}_${estrategia}.docx`;

    $("btn-download").textContent = `⬇ Baixar ${docxNome}`;
    $("btn-download-2").textContent = `⬇ Baixar proposta ${docxNome}`;

    estadoUltimo = { cliente, orc, estrategia };
    trocarTela("resultado");
  }

  function baixar() {
    if (!docxBlob) return;
    const url = URL.createObjectURL(docxBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = docxNome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function voltar() { trocarTela("form"); }

  form.addEventListener("submit", gerar);
  $("btn-download").addEventListener("click", baixar);
  $("btn-download-2").addEventListener("click", baixar);
  $("link-novo").addEventListener("click", voltar);
  $("voltar").addEventListener("click", voltar);
  $("voltar-2").addEventListener("click", voltar);
})();
