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

  function resumoHtml(parsed) {
    if (!parsed) {
      return "<p class=\"chat-preview-vazio\">Envie uma mensagem para ver o briefing estruturado.</p>";
    }
    const c = parsed.cliente || {};
    const partes = [
      `<div class="chat-kv"><span>Cliente</span><strong>${escapeHtml(c.empresa)}</strong></div>`,
      `<div class="chat-kv"><span>Projeto</span><strong>${escapeHtml(c.ref)}</strong></div>`,
      `<div class="chat-kv"><span>A/C</span><strong>${escapeHtml(c.contato)}</strong></div>`,
    ];
    if (parsed.desconto_pct > 0) {
      partes.push(`<div class="chat-kv"><span>Desconto</span><strong>${parsed.desconto_pct}%</strong></div>`);
    }

    function lista(titulo, itens) {
      if (!itens || !itens.length) return "";
      const lis = itens.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
      return `<div class="chat-lista"><span class="chat-lista-titulo">${titulo} (${itens.length})</span><ul>${lis}</ul></div>`;
    }

    partes.push(
      lista("Externas", parsed.externas),
      lista("Internas", parsed.internas),
      lista("Plantas", parsed.plantas),
      lista("Tour virtual", parsed.tour_virtual),
      lista("Filmes", parsed.filmes)
    );

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
    if (parsed._remove_desconto) msg += " **Desconto removido** — proposta sem percentual de desconto.";
    if (nImg) msg += ` ${nImg} imagem(ns) na proposta.`;
    else if (!parsed._remove_desconto) msg += " Ainda não identifiquei imagens — informe quantidades ou liste os ambientes.";
    if (opts && opts.ia) msg += " _(interpretado com IA)_";
    const av = (parsed._avisos || []).filter((a) => !/interpretado|lidos do texto/i.test(a));
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
    const querIA =
      !soCorrecao &&
      window.FlyingParserIA &&
      (window.FlyingParserIA.pareceConversacional(texto) ||
        (local.cliente.empresa === "CLIENTE" && !local.internas.length && !local.externas.length));

    if (querIA) {
      try {
        const ia = await window.FlyingParserIA.interpretar(texto);
        if (ia) novo = window.FlyingParser.mesclarBriefing(local, ia);
      } catch (e) {
        console.warn("IA briefing:", e);
        local._avisos = local._avisos || [];
        if (!/indisponível|503|API_KEY/i.test(e.message)) {
          local._avisos.push(`IA: ${e.message} — usei interpretação local.`);
        }
        novo = local;
      }
    }
    return {
      parsed: window.FlyingParser.mesclarBriefing(baseAnterior, novo),
      usouIa: !!(novo && novo._origem === "ia"),
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
      const { parsed, usouIa: iaFlag } = await interpretarMensagem(t, baseAnterior);
      usouIa = iaFlag;
      parsedAtual = parsed;
      if ($("descricao") && parsedAtual) {
        $("descricao").value = window.FlyingParser.serializar(parsedAtual);
      }
      mensagens.pop();
      const resp = respostaAssistente(parsedAtual, { ia: usouIa });
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
