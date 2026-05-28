// Mescla o corpo da proposta gerada no papel timbrado (DOCX modelo).
(function () {
  "use strict";

  const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const TIMBRADO_URL = "assets/TIMBRADO_FLYINGSTUDIO.docx";

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

  async function aplicarPapelTimbrado(conteudoBlob, url) {
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error("JSZip não carregou. Atualize a página.");

    const tplResp = await fetch(url || TIMBRADO_URL, { cache: "force-cache" });
    if (!tplResp.ok) {
      throw new Error(
        "Papel timbrado não encontrado no site. Coloque TIMBRADO_FLYINGSTUDIO.docx em web/assets/."
      );
    }

    const [tplZip, contZip] = await Promise.all([
      JSZip.loadAsync(await tplResp.arrayBuffer()),
      JSZip.loadAsync(await conteudoBlob.arrayBuffer()),
    ]);

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
    TIMBRADO_URL,
  };
})();
