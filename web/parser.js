// Parser de linguagem natural (porte fiel de flying/ai_parser.py).
// Extrai: cliente {empresa, ref, contato}, externas, internas, plantas,
// desconto_pct, estrategia, mostrar_precos_individuais.

(function () {
  "use strict";

  function norm(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function limpaItem(s) {
    return (s || "")
      .trim()
      .replace(/[.;,]+$/, "")
      .replace(/^[\s\-*•\u2013\u2014\d.)]+/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const SECOES_CABEC = {
    externas: [
      "externas?",
      "ilustra(?:c|ç)(?:o|õ)es externas",
      "perspectivas externas",
      "imagens externas",
      "\\bext\\b",
    ],
    internas: [
      "internas?",
      "ilustra(?:c|ç)(?:o|õ)es internas",
      "perspectivas internas",
      "imagens internas",
      "\\bint\\b",
    ],
    plantas: [
      "plantas?",
      "plantas? humanizadas?",
      "plantas? baixas?",
      "implanta(?:c|ç)(?:o|õ)es?",
    ],
  };

  function splitSecoes(texto) {
    const matches = [];
    for (const [cat, padroes] of Object.entries(SECOES_CABEC)) {
      for (const pad of padroes) {
        const re = new RegExp(`(?:^|\\n|[.;])\\s*(${pad})\\s*[:\\-]`, "i");
        const m = re.exec(texto);
        if (m) {
          matches.push({ start: m.index, cat, end: m.index + m[0].length });
          break;
        }
      }
    }
    matches.sort((a, b) => a.start - b.start);
    const blocos = {};
    for (let i = 0; i < matches.length; i++) {
      const fim = i + 1 < matches.length ? matches[i + 1].start : texto.length;
      blocos[matches[i].cat] = texto.slice(matches[i].end, fim).trim();
    }
    return blocos;
  }

  function extraiLista(bloco) {
    if (!bloco) return [];
    const linhas = bloco
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (linhas.length >= 2) {
      return linhas.map(limpaItem).filter(Boolean);
    }
    return bloco
      .split(/[;,]| e (?=[A-ZÁ-Úa-zá-ú])/)
      .map(limpaItem)
      .filter(Boolean);
  }

  const RE_CLIENTE = /(?:^|\n|[,;.])\s*(?:cliente|empresa)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:ref|projeto|empreendimento|a\/?c|contato|aos\s+cuidados))/i;
  const RE_REF = /(?:^|\n|[,;.\-–—])\s*(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|a\/?c|contato|aos\s+cuidados|\d+\s*%))/i;
  const RE_CONTATO = /(?:^|\n|[,;.])\s*(?:a\/?c|contato|aos\s+cuidados\s+de?)\s*[:\-.]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|ref|projeto|empreendimento|\d+\s*%))/i;
  const RE_DESCONTO = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s*)?(?:desconto|desc\.?|off)/i;
  const RE_DESCONTO2 = /desconto\s*(?:de|:)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i;
  const RE_ESTRATEGIA_PLAN = /\b(?:planilha|tabela\s*padr[aã]o|pre[cç]o\s*de\s*planilha|pre[cç]o\s*padr[aã]o)\b/i;
  const RE_ESTRATEGIA_HIST = /\bhist[oó]ric|cliente\s*(?:antigo|anterior|recorrente)|m[eé]dia\s*do\s*cliente|mesma?\s*base\b/i;
  const RE_PRECOS_IND = /pre[cç]os?\s*(?:individuais?|por\s*item|por\s*imagem)|coluna\s*de\s*pre[cç]o|estilo\s*brnpar/i;

  function parse(textoOrig) {
    const texto = (textoOrig || "").trim();
    const avisos = [];

    if (!texto) {
      return {
        cliente: { empresa: "CLIENTE", ref: "PROJETO", contato: "—" },
        externas: [], internas: [], plantas: [],
        desconto_pct: 0, desconto_label: null,
        estrategia: "auto",
        mostrar_precos_individuais: false,
        _origem: "local", _avisos: ["Texto vazio."],
      };
    }

    const mCli = RE_CLIENTE.exec(texto);
    const mRef = RE_REF.exec(texto);
    const mCon = RE_CONTATO.exec(texto);

    let cliente = mCli ? mCli[1].trim().replace(/[.;,]+$/, "") : "";
    let ref = mRef ? mRef[1].trim().replace(/[.;,]+$/, "") : "";
    let contato = mCon ? mCon[1].trim().replace(/[.;,]+$/, "") : "";

    if (!cliente) {
      const primeira = texto.split(/\r?\n/, 1)[0].trim();
      const mCaps = primeira.match(
        /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9](?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 &]*[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])?)\b/
      );
      if (mCaps && mCaps[1].length >= 3) {
        cliente = mCaps[1].trim();
        avisos.push(`Cliente não foi marcado explicitamente — assumi '${cliente}' (1as palavras em CAPS).`);
        if (!ref) {
          let resto = primeira.slice(mCaps[0].length).replace(/^[\s\-–—:,.]+/, "");
          resto = resto.replace(/^(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s*/i, "");
          resto = resto.replace(/\b(?:a\/?c|contato|aos\s+cuidados\s+de?)\b.*$/i, "").replace(/[,.]\s*$/, "").trim();
          resto = resto.replace(/,\s*\d+\s*%.*$/, "");
          if (resto.length >= 2 && resto.length <= 60) ref = resto;
        }
      } else {
        const mAny = texto.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+)?)\b/);
        const bloq = new Set(["EXTERNAS", "INTERNAS", "PLANTAS", "REF", "PROJETO", "CLIENTE", "EMPRESA", "DESCONTO", "HISTORICO", "HISTÓRICO", "PLANILHA", "TÉRREO"]);
        if (mAny && !bloq.has(mAny[1])) {
          cliente = mAny[1].trim();
          avisos.push(`Cliente não foi marcado explicitamente — assumi '${cliente}' (palavra em CAPS no texto).`);
        } else if (primeira && primeira.length < 60) {
          cliente = primeira;
          avisos.push(`Cliente não foi marcado explicitamente — assumi '${cliente}' (1ª linha).`);
        }
      }
    }

    let desconto_pct = 0;
    const mD = RE_DESCONTO.exec(texto) || RE_DESCONTO2.exec(texto);
    if (mD) desconto_pct = parseFloat(mD[1].replace(",", "."));

    let estrategia = "auto";
    if (RE_ESTRATEGIA_PLAN.test(texto)) estrategia = "planilha";
    else if (RE_ESTRATEGIA_HIST.test(texto)) estrategia = "historico";

    const blocos = splitSecoes(texto);
    const externas = extraiLista(blocos.externas || "");
    const internas = extraiLista(blocos.internas || "");
    const plantas = extraiLista(blocos.plantas || "");

    if (!externas.length && !internas.length && !plantas.length) {
      avisos.push("Não consegui identificar nenhuma seção (Externas/Internas/Plantas). Use cabeçalhos tipo 'Externas:' seguidos da lista.");
    }

    return {
      cliente: {
        empresa: cliente || "CLIENTE",
        ref: ref || "PROJETO",
        contato: contato || "—",
      },
      externas, internas, plantas,
      desconto_pct,
      desconto_label: null,
      estrategia,
      mostrar_precos_individuais: RE_PRECOS_IND.test(texto),
      _origem: "local",
      _avisos: avisos,
    };
  }

  window.FlyingParser = { parse, norm, limpaItem };
})();
