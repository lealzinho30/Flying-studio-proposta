// Chamada à IA (Netlify) para interpretar briefing em linguagem natural.
(function () {
  "use strict";

  const ENDPOINT = "/.netlify/functions/interpretar-briefing";
  const TIMEOUT_MS = 45000;

  function pareceConversacional(texto) {
    const t = (texto || "").trim();
    if (t.length < 8) return false;
    if (/^(?:externas?|internas?|plantas?)\s*:/im.test(t)) return false;
    if (/^cliente\s*:/im.test(t) && t.split(/\n/).length > 4) return false;
    return true;
  }

  async function interpretar(texto) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.erro || res.statusText;
        if (res.status === 503) return null;
        throw new Error(msg);
      }
      return data.parsed || null;
    } finally {
      clearTimeout(timer);
    }
  }

  window.FlyingParserIA = {
    interpretar,
    pareceConversacional,
  };
})();
