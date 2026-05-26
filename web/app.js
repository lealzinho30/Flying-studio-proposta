// app.js — controlador principal da SPA
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const form = $("form-proposta");
  const erro = $("erro");

  let docxBlob = null;
  let docxNome = "Proposta_Flying.docx";
  let estadoUltimo = null;
  let extrasUltimo = null;

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

  function renderExtras(extras) {
    const wrap = $("r-extras");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!extras || !extras.qtd) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    const { brl } = window.FlyingDocx;

    const grupos = [
      ["tour_virtual", "Tour Virtual"],
      ["filmes", "Filmes"],
      ["apps", "Aplicações"],
      ["maquete", "Maquete"],
      ["drone", "Drone"],
      ["estudo_fachada", "Estudo de Fachada"],
      ["diversos", "Outros"],
    ];

    let html = `<h2>Serviços extras <span class="muted">${extras.qtd} item(ns) · total ${brl(extras.total)}</span></h2>`;
    for (const [chave, nome] of grupos) {
      const g = extras[chave];
      if (!g || !g.subsecoes.length) continue;
      html += `<div class="bloco-cat"><h3>${nome} · <span class="muted">${g.qtd} item(ns)</span></h3><table class="itens">`;
      html += `<thead><tr><th>#</th><th>Serviço</th><th>Detalhamento</th><th>Preço</th></tr></thead><tbody>`;
      g.subsecoes.forEach((sub, i) => {
        const det = (sub.itens && sub.itens.length) ? sub.itens.join(" · ") : "";
        const preco = sub.sem_preco ? `<span style="color:var(--orange)">a definir</span>` : brl(sub.preco);
        html += `<tr><td class="num">${i+1}</td><td>${sub.rotulo_secao || sub.rotulo_curto}</td><td class="fonte" style="font-family:inherit">${det}</td><td class="preco">${preco}</td></tr>`;
      });
      html += `</tbody><tfoot><tr><td colspan="3"><strong>Subtotal ${nome}</strong></td><td class="preco"><strong>${brl(g.total)}</strong></td></tr></tfoot>`;
      html += `</table></div>`;
    }
    wrap.innerHTML = html;
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
    const escopoSel = window.FlyingEscopo ? window.FlyingEscopo.getSelecionados() : [];
    if (escopoSel.length) {
      window.FlyingEscopo.aplicarNoParsed(parsed, escopoSel);
    }

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
    const extrasEstr = window.FlyingOrc.montarExtras(parsed);
    const ultProp = window.FlyingOrc.ultimaPropostaDe(cliente.empresa);
    const histVeioDoPdf = ultProp && ultProp.origem === "pdf_upload";

    let estrategia = parsed.estrategia;
    if (estrategia === "auto") estrategia = hist ? "historico" : "planilha";
    if (estrategia === "historico" && !hist) {
      parsed._avisos.push(`Cliente '${cliente.empresa}' sem histórico — envie o PDF do último orçamento ou use planilha.`);
      estrategia = "planilha";
    }
    if (estrategia === "historico" && histVeioDoPdf) {
      parsed._avisos.push(`Preços e pagamento baseados no PDF do último orçamento (${ultProp._resumo && ultProp._resumo.itens} itens).`);
    }
    const orc = estrategia === "historico" ? hist : plan;

    // ===== render do resultado =====
    $("r-titulo").innerHTML = `${cliente.empresa} <span class="grad">· ${cliente.ref}</span>`;
    const total = (descricoes.externas.length + descricoes.internas.length + descricoes.plantas.length);
    const extrasInfo = extrasEstr.qtd ? ` · <strong>${extrasEstr.qtd}</strong> serviço(s) extra(s)` : "";
    $("r-meta").innerHTML = `A/C: <strong>${cliente.contato}</strong> · ${total} imagens${extrasInfo} · Desconto ${descontoPct}% · Estratégia escolhida: <strong>${estrategia}</strong> <span class="origem-tag">parser: ${parsed._origem}</span>`;

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
      const badgePdf = histVeioDoPdf
        ? `<p class="hist-pdf-badge">📄 Lido do último orçamento em PDF</p>`
        : "";
      const parcelas =
        ultProp && ultProp.forma_pagamento && ultProp.forma_pagamento.length
          ? `<ul class="hist-parcelas">${ultProp.forma_pagamento
              .map((p) => `<li><strong>${p.percentual}%</strong> — ${p.marco}</li>`)
              .join("")}</ul>`
          : "";
      histDiv.innerHTML = `
        ${badgePdf}
        <ul class="resumo" id="resumo-hist"></ul>
        <p class="subtotal" id="subtotal-hist"></p>
        <p class="desc" id="desc-hist"></p>
        <p class="total" id="total-hist"></p>
        ${parcelas ? `<p class="hist-pag-label">Forma de pagamento (último projeto):</p>${parcelas}` : ""}`;
      renderResumo(hist, "hist");
    } else {
      histDiv.innerHTML = `
        <p class="sem-hist">Cliente <strong>${cliente.empresa}</strong> não está no histórico ainda.</p>
        <p class="sem-hist-sub">Envie o PDF do último orçamento no card <em>Histórico do Cliente</em> ou cadastre o cliente no sistema.</p>`;
    }

    $("r-estrategia-rotulo").textContent = `(estratégia ${estrategia})`;
    renderTabelas(orc);
    renderExtras(extrasEstr);
    $("r-texto-original").textContent = texto;

    // ===== gera o DOCX em memória =====
    const ult = ultProp || window.FlyingOrc.ultimaPropostaDe(cliente.empresa);
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
      extrasEstruturados: extrasEstr,
    });

    docxBlob = blob;
    docxNome = `Proposta_Flying_${slug(cliente.empresa)}_${slug(cliente.ref)}_${estrategia}.docx`;

    $("btn-download").textContent = `⬇ Baixar ${docxNome}`;
    $("btn-download-2").textContent = `⬇ Baixar proposta ${docxNome}`;

    extrasUltimo = extrasEstr;
    estadoUltimo = { cliente, orc, estrategia, extrasEstr };
    trocarTela("resultado");
  }

  function valorFinalCompleto(orc, extrasEstr) {
    const sub = orc.subtotal + ((extrasEstr && extrasEstr.total) || 0);
    return sub - sub * (orc.desconto_pct / 100);
  }

  function registrarDownloadHistorico() {
    const hd = window.FlyingHistoricoDownloads;
    if (!hd || !estadoUltimo) return;
    const { cliente, orc, estrategia, extrasEstr } = estadoUltimo;
    hd.registrar({
      arquivo: docxNome,
      empresa: cliente.empresa,
      ref: cliente.ref,
      contato: cliente.contato,
      estrategia,
      valorFinal: valorFinalCompleto(orc, extrasEstr),
      descontoPct: orc.desconto_pct,
      qtdImagens: orc.total_imagens,
      qtdExtras: (extrasEstr && extrasEstr.qtd) || 0,
      resumo: {
        externas: orc.externas.qtd,
        internas: orc.internas.qtd,
        plantas: orc.plantas.qtd,
        totalExternas: orc.externas.total,
        totalInternas: orc.internas.total,
        totalPlantas: orc.plantas.total,
      },
    });
    renderHistoricoDownloads();
  }

  function renderHistoricoDownloads() {
    const hd = window.FlyingHistoricoDownloads;
    const listaEl = $("historico-word-lista");
    const countEl = $("historico-word-count");
    if (!hd || !listaEl) return;

    const lista = hd.carregar();
    if (countEl) countEl.textContent = String(lista.length);

    if (!lista.length) {
      listaEl.innerHTML = '<p class="historico-word-vazio">Nenhum download registrado ainda. Baixe uma proposta Word para aparecer aqui.</p>';
      return;
    }

    const { brl } = window.FlyingDocx;
    listaEl.innerHTML = lista.map((item) => {
      const res = item.resumo || {};
      const detalhe = [
        `<p><strong>Arquivo:</strong> ${item.arquivo}</p>`,
        `<p><strong>Baixado em:</strong> ${hd.formatarData(item.baixadoEm)}</p>`,
        `<p><strong>A/C:</strong> ${item.contato}</p>`,
        `<p><strong>Estratégia:</strong> ${item.estrategia}</p>`,
        item.descontoPct ? `<p><strong>Desconto:</strong> ${item.descontoPct}%</p>` : "",
        `<p><strong>Itens:</strong> ${item.qtdImagens} imagem(ns)${item.qtdExtras ? ` · ${item.qtdExtras} extra(s)` : ""}</p>`,
        res.externas ? `<p>Externas: ${res.externas} · Internas: ${res.internas || 0} · Plantas: ${res.plantas || 0}</p>` : "",
        `<div class="hist-acoes"><button type="button" data-hist-remover="${item.id}">Remover do histórico</button></div>`,
      ].join("");
      return `
        <details class="historico-word-item">
          <summary>
            <span class="historico-word-item-titulo">${item.empresa} — ${item.ref}</span>
            <span class="historico-word-item-valor">${brl(item.valorFinal)}</span>
            <span class="historico-word-item-meta">${hd.formatarData(item.baixadoEm)} · ${item.arquivo}</span>
          </summary>
          <div class="historico-word-item-detalhe">${detalhe}</div>
        </details>`;
    }).join("");

    listaEl.querySelectorAll("[data-hist-remover]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        hd.remover(btn.getAttribute("data-hist-remover"));
        renderHistoricoDownloads();
      });
    });
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
    registrarDownloadHistorico();
  }

  function voltar() { trocarTela("form"); }

  async function handleAnalisarPlanta(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const status = $("analisador-status");
    const btn = $("btn-analisar-planta");
    const analisador = window.FlyingAnalisadorPlantas;

    if (!analisador) {
      mostrarErro("Módulo de análise de plantas não carregou. Recarregue a página.");
      return;
    }

    status.classList.remove("hidden");
    mostrarErro("");
    btn.disabled = true;
    const nomeArq = file.name;

    try {
      status.innerHTML = `<span class="upload-loading">⏳ Preparando <strong>${nomeArq}</strong>…</span>`;

      const resultado = await analisador.analisarPdfProjeto(file, {
        onProgress: (i, lim, total) => {
          status.innerHTML = `<span class="upload-loading">⏳ Página ${i}/${lim} de ${total}…</span>`;
        },
        onStatus: (msg) => {
          status.innerHTML = `<span class="upload-loading">⏳ ${msg}</span>`;
        },
      });

      const lg = resultado.listagem;
      const parsed = window.FlyingParser.parse($("descricao").value.trim());
      const temCliente = parsed.cliente && parsed.cliente.empresa;
      const bloco = analisador.listagemParaTexto(lg, { mesclarCliente: !temCliente });

      const ta = $("descricao");
      const atual = ta.value.trim();
      const cabecalho = `\n\n# === Listagem automática (IA) — ${nomeArq} ===\n`;
      ta.value = atual ? `${atual}${cabecalho}${bloco}` : bloco;
      ta.focus();

      const nExt = lg.externas.length;
      const nInt = lg.internas.length;
      const nPla = lg.plantas.length;
      let extra = "";
      if (resultado.meta.truncado) {
        extra = ` <span class="upload-aviso">(só as primeiras ${resultado.meta.analisadas} de ${resultado.meta.totalPages} páginas)</span>`;
      }
      status.innerHTML = `<span class="upload-ok">✓ <strong>${resultado.total}</strong> imagens sugeridas (${nExt} externas · ${nInt} internas · ${nPla} plantas) via ${resultado.provider}.${extra} Revise a lista abaixo e clique em Gerar proposta.</span>`;
    } catch (err) {
      status.innerHTML = `<span class="upload-erro">❌ ${err.message}<br><span class="upload-aviso">Configure <code>ANTHROPIC_API_KEY</code> nas variáveis do Netlify. Veja <code>docs/ANALISADOR_PLANTAS.md</code>.</span></span>`;
    } finally {
      btn.disabled = false;
      ev.target.value = "";
    }
  }

  // Upload de arquivo do cliente
  async function handleArquivoCliente(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const status = $("upload-status");
    status.classList.remove("hidden");
    status.innerHTML = `<span class="upload-loading">⏳ Lendo <strong>${file.name}</strong>...</span>`;

    try {
      const r = await window.FlyingFileReader.lerArquivo(file);
      if (!r.texto) {
        status.innerHTML = `<span class="upload-erro">❌ Não consegui extrair texto de ${file.name}.${r.aviso ? " " + r.aviso : ""}</span>`;
        return;
      }
      const ta = $("descricao");
      const atual = ta.value.trim();
      if (!atual) {
        ta.value = r.texto;
      } else {
        ta.value = atual + "\n\n# === Importado de " + file.name + " ===\n" + r.texto;
      }
      status.innerHTML = `<span class="upload-ok">✓ Importado <strong>${file.name}</strong> (${r.linhas} linhas).${r.aviso ? "<br><span class='upload-aviso'>⚠ " + r.aviso + "</span>" : ""}</span>`;
      ta.focus();
    } catch (err) {
      status.innerHTML = `<span class="upload-erro">❌ Erro: ${err.message}</span>`;
    }
    e.target.value = ""; // permite re-importar o mesmo arquivo
  }

  function empresaAtualForm() {
    const parsed = window.FlyingParser.parse($("descricao").value.trim());
    return (parsed.cliente && parsed.cliente.empresa) || "";
  }

  function atualizarUiHistoricoPdf() {
    const blocoAtivo = $("hist-pdf-ativo");
    const status = $("hist-upload-status");
    const btnUpload = $("btn-historico-pdf");
    if (!blocoAtivo) return;

    const empresa = empresaAtualForm();
    const hp = window.FlyingHistoricoPdf;
    const reg = empresa && hp ? hp.getRegistro(empresa) : null;

    if (reg && reg.proposta) {
      blocoAtivo.classList.remove("hidden");
      $("hist-pdf-nome").textContent = reg.nomeArquivo
        ? `PDF: ${reg.nomeArquivo}`
        : `Histórico PDF — ${reg.empresa}`;
      if (btnUpload) btnUpload.textContent = "📄 Trocar PDF do último orçamento";
      status.classList.remove("hidden");
      status.innerHTML = `<span class="upload-ok">✓ ${hp.resumoHtml(reg.proposta)}</span>`;
    } else {
      blocoAtivo.classList.add("hidden");
      if (btnUpload) btnUpload.textContent = "📄 Último orçamento enviado (PDF)";
      const temOutro = hp && hp.listarRegistros().length;
      if (!temOutro) status.classList.add("hidden");
    }
  }

  function removerHistoricoPdf() {
    const empresa = empresaAtualForm();
    const hp = window.FlyingHistoricoPdf;
    if (!hp) return;
    if (empresa) {
      hp.limpar(empresa);
    } else {
      hp.limpar();
    }
    const status = $("hist-upload-status");
    status.classList.remove("hidden");
    status.innerHTML = `<span class="upload-aviso">PDF removido. Você pode enviar outro arquivo ou usar o histórico embutido.</span>`;
    atualizarUiHistoricoPdf();
  }

  async function handleHistoricoPdf(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const status = $("hist-upload-status");
    status.classList.remove("hidden");
    status.innerHTML = `<span class="upload-loading">⏳ Lendo <strong>${file.name}</strong>...</span>`;

    try {
      const ler = window.FlyingFileReader.lerArquivoHistorico || window.FlyingFileReader.lerArquivo;
      const r = await ler(file);
      if (!r.texto) {
        const det = r.aviso || "Arquivo vazio ou sem texto.";
        status.innerHTML = `<span class="upload-erro">❌ ${det}<br><span class="upload-aviso">Dica: use o PDF exportado do InDesign/Word (com texto), ou envie o .docx da proposta.</span></span>`;
        return;
      }
      const proposta = window.FlyingHistoricoPdf.parseTexto(r.texto, { nomeArquivo: file.name });
      if (!proposta) {
        const nPrecos = window.FlyingHistoricoPdf.extrairTodosPrecos(r.texto).length;
        status.innerHTML = `<span class="upload-erro">❌ Li ${r.chars || r.texto.length} caracteres, mas não identifiquei orçamento (${nPrecos} valor(es) R$ encontrados).<br><span class="upload-aviso">Confira se é o PDF comercial Flying. Se for só imagem/scan, exporte com texto ou mande o .docx.</span></span>`;
        return;
      }

      const parsedMini = window.FlyingParser.parse($("descricao").value.trim());
      let empresa = (parsedMini.cliente && parsedMini.cliente.empresa) || "";
      const refFromPdf = (function () {
        const m = r.texto.match(/(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s*([^\n$]{3,60})/i);
        return m ? m[1].trim() : "";
      })();
      if (!empresa) {
        const mEmp = r.texto.match(/(?:cliente|para|proposta\s+para)\s*[:\-]?\s*([A-ZÁÉÍÓÚÃÕÇ][A-ZÁÉÍÓÚÃÕÇ0-9\s.&-]{2,40})/i);
        if (mEmp) empresa = mEmp[1].split(/\n|ref|projeto/i)[0].trim();
      }
      if (!empresa) empresa = window.FlyingHistoricoPdf.empresaDoArquivo(file.name) || "";
      if (!empresa) {
        status.innerHTML = `<span class="upload-erro">❌ Informe <code>Cliente: NOME</code> na descrição <em>ou</em> use um arquivo com o nome do cliente (ex.: Flying_Galli_...pdf).</span>`;
        return;
      }

      if (refFromPdf && !proposta.ref) proposta.ref = refFromPdf;
      window.FlyingHistoricoPdf.registrar(empresa, proposta, { nomeArquivo: file.name });

      const radioHist = document.querySelector('input[name="estrategia"][value="historico"]');
      if (radioHist) {
        radioHist.checked = true;
        document.querySelectorAll(".opt-card").forEach((c) => c.classList.remove("selecionado"));
        radioHist.closest(".opt-card").classList.add("selecionado");
      }

      atualizarUiHistoricoPdf();
      status.innerHTML = `<span class="upload-ok">✓ ${window.FlyingHistoricoPdf.resumoHtml(proposta)}<br><span class="upload-aviso">Cliente: <strong>${empresa}</strong> — pronto para gerar. Use <strong>Remover PDF</strong> se enviou o arquivo errado.</span></span>`;
    } catch (err) {
      status.innerHTML = `<span class="upload-erro">❌ Erro: ${err.message}</span>`;
    }
    e.target.value = "";
  }

  // Cards de estratégia: clique anywhere marca o radio
  function setupCardsEstrategia() {
    document.querySelectorAll(".opt-card").forEach((card) => {
      const sync = () => {
        const sel = card.querySelector('input[type="radio"]').checked;
        document.querySelectorAll(".opt-card").forEach((c) => c.classList.remove("selecionado"));
        if (sel) card.classList.add("selecionado");
      };
      const radio = card.querySelector('input[type="radio"]');
      radio.addEventListener("change", () => {
        document.querySelectorAll(".opt-card").forEach((c) => c.classList.remove("selecionado"));
        card.classList.add("selecionado");
      });
      if (radio.checked) card.classList.add("selecionado");
    });
  }

  form.addEventListener("submit", gerar);
  $("btn-download").addEventListener("click", baixar);
  $("btn-download-2").addEventListener("click", baixar);
  $("link-novo").addEventListener("click", voltar);
  $("voltar").addEventListener("click", voltar);
  $("voltar-2").addEventListener("click", voltar);
  $("btn-upload").addEventListener("click", () => $("arquivo-cliente").click());
  $("arquivo-cliente").addEventListener("change", handleArquivoCliente);
  $("btn-analisar-planta").addEventListener("click", () => $("arquivo-planta-ia").click());
  $("arquivo-planta-ia").addEventListener("change", handleAnalisarPlanta);
  $("btn-historico-pdf").addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    $("arquivo-historico").click();
  });
  $("arquivo-historico").addEventListener("change", handleHistoricoPdf);
  $("btn-remover-historico-pdf").addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    removerHistoricoPdf();
  });
  $("descricao").addEventListener("input", () => {
    clearTimeout(window._flyingHistUiTimer);
    window._flyingHistUiTimer = setTimeout(atualizarUiHistoricoPdf, 400);
  });
  setupCardsEstrategia();
  atualizarUiHistoricoPdf();
  if (window.FlyingEscopo) {
    window.FlyingEscopo.render("escopo-tecnologias-grid");
    $("btn-escopo-limpar").addEventListener("click", () => window.FlyingEscopo.limpar());
  }

  const btnHistLimpar = $("btn-historico-word-limpar");
  if (btnHistLimpar) {
    btnHistLimpar.addEventListener("click", () => {
      if (!window.FlyingHistoricoDownloads) return;
      if (window.confirm("Limpar todo o histórico de propostas baixadas neste navegador?")) {
        window.FlyingHistoricoDownloads.limpar();
        renderHistoricoDownloads();
      }
    });
  }
  renderHistoricoDownloads();
})();
