// Converte PDF de projeto em imagens e chama IA (Netlify Function) para listagem automática.

(function () {
  "use strict";

  const MAX_PAGINAS = 12;
  const ESCALA = 1.35;
  const JPEG_QUALIDADE = 0.82;
  const MAX_LARGURA = 1400;

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(file);
    });
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    throw new Error("PDF.js não carregou. Recarregue a página.");
  }

  async function pdfParaImagens(file, onProgress) {
    const pdfjs = await ensurePdfJs();
    const buf = await readAsArrayBuffer(file);
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const limite = Math.min(total, MAX_PAGINAS);
    const imagens = [];

    for (let i = 1; i <= limite; i++) {
      if (onProgress) onProgress(i, limite, total);
      const page = await pdf.getPage(i);
      let scale = ESCALA;
      const vp0 = page.getViewport({ scale: 1 });
      if (vp0.width * scale > MAX_LARGURA) scale = MAX_LARGURA / vp0.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      imagens.push({
        page: i,
        mime: "image/jpeg",
        dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALIDADE),
      });
    }

    return {
      imagens,
      totalPages: total,
      analisadas: limite,
      truncado: total > limite,
    };
  }

  async function extrairTextoPdf(file) {
    if (window.FlyingFileReader && window.FlyingFileReader.lerArquivo) {
      const r = await window.FlyingFileReader.lerArquivo(file);
      return r.texto || "";
    }
    return "";
  }

  function listagemParaTexto(listagem, opts) {
    const linhas = [];
    const cs = listagem.cliente_sugerido;
    if (opts && opts.mesclarCliente && cs) {
      if (cs.empresa) linhas.push(`Cliente: ${cs.empresa}`);
      if (cs.ref) linhas.push(`Ref: ${cs.ref}`);
      if (cs.contato) linhas.push(`A/C: ${cs.contato}`);
      linhas.push("");
    }
    if (listagem.externas && listagem.externas.length) {
      linhas.push("Externas:");
      listagem.externas.forEach((x) => linhas.push(`- ${x}`));
      linhas.push("");
    }
    if (listagem.internas && listagem.internas.length) {
      linhas.push("Internas:");
      listagem.internas.forEach((x) => linhas.push(`- ${x}`));
      linhas.push("");
    }
    if (listagem.plantas && listagem.plantas.length) {
      linhas.push("Plantas:");
      listagem.plantas.forEach((x) => linhas.push(`- ${x}`));
      linhas.push("");
    }
    if (listagem.avisos && listagem.avisos.length) {
      linhas.push("# Avisos da análise IA:");
      listagem.avisos.forEach((a) => linhas.push(`# ${a}`));
    }
    return linhas.join("\n").trim();
  }

  async function analisarPdfProjeto(file, callbacks) {
    const onProgress = callbacks && callbacks.onProgress;
    const onStatus = callbacks && callbacks.onStatus;

    if (onStatus) onStatus("Extraindo texto do PDF…");
    const textoExtraido = await extrairTextoPdf(file);

    if (onStatus) onStatus("Convertendo páginas em imagens…");
    const { imagens, totalPages, analisadas, truncado } = await pdfParaImagens(file, onProgress);

    if (onStatus) onStatus(`Enviando ${analisadas} página(s) para análise com IA…`);

    const apiUrl = "/.netlify/functions/analisar-planta";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: imagens, textoExtraido }),
    });

    let body;
    try {
      body = await res.json();
    } catch (_) {
      throw new Error("Resposta inválida do servidor. Confira se a função Netlify está publicada e as chaves de API configuradas.");
    }

    if (!res.ok || body.erro) {
      throw new Error(body.erro || `Erro HTTP ${res.status}`);
    }

    return {
      listagem: body.listagem,
      provider: body.provider,
      total: body.total,
      meta: { totalPages, analisadas, truncado, textoChars: textoExtraido.length },
    };
  }

  window.FlyingAnalisadorPlantas = {
    analisarPdfProjeto,
    listagemParaTexto,
    pdfParaImagens,
    MAX_PAGINAS,
  };
})();
