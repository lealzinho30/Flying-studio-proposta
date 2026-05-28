// Histórico local das últimas propostas Word baixadas (localStorage no navegador).

(function () {
  "use strict";

  const STORAGE_KEY = "flying_propostas_word_v1";
  const MAX_ITENS = 40;

  function carregar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function salvar(lista) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(0, MAX_ITENS)));
  }

  function formatarData(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function registrar(entrada) {
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      baixadoEm: new Date().toISOString(),
      arquivo: entrada.arquivo || "Proposta.docx",
      empresa: entrada.empresa || "—",
      ref: entrada.ref || "—",
      contato: entrada.contato || "—",
      estrategia: entrada.estrategia || "—",
      valorFinal: entrada.valorFinal ?? 0,
      descontoPct: entrada.descontoPct ?? 0,
      qtdImagens: entrada.qtdImagens ?? 0,
      qtdExtras: entrada.qtdExtras ?? 0,
      resumo: entrada.resumo || null,
    };
    const lista = carregar();
    lista.unshift(item);
    salvar(lista);
    return item;
  }

  function remover(id) {
    const lista = carregar().filter((x) => x.id !== id);
    salvar(lista);
    return lista;
  }

  function limpar() {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }

  window.FlyingHistoricoDownloads = {
    carregar,
    registrar,
    remover,
    limpar,
    formatarData,
    MAX_ITENS,
  };
})();
