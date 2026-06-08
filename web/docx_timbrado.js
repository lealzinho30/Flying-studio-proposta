// Mescla o corpo da proposta gerada no papel timbrado (DOCX modelo).
(function () {
  "use strict";

  const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const TIMBRADO_URL = "assets/TIMBRADO_FLYINGSTUDIO.docx";
  const STORAGE_B64 = "flying_timbrado_custom_b64_v1";
  const STORAGE_NOME = "flying_timbrado_custom_nome_v1";

  function getBody(xmlDoc) {
    const list = xmlDoc.getElementsByTagNameNS(W_NS, "body");
    if (list.length) return list[0];
    const fallback = xmlDoc.getElementsByTagName("body");
    return fallback.length ? fallback[0] : null;
  }

  function isSectPr(node) {
    return node && node.nodeType === 1 && node.localName === "sectPr";
  }

  function bodyContentNodes(body) {
    const nodes = [];
    for (let i = 0; i < body.childNodes.length; i += 1) {
      const n = body.childNodes[i];
      if (isSectPr(n)) continue;
      nodes.push(n);
    }
    return nodes;
  }

  function mergeDocumentXml(tplXml, contXml) {
    const parser = new DOMParser();
    const tplDoc = parser.parseFromString(tplXml, "application/xml");
    const contDoc = parser.parseFromString(contXml, "application/xml");
    if (tplDoc.getElementsByTagName("parsererror").length) {
      throw new Error("XML inválido no papel timbrado");
    }
    if (contDoc.getElementsByTagName("parsererror").length) {
      throw new Error("XML inválido no conteúdo da proposta");
    }

    const tplBody = getBody(tplDoc);
    const contBody = getBody(contDoc);
    if (!tplBody || !contBody) throw new Error("Estrutura Word incompleta (body)");

    let sectPr = null;
    for (let i = tplBody.childNodes.length - 1; i >= 0; i -= 1) {
      const n = tplBody.childNodes[i];
      if (isSectPr(n)) {
        sectPr = n;
        tplBody.removeChild(n);
        break;
      }
    }

    while (tplBody.firstChild) tplBody.removeChild(tplBody.firstChild);

    const conteudo = bodyContentNodes(contBody);
    for (let i = 0; i < conteudo.length; i += 1) {
      tplBody.appendChild(tplDoc.importNode(conteudo[i], true));
    }

    if (sectPr) tplBody.appendChild(sectPr);

    return new XMLSerializer().serializeToString(tplDoc.documentElement);
  }

  async function copiarMidiasDoConteudo(contZip, tplZip) {
    const prefix = "word/media/";
    const paths = Object.keys(contZip.files).filter(
      (p) => p.startsWith(prefix) && !contZip.files[p].dir
    );
    for (const p of paths) {
      if (tplZip.files[p]) continue;
      const data = await contZip.file(p).async("uint8array");
      tplZip.file(p, data);
    }
  }

  function b64ParaArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function timbradoCustomSalvo() {
    try {
      return !!localStorage.getItem(STORAGE_B64);
    } catch (_) {
      return false;
    }
  }

  function nomeTimbradoAtivo() {
    try {
      if (timbradoCustomSalvo()) {
        return localStorage.getItem(STORAGE_NOME) || "Seu timbrado (.docx)";
      }
    } catch (_) {}
    return "Timbrado padrão do site";
  }

  function limparTimbradoLocal() {
    try {
      localStorage.removeItem(STORAGE_B64);
      localStorage.removeItem(STORAGE_NOME);
    } catch (_) {}
  }

  function salvarTimbradoLocal(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/\.docx$/i.test(file.name)) {
        reject(new Error("Use um arquivo .docx (Word)."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dataUrl = reader.result || "";
          const b64 = String(dataUrl).split(",")[1];
          if (!b64) throw new Error("Arquivo vazio ou inválido.");
          localStorage.setItem(STORAGE_B64, b64);
          localStorage.setItem(STORAGE_NOME, file.name);
          resolve(file.name);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  async function carregarTimbradoArrayBuffer(url) {
    try {
      const custom = localStorage.getItem(STORAGE_B64);
      if (custom) return b64ParaArrayBuffer(custom);
    } catch (_) {}

    const tplResp = await fetch(url || TIMBRADO_URL, { cache: "no-cache" });
    if (!tplResp.ok) {
      throw new Error(
        "Papel timbrado não encontrado. Use o botão «Meu papel timbrado» e escolha o .docx do seu computador."
      );
    }
    return tplResp.arrayBuffer();
  }

  async function aplicarPapelTimbrado(conteudoBlob, url) {
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error("JSZip não carregou. Atualize a página.");

    const [tplBuf, contZip] = await Promise.all([
      carregarTimbradoArrayBuffer(url),
      JSZip.loadAsync(await conteudoBlob.arrayBuffer()),
    ]);
    const tplZip = await JSZip.loadAsync(tplBuf);

    await copiarMidiasDoConteudo(contZip, tplZip);

    const tplDocXml = await tplZip.file("word/document.xml").async("string");
    const contDocXml = await contZip.file("word/document.xml").async("string");
    tplZip.file("word/document.xml", mergeDocumentXml(tplDocXml, contDocXml));

    return tplZip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  window.FlyingTimbrado = {
    aplicarPapelTimbrado,
    salvarTimbradoLocal,
    limparTimbradoLocal,
    timbradoCustomSalvo,
    nomeTimbradoAtivo,
    TIMBRADO_URL,
  };
})();
