// Interface de chat — mensagens em linguagem natural → estrutura Flying.
(function () {
  "use strict";

  const STORAGE_CHAT = "flying_chat_v1";
  const MSG_BOAS_VINDAS =
    "Descreva a proposta em uma frase, como se estivesse falando comigo. " +
    "Ex.: «10 perspectivas internas a definir, empresa Tarraf, projeto Vila Mariana, A/C Larissa». " +
    "Pode enviar várias mensagens; eu vou montando o briefing.";

  let mensagens = [];
  let parsedAtual = null;
  let onAtualizou = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatAssistantHtml(text) {
    return escapeHtml(text || "")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  function textoCompleto() {
    return mensagens
      .filter((m) => m.role === "user")
      .map((m) => m.text)
      .join("\n\n");
  }

  function reparseLocal() {
    let acc = null;
    for (const m of mensagens) {
      if (m.role !== "user") continue;
      const p = window.FlyingParser.parseConversacional(m.text);
      acc = window.FlyingParser.mesclarBriefing(acc, p);
    }
    parsedAtual = acc;
    if ($("descricao") && parsedAtual) {
      $("descricao").value = window.FlyingParser.serializar(parsedAtual);
    }
    return parsedAtual;
  }

  function reparse() {
    if (!textoCompleto().trim()) {
      parsedAtual = null;
      if ($("descricao")) $("descricao").value = "";
      return null;
    }
    return reparseLocal();
  }

  function iniciaisEmpresa(nome) {
    const p = (nome || "CL").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "CL";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function contagemImagens(parsed) {
    return (
      (parsed.externas && parsed.externas.length) +
      (parsed.internas && parsed.internas.length) +
      (parsed.plantas && parsed.plantas.length)
    );
  }

  function progressoBriefing(parsed) {
    if (!parsed) return 0;
    let ok = 0;
    const c = parsed.cliente || {};
    if (c.empresa && c.empresa !== "CLIENTE") ok++;
    if (c.ref && c.ref !== "PROJETO") ok++;
    if (c.contato && c.contato !== "—") ok++;
    if (contagemImagens(parsed) > 0) ok++;
    return Math.round((ok / 4) * 100);
  }

  function atualizarProgressoBriefing(parsed) {
    const bar = $("briefing-progress-bar");
    const stepBrief = $("step-briefing");
    const stepGerar = $("step-gerar");
    const pct = progressoBriefing(parsed);
    if (bar) bar.style.width = `${pct}%`;
    if (stepBrief) stepBrief.classList.toggle("page-step--on", pct >= 50);
    if (stepGerar) stepGerar.classList.toggle("page-step--on", pct >= 100);
  }

  function estimeResumoFinanceiro(parsed) {
    if (!parsed || !window.FlyingOrc || !window.FlyingDocx) return null;
    const qtd = contagemImagens(parsed);
    if (!qtd) return null;
    const desc = {
      externas: parsed.externas || [],
      internas: parsed.internas || [],
      plantas: parsed.plantas || [],
    };
    const desconto = parsed._desconto_explicito ? parsed.desconto_pct || 0 : 0;
    try {
      let orc;
      if (parsed.modo === "adicional" && parsed.cliente.empresa !== "CLIENTE") {
        orc =
          window.FlyingOrc.orcarPeloHistorico(parsed.cliente.empresa, desc, desconto, parsed) ||
          window.FlyingOrc.orcarPelaPlanilha(desc, desconto);
      } else {
        orc = window.FlyingOrc.orcarPelaPlanilha(desc, desconto);
      }
      return window.FlyingDocx.calcularTotaisInvestimento(orc, null);
    } catch (_) {
      return null;
    }
  }

  function cardFinanceiroHtml(parsed) {
    const totais = estimeResumoFinanceiro(parsed);
    if (!totais || !window.FlyingDocx) return "";
    const { brl } = window.FlyingDocx;
    const pct = totais.descontoPct || 0;

    if (pct > 0) {
      return `
        <div class="briefing-finance">
          <p class="briefing-finance-label">Estimativa · ${parsed.modo === "adicional" ? "contrato/histórico" : "tabela padrão"}</p>
          <div class="briefing-finance-row">
            <span>Valor Total das Imagens</span>
            <strong>${brl(totais.subtotalImagens)}</strong>
          </div>
          <div class="briefing-finance-row briefing-finance-row--destaque">
            <span>Com ${pct}% de desconto</span>
            <strong class="briefing-finance-total">${brl(totais.valorFinal)}</strong>
          </div>
          <p class="briefing-finance-hint">No Word: uma linha com o total das imagens e o rodapé com desconto.</p>
        </div>`;
    }

    return `
      <div class="briefing-finance">
        <p class="briefing-finance-label">Estimativa · ${parsed.modo === "adicional" ? "contrato/histórico" : "tabela padrão"}</p>
        <div class="briefing-finance-row briefing-finance-row--destaque">
          <span>Investimento estimado</span>
          <strong class="briefing-finance-total">${brl(totais.valorFinal)}</strong>
        </div>
      </div>`;
  }

  function resumoHtml(parsed) {
    if (!parsed) {
      return `
        <div class="briefing-empty">
          <div class="briefing-empty-icon" aria-hidden="true">💬</div>
          <p class="briefing-empty-title">Nada montado ainda</p>
          <p class="briefing-empty-text">Descreva cliente, projeto, imagens e desconto em uma mensagem no chat.</p>
        </div>`;
    }

    const c = parsed.cliente || {};
    const nExt = (parsed.externas && parsed.externas.length) || 0;
    const nInt = (parsed.internas && parsed.internas.length) || 0;
    const nPla = (parsed.plantas && parsed.plantas.length) || 0;
    const nImg = nExt + nInt + nPla;

    const chips = [];
    if (nImg) chips.push(`<span class="briefing-chip">${nImg} imagem(ns)</span>`);
    if (nExt) chips.push(`<span class="briefing-chip briefing-chip--ext">${nExt} ext.</span>`);
    if (nInt) chips.push(`<span class="briefing-chip briefing-chip--int">${nInt} int.</span>`);
    if (nPla) chips.push(`<span class="briefing-chip briefing-chip--pla">${nPla} plantas</span>`);
    if (parsed.modo === "adicional") {
      chips.push(`<span class="briefing-chip briefing-chip--adic">Adicional</span>`);
    }
    if (parsed.desconto_pct > 0 && parsed._desconto_explicito) {
      chips.push(`<span class="briefing-chip briefing-chip--desc">${parsed.desconto_pct}% desc.</span>`);
    }

    function listaVisual(titulo, itens, tipo) {
      if (!itens || !itens.length) return "";
      const lis = itens
        .map(
          (x) =>
            `<li><span class="briefing-item-dot briefing-item-dot--${tipo}" aria-hidden="true"></span>${escapeHtml(x)}</li>`
        )
        .join("");
      return `
        <section class="briefing-secao">
          <h3 class="briefing-secao-titulo">${titulo} <span class="briefing-secao-qtd">${itens.length}</span></h3>
          <ul class="briefing-lista">${lis}</ul>
        </section>`;
    }

    const partes = [
      `<div class="briefing-cliente-card">
        <div class="briefing-avatar" aria-hidden="true">${escapeHtml(iniciaisEmpresa(c.empresa))}</div>
        <div class="briefing-cliente-meta">
          <p class="briefing-cliente-nome">${escapeHtml(c.empresa)}</p>
          <p class="briefing-cliente-sub">${escapeHtml(c.ref)}</p>
          <p class="briefing-cliente-ac">A/C ${escapeHtml(c.contato)}</p>
        </div>
      </div>`,
      chips.length ? `<div class="briefing-chips">${chips.join("")}</div>` : "",
      cardFinanceiroHtml(parsed),
      listaVisual("Externas", parsed.externas, "ext"),
      listaVisual("Internas", parsed.internas, "int"),
      listaVisual("Plantas", parsed.plantas, "pla"),
      listaVisual("Tour virtual", parsed.tour_virtual, "tour"),
      listaVisual("Filmes", parsed.filmes, "filme"),
    ];

    return partes.filter(Boolean).join("");
  }

  function respostaAssistente(parsed, opts) {
    if (!parsed) return "Pode começar — diga cliente, projeto e quantas imagens (externas, internas ou plantas).";
    const c = parsed.cliente;
    const nImg =
      (parsed.externas && parsed.externas.length) +
      (parsed.internas && parsed.internas.length) +
      (parsed.plantas && parsed.plantas.length);
    let msg = `Entendi: **${c.empresa}** · projeto **${c.ref}** · A/C **${c.contato}**.`;
    if (parsed.modo === "adicional") {
      msg += " **Proposta adicional** — escopo só com o que você listou.";
      if (parsed.preco_unitario_contrato > 0) {
        msg += ` Valor: **R$ ${parsed.preco_unitario_contrato.toLocaleString("pt-BR")}**/imagem.`;
      } else {
        msg += " Preço do contrato/histórico.";
      }
    }
    if (parsed._remove_desconto) msg += " **Desconto removido** — proposta sem percentual de desconto.";
    if (nImg) {
      msg += parsed._somente_escopo
        ? ` **Escopo:** ${nImg} imagem(ns) adicionada(s) — cliente e projeto mantidos.`
        : ` ${nImg} imagem(ns) na proposta.`;
    } else if (!parsed._remove_desconto) {
      msg += " Ainda não identifiquei imagens — informe quantidades ou liste os ambientes.";
    }
    if (opts && opts.ia) msg += " _(interpretado com IA)_";
    else if (opts && opts.modoLocal) {
      msg += "\n\n_Modo local — sem API paga; cliente e escopo vêm do interpretador do site e do PDF._";
    } else if (opts && opts.iaIndisponivel) {
      msg +=
        "\n\n_Interpretação local (API de IA indisponível — use o parser do site ou configure chave no Netlify)._";
    }
    const av = (parsed._avisos || []).filter(
      (a) =>
        !/interpretado|lidos do texto|quota|generativelanguage|API_KEY|exceeded your current/i.test(a) &&
        !/^IA:/i.test(a)
    );
    if (av.length) msg += `\n\n_${av.slice(0, 2).join(" ")}_`;
    return msg;
  }

  async function interpretarMensagem(texto, baseAnterior) {
    const local = window.FlyingParser.parseConversacional(texto);
    let novo = local;
    const soCorrecao =
      window.FlyingParser &&
      window.FlyingParser.ehMensagemSoCorrecaoDesconto &&
      window.FlyingParser.ehMensagemSoCorrecaoDesconto(texto);
    const localOk =
      window.FlyingParser.briefingLocalSuficiente &&
      window.FlyingParser.briefingLocalSuficiente(local);
    const baseTemCliente =
      baseAnterior &&
      baseAnterior.cliente &&
      baseAnterior.cliente.empresa !== "CLIENTE" &&
      !window.FlyingParser.empresaPareceInvalida(baseAnterior.cliente.empresa);
    const localOkComBase =
      localOk || (local._somente_escopo && baseTemCliente && local.internas && local.internas.length);

    const modoLocal = window.FLYING_MODO_LOCAL !== false;
    const querIA =
      !modoLocal &&
      !soCorrecao &&
      !localOkComBase &&
      window.FlyingParserIA &&
      window.FlyingParserIA.pareceConversacional(texto);

    let iaIndisponivel = false;
    if (querIA) {
      try {
        const ia = await window.FlyingParserIA.interpretar(texto);
        if (ia) {
          if (ia.desconto_pct > 0 && !local._desconto_explicito) {
            ia.desconto_pct = 0;
            ia.desconto_label = null;
            ia._desconto_explicito = false;
          }
          if (local._desconto_explicito) ia._desconto_explicito = true;
          if (local._somente_escopo) {
            ia.cliente = { empresa: "CLIENTE", ref: "PROJETO", contato: "—" };
            ia._somente_escopo = true;
          }
          novo = window.FlyingParser.mesclarBriefing(local, ia);
        } else {
          iaIndisponivel = true;
        }
      } catch (e) {
        console.warn("IA briefing:", e);
        iaIndisponivel = true;
        novo = local;
      }
    }
    const merged = window.FlyingParser.mesclarBriefing(baseAnterior, novo);
    return {
      parsed: merged,
      usouIa: !!(novo && novo._origem === "ia"),
      iaIndisponivel: iaIndisponivel && !localOkComBase,
      modoLocal,
    };
  }

  function renderMensagens() {
    const el = $("chat-mensagens");
    if (!el) return;
    el.innerHTML = "";
    for (const m of mensagens) {
      const div = document.createElement("div");
      div.className = `chat-msg chat-msg--${m.role}`;
      const corpo = document.createElement("div");
      corpo.className = "chat-msg-corpo";
      if (m.role === "assistant") {
        corpo.innerHTML = m.html || escapeHtml(m.text).replace(/\n/g, "<br>");
      } else {
        corpo.textContent = m.text;
      }
      div.appendChild(corpo);
      el.appendChild(div);
    }
    el.scrollTop = el.scrollHeight;
  }

  function renderPreview() {
    const prev = $("chat-preview");
    if (prev) prev.innerHTML = resumoHtml(parsedAtual);
    atualizarProgressoBriefing(parsedAtual);
  }

  function notificar() {
    renderPreview();
    if (typeof onAtualizou === "function") onAtualizou(parsedAtual);
  }

  function salvarChat() {
    try {
      localStorage.setItem(STORAGE_CHAT, JSON.stringify({ mensagens, ts: Date.now() }));
    } catch (_) { /* noop */ }
  }

  function restaurarChat() {
    try {
      const raw = localStorage.getItem(STORAGE_CHAT);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.mensagens) && data.mensagens.length) {
        mensagens = data.mensagens;
        reparse();
        renderMensagens();
        renderPreview();
        return true;
      }
    } catch (_) { /* noop */ }
    return false;
  }

  function iniciarBoasVindas() {
    mensagens = [
      { role: "assistant", text: MSG_BOAS_VINDAS, html: escapeHtml(MSG_BOAS_VINDAS) },
    ];
    parsedAtual = null;
    renderMensagens();
    renderPreview();
  }

  async function enviarMensagem(texto) {
    const t = (texto || "").trim();
    if (!t) return null;

    const btn = $("chat-enviar");
    const input = $("chat-input");
    if (btn) btn.disabled = true;
    if (input) input.disabled = true;

    const baseAnterior = parsedAtual;
    mensagens.push({ role: "user", text: t });
    renderMensagens();

    mensagens.push({
      role: "assistant",
      text: "Interpretando…",
      html: "<em>Interpretando sua mensagem…</em>",
    });
    renderMensagens();

    let usouIa = false;
    try {
      const { parsed, usouIa: iaFlag, iaIndisponivel } = await interpretarMensagem(t, baseAnterior);
      usouIa = iaFlag;
      parsedAtual = parsed;
      if ($("descricao") && parsedAtual) {
        $("descricao").value = window.FlyingParser.serializar(parsedAtual);
      }
      mensagens.pop();
      const resp = respostaAssistente(parsedAtual, {
        ia: usouIa,
        iaIndisponivel,
        modoLocal: window.FLYING_MODO_LOCAL !== false,
      });
      mensagens.push({
        role: "assistant",
        text: resp.replace(/\*\*/g, "").replace(/_/g, ""),
        html: formatAssistantHtml(resp),
      });
    } catch (err) {
      mensagens.pop();
      mensagens.push({
        role: "assistant",
        text: err.message || "Erro ao interpretar.",
        html: formatAssistantHtml(`Não consegui interpretar: ${err.message || "erro"}. Tente reformular.`),
      });
      reparseLocal();
    }

    if (btn) btn.disabled = false;
    if (input) input.disabled = false;
    renderMensagens();
    notificar();
    salvarChat();
    salvarRascunhoSync();
    if (input) input.focus();
    return parsedAtual;
  }

  function salvarRascunhoSync() {
    try {
      const payload = {
        descricao: $("descricao") ? $("descricao").value : "",
        estrategia: (document.querySelector('input[name="estrategia"]:checked') || {}).value || "auto",
        ts: Date.now(),
      };
      localStorage.setItem("flying_form_rascunho_v2", JSON.stringify(payload));
    } catch (_) { /* noop */ }
  }

  function ingestTexto(texto, opts) {
    const prefixo = opts && opts.prefixo ? `${opts.prefixo}\n` : "";
    const bloco = prefixo + (texto || "").trim();
    if (!bloco.trim()) return null;
    mensagens.push({ role: "user", text: bloco });
    const parsed = reparse();
    mensagens.push({
      role: "assistant",
      text: opts && opts.resposta
        ? opts.resposta
        : "Importei o conteúdo e atualizei o briefing. Revise ao lado e ajuste se precisar.",
      html: escapeHtml(opts && opts.resposta
        ? opts.resposta
        : "Importei o conteúdo e atualizei o briefing. Revise ao lado e ajuste se precisar."),
    });
    renderMensagens();
    notificar();
    salvarChat();
    salvarRascunhoSync();
    return parsed;
  }

  function limparConversa() {
    iniciarBoasVindas();
    if ($("descricao")) $("descricao").value = "";
    try {
      localStorage.removeItem(STORAGE_CHAT);
    } catch (_) { /* noop */ }
    salvarRascunhoSync();
    notificar();
  }

  function atualizarDeDescricao() {
    const ta = $("descricao");
    if (!ta) return null;
    const texto = (ta.value || "").trim();
    if (!texto) return null;
    parsedAtual = window.FlyingParser.parseConversacional(texto);
    renderPreview();
    if (typeof onAtualizou === "function") onAtualizou(parsedAtual);
    return parsedAtual;
  }

  function init(opcoes) {
    onAtualizou = opcoes && opcoes.onAtualizou;
    const input = $("chat-input");
    const btn = $("chat-enviar");

    if (!restaurarChat()) iniciarBoasVindas();

    function submit() {
      if (!input || btn.disabled) return;
      const v = input.value;
      input.value = "";
      input.style.height = "";
      enviarMensagem(v).then(() => {
        if (window.atualizarUiHistoricoPdf) window.atualizarUiHistoricoPdf();
      });
    }

    if (btn) btn.addEventListener("click", submit);
    if (input) {
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          submit();
        }
      });
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
      });
    }

    const btnLimpar = $("chat-limpar");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        if (window.confirm("Limpar a conversa e começar de novo?")) limparConversa();
      });
    }
  }

  window.FlyingChat = {
    init,
    enviarMensagem,
    ingestTexto,
    limparConversa,
    atualizarDeDescricao,
    getParsed: () => parsedAtual,
    getTexto: textoCompleto,
    reparse,
  };
})();
