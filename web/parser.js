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
    tour_virtual: [
      "tour virtual",
      "visita virtual( web)?",
      "vr 360",
      "panoramas? 360",
    ],
    filmes: [
      "filmes?",
      "v[ií]deos?",
      "anima[cç][oõ]es?",
    ],
    apps: [
      "apps?",
      "aplica[cç][oõ]es?(?:\\s+digitais)?",
      "aplicativos?",
      "experi[eê]ncias? digitais",
    ],
    drone: [
      "drones?",
      "fotografia a[eé]rea",
      "voo de drone",
    ],
    escopo: [
      "escopo(?:\\s+de)?\\s+tecnologias?",
      "tecnologias?(?:\\s+do\\s+escopo)?",
      "servi[cç]os?\\s+de\\s+tecnolog",
    ],
    extras: [
      "extras?",
      "outros",
      "adicionais?",
      "servi[cç]os? extras?",
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

  const RE_CLIENTE = /(?:^|\n|[,;.])\s*(?:cliente|empresa)\s*[=:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:ref|projeto|empreendimento|a\/?c|contato|aos\s+cuidados))/i;
  const RE_REF = /(?:^|\n|[,;.\-–—])\s*(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[=:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|a\/?c|contato|aos\s+cuidados|\d+\s*%))/i;
  const RE_CONTATO = /(?:^|\n|[,;.])\s*(?:a\/?c|contato|aos\s+cuidados\s+de?)\s*[=:\-.]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|ref|projeto|empreendimento|\d+\s*%))/i;
  const RE_DESCONTO = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s*)?(?:desconto|desc\.?|off)/i;
  const RE_DESCONTO2 = /desconto\s*(?:de|:)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i;

  /** Usuário recusa desconto: "não pedi 12%", "sem desconto", "tirar o desconto". */
  function detectarRemocaoDesconto(texto) {
    const t = norm(texto);
    if (!t) return false;
    const menciona = /\d+\s*%/.test(t) || /\bdesconto\b/.test(t);
    if (!menciona) return false;
    const negacao = [
      /\bnao\s+(?:pedi|quero|preciso|precisamos|necessito)\b/,
      /\bsem\s+desconto\b/,
      /\bsem\s+(?:os?\s+)?\d+\s*%/,
      /\btir(ar|e|a)\s+(?:o\s+)?desconto\b/,
      /\bremov(er|a)\s+(?:o\s+)?desconto\b/,
      /\bretir(ar|a)\s+(?:o\s+)?desconto\b/,
      /\bretir(ar|a)\s+(?:os?\s+)?\d+\s*%/,
      /\bcancel(ar|a)\s+(?:o\s+)?desconto\b/,
      /\bzero\s+desconto\b/,
      /\bnao\s+(?:preciso|quero)\s+(?:dos?\s+)?\d+\s*%/,
    ];
    return negacao.some((re) => re.test(t));
  }

  function parseValorBr(s) {
    const n = parseFloat(String(s || "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  /** Desconto só quando o texto pede desconto (ignora % de parcelas/sinal). */
  function detectarPedidoDesconto(texto) {
    if (detectarRemocaoDesconto(texto)) {
      return { pct: 0, label: null, explicito: false };
    }
    const t = texto || "";
    const mD = RE_DESCONTO.exec(t) || RE_DESCONTO2.exec(t);
    if (!mD) return { pct: 0, label: null, explicito: false };
    const idx = typeof mD.index === "number" ? mD.index : t.indexOf(mD[0]);
    const trecho = t.slice(Math.max(0, idx - 55), idx + mD[0].length + 35);
    if (!/\bdesconto\b|\bdesc\.?\b|\bde\s+parceria\b|\boff\b/i.test(trecho)) {
      return { pct: 0, label: null, explicito: false };
    }
    const pct = parseFloat(String(mD[1]).replace(",", "."));
    if (!pct || pct > 50) return { pct: 0, label: null, explicito: false };
    return { pct, label: `${pct}%`, explicito: true };
  }

  function detectarPropostaAdicional(texto) {
    const t = norm(texto);
    return (
      /\b(?:imagens?|ilustracoes?|perspectivas?|plantas?)\s+adicionais?\b/.test(t) ||
      /\badicionais?\s+ao\s+projeto\b/.test(t) ||
      /\bproposta\s+adicional\b/.test(t) ||
      /\bproposta\s+que\s+contempla\b/.test(t) ||
      /\bcomplemento\s+(?:ao|do)\s+(?:projeto|contrato)\b/.test(t) ||
      /\bmesmo\s+valor\s+(?:do\s+)?(?:contrato|projeto|fechado)\b/.test(t) ||
      /\bvalor\s+(?:unitario|medio)\s+(?:do\s+)?contrato\b/.test(t) ||
      /\bpreco\s+medio\b/.test(t) ||
      /\bmesma\s+base\s+(?:de\s+)?preco\b/.test(t) ||
      (/\bpelo\s+valor\s+de\b/.test(t) && /\bperspectivas?\b/.test(t))
    );
  }

  function parsePrecoUnitarioContrato(texto) {
    const t = texto || "";
    const padroes = [
      /(?:valor\s+)?(?:medio|unit[aá]rio)\s*(?:de\s+)?r\$\s*([\d.\s]+(?:,\d{1,2})?)/i,
      /r\$\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:por\s+imagem|cada|unit[aá]rio|na\s+media)/i,
      /(?:mesmo\s+valor|preco)\s+(?:de\s+)?r\$\s*([\d.\s]+(?:,\d{1,2})?)/i,
      /valor\s+(?:de\s+)?([\d.\s]+(?:,\d{1,2})?)\s*(?:por\s+imagem|cada)/i,
      /pelo\s+valor\s+(?:de\s+)?([\d.\s]{3,12})/i,
      /(?:no\s+)?valor\s+(?:de\s+)?([\d]{3,5})(?:[,.]\d{1,2})?\b/i,
    ];
    for (const re of padroes) {
      const m = t.match(re);
      if (m) {
        const v = parseValorBr(String(m[1]).trim());
        if (v >= 80 && v < 100000) return Math.round(v);
      }
    }
    return 0;
  }

  function aplicarPrecoContrato(texto, out) {
    const pu = parsePrecoUnitarioContrato(texto);
    if (pu <= 0) return;
    out.preco_unitario_contrato = pu;
    out._avisos = out._avisos || [];
    if (!out._avisos.some((a) => /R\$\s*[\d.]/.test(a))) {
      out._avisos.push(
        `Valor informado: R$ ${pu.toLocaleString("pt-BR")} por imagem.`
      );
    }
  }

  function aplicarModoAdicional(texto, out) {
    const adicional = detectarPropostaAdicional(texto) || out.modo === "adicional";
    if (!adicional) return;
    out.modo = "adicional";
    out.estrategia = "historico";
    out._avisos = out._avisos || [];
    aplicarPrecoContrato(texto, out);
    if (out.preco_unitario_contrato > 0) {
      if (!out._avisos.some((a) => /proposta adicional/i.test(a))) {
        out._avisos.push(
          `Proposta adicional: R$ ${out.preco_unitario_contrato.toLocaleString("pt-BR")} por imagem.`
        );
      }
    } else if (!out._avisos.some((a) => /pdf\/histórico/i.test(a))) {
      out._avisos.push(
        "Proposta adicional: preço virá do PDF/histórico (média do contrato). Liste só as imagens deste pedido."
      );
    }
  }

  /** Mensagem curta só para corrigir desconto — não deve virar nome de cliente. */
  function ehMensagemSoCorrecaoDesconto(texto) {
    const t = (texto || "").trim();
    if (!detectarRemocaoDesconto(t)) return false;
    if (t.length > 120) return false;
    if (/\b(?:empresa|cliente|projeto|ref)\s*[:]/i.test(t)) return false;
    if (/\bempresa\s+[a-záéíóú]{3,}/i.test(t) && !/\bnao\s+pedi\b/i.test(t)) return false;
    return true;
  }
  const RE_ESTRATEGIA_PLAN = /\b(?:planilha|tabela\s*padr[aã]o|pre[cç]o\s*de\s*planilha|pre[cç]o\s*padr[aã]o)\b/i;
  const RE_ESTRATEGIA_HIST = /\bhist[oó]ric|cliente\s*(?:antigo|anterior|recorrente)|m[eé]dia\s*do\s*cliente|mesma?\s*base\b/i;
  const RE_PRECOS_IND = /pre[cç]os?\s*(?:individuais?|por\s*item|por\s*imagem)|coluna\s*de\s*pre[cç]o|estilo\s*brnpar/i;

  function tituloPalavra(w) {
    if (!w) return "";
    const lower = w.toLowerCase();
    if (["de", "da", "do", "das", "dos", "e"].includes(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function tituloCase(s) {
    return (s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(tituloPalavra)
      .join(" ");
  }

  function empresaFormatada(s) {
    return (s || "").trim().toUpperCase() || "CLIENTE";
  }

  function gerarListaPlaceholder(qtd, rotulo) {
    const n = Math.max(1, Math.min(99, parseInt(qtd, 10) || 0));
    const base = rotulo || "Item";
    const itens = [];
    for (let i = 1; i <= n; i += 1) {
      const num = String(i).padStart(2, "0");
      itens.push(`${base} ${num}`);
    }
    return itens;
  }

  function clientePadrao(c) {
    return !c || c.empresa === "CLIENTE" || c.ref === "PROJETO";
  }

  function ehLinhaMetaDescritiva(linha) {
    return /é\s+o\s+nome\b|é\s+a\s+empresa\b|é\s+o\s+projeto\b|forma\s+de\s+pagamento\b|pagamento\s+ser[aá]\b|pagos?\s+aceite\b|pacot[aã]o\s+20\d{2}/i.test(
      linha || ""
    );
  }

  function textoTemSecoesEstruturadas(texto) {
    return /(?:^|\n)\s*(?:cliente|externas?|internas?|plantas?|tour\s+virtual|filmes?|apps?|drone)\s*:/im.test(
      texto || ""
    );
  }

  /** Frase sobre escopo (imagens/ambientes) — não altera cliente/projeto/A/C. */
  function ehMensagemSoEscopo(texto) {
    const t = norm(texto);
    if (!t || t.length > 420) return false;
    if (/\b(?:cliente|empresa)\s*[=:]/i.test(texto)) return false;
    if (/(?:^|\n)\s*cliente\s*:/im.test(texto)) return false;
    if (/\b(?:cliente|empresa|projeto)\s+(?:é|eh|ser[aá])\b/i.test(t)) return false;

    const temEscopo =
      /\b(?:perspectivas?|plantas?|ilustra[cç][oõ]es?|imagens?|render|fachada|vista|ambientes?|escopo|views?|fotomontagem|bird\s*view|humanizada)\b/i.test(
        t
      );
    if (!temEscopo) return false;
    if (textoTemSecoesEstruturadas(texto)) return false;

    if (/\bescopo\s*[=:]/i.test(texto)) return true;
    if (/\bimagens?\s*[=:]/i.test(texto)) return true;
    if (/\b\d{1,2}\s+imagens?\b/i.test(t)) return true;
    if (/\b(?:mais|outras?|outros?|adicional|incluir|adicionar|preciso|quero|faltam?)\b/i.test(t) && temEscopo) {
      return true;
    }
    if (
      /\b(?:apenas|somente|s[oó]|uma|um|\d{1,2})\s+(?:(?:uma|um)\s+)?(?:perspectivas?|plantas?|imagens?)\b/i.test(
        t
      )
    ) {
      return true;
    }
    if (/\bperspectivas?\s+(?:da|de|do|das|dos)\s+\w/i.test(t)) return true;
    if (/\bimagens?\s+(?:da|de|do|das|dos)\s+\w/i.test(t)) return true;
    if (/\b(?:apenas|somente|s[oó])\s+(?:a\s+)?[a-záéíóú]{4,}/i.test(t)) return true;
    if (/,/.test(texto) && temEscopo && !/\bempresa\s+\w/i.test(t)) return true;
    return false;
  }

  function marcarSomenteEscopo(out) {
    out._somente_escopo = true;
    out.cliente = { empresa: "CLIENTE", ref: "PROJETO", contato: "—" };
  }

  /** "tirar brinquedoteca", "remover suite", "sem a academia" */
  function aplicarRemocaoEscopo(texto, out) {
    const alvos = [];
    const re =
      /\b(?:tirar|remover|retirar|excluir|cancelar|sem)\s+(?:a\s+|o\s+|as\s+|os\s+)?([a-záéíóúâêôãõç][a-záéíóúâêôãõç0-9\s-]{2,45}?)(?=\s*$|[,.]|\s+e\s+|\s+nao\b)/gi;
    let m;
    while ((m = re.exec(texto || "")) !== null) {
      const alvo = norm(m[1].trim());
      if (alvo.length >= 3) alvos.push(alvo);
    }
    if (!alvos.length) return false;
    const cats = [
      "externas",
      "internas",
      "plantas",
      "tour_virtual",
      "filmes",
      "apps",
      "drone",
      "extras_diversos",
    ];
    let removidos = 0;
    for (const cat of cats) {
      const antes = (out[cat] || []).length;
      out[cat] = (out[cat] || []).filter((item) => {
        const ni = norm(item);
        return !alvos.some((a) => ni.includes(a) || a.includes(ni));
      });
      removidos += antes - out[cat].length;
    }
    out._remover_alvos = alvos;
    if (removidos > 0) {
      out._somente_escopo = true;
      out._avisos = out._avisos || [];
      out._avisos.push(`Removido(s) ${removidos} item(ns) do escopo.`);
    }
    return alvos.length > 0;
  }

  function aplicarRemocaoAlvos(out, alvos) {
    if (!alvos || !alvos.length) return 0;
    const cats = [
      "externas",
      "internas",
      "plantas",
      "tour_virtual",
      "filmes",
      "apps",
      "drone",
      "extras_diversos",
    ];
    let removidos = 0;
    for (const cat of cats) {
      const antes = (out[cat] || []).length;
      out[cat] = (out[cat] || []).filter((item) => {
        const ni = norm(item);
        return !alvos.some((a) => ni.includes(a) || a.includes(ni));
      });
      removidos += antes - out[cat].length;
    }
    return removidos;
  }

  /** Linhas "- Fachada" ou "1. Suite" */
  function extrairListasPorLinhas(texto, out, avisos) {
    const linhas = (texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const itens = [];
    for (const linha of linhas) {
      const m = linha.match(/^(?:[-*•–—]|\d{1,2}[.)])\s+(.+)$/);
      if (!m) continue;
      const item = limpaItem(m[1]);
      if (item.length >= 2 && item.length < 70) itens.push(tituloCase(item));
    }
    if (itens.length < 2) return false;
    const cat = categoriaEscopo(texto);
    if (out[cat] && out[cat].length) {
      const vistos = new Set((out[cat] || []).map((x) => norm(x)));
      for (const it of itens) {
        if (!vistos.has(norm(it))) out[cat].push(it);
      }
    } else {
      out[cat] = itens;
    }
    marcarSomenteEscopo(out);
    avisos.push(`Lista (${cat}): ${itens.length} ambiente(s).`);
    return true;
  }

  /** "fachada, portaria e lobby" numa frase de escopo */
  function extrairAmbientesPorVirgula(texto, out, avisos) {
    if (!ehMensagemSoEscopo(texto) && !/\bescopo\b/i.test(texto)) return false;
    if (!/,/.test(texto)) return false;
    const stop = texto.search(/\b(?:cliente|empresa|projeto|ref|desconto|valor|pagamento)\s*[=:]/i);
    const trecho = stop > 0 ? texto.slice(0, stop) : texto;
    const partes = trecho
      .split(/[,;]/)
      .map(limpaItem)
      .filter((x) => {
        const n = norm(x);
        return (
          x.length >= 3 &&
          x.length < 50 &&
          !/^(?:apenas|somente|imagens?|perspectivas?|escopo|internas?|externas?)$/i.test(n) &&
          !/^\d+\s/.test(x)
        );
      });
    if (partes.length < 2) return false;
    const cat = categoriaEscopo(texto);
    out[cat] = partes.map((x) => tituloCase(x));
    marcarSomenteEscopo(out);
    avisos.push(`Escopo: ${partes.length} ambiente(s).`);
    return true;
  }

  function empresaPareceInvalida(empresa) {
    const e = (empresa || "").toUpperCase();
    return (
      !e ||
      e === "CLIENTE" ||
      /^PROJETO\s*=/.test(e) ||
      /^=\s/.test(e) ||
      /^(?:APENAS|SOMENTE|UMA|UM|SO|UMA PERSPECTIVA)$/.test(e) ||
      /^APENAS\s/.test(e) ||
      /\bPERSPECTIVA\b/.test(e) ||
      /É\s+O\s+NOME|É\s+A\s+EMPRESA|NOME\s+DAS?\s+CLIENTE/.test(e) ||
      /DESENVOLVIMENTO|ITENS\s+ACIMA|OR[CÇ]AMENTO\s+ANTERIOR|DESCRI(?:TO|ÇÃO)/.test(e) ||
      e.length > 48
    );
  }

  function refPareceInvalida(ref) {
    const r = (ref || "").toUpperCase();
    return (
      !r ||
      r === "PROJETO" ||
      /^=\s/.test(r) ||
      /^(?:UMA PERSPECTIVA|UMA PLANTA|PERSPECTIVA)$/.test(r) ||
      /\bPERSPECTIVA\b/.test(r)
    );
  }

  function limparValorAtribuido(s) {
    return (s || "")
      .trim()
      .replace(/^=\s*/, "")
      .replace(/[.;,]+$/, "")
      .trim();
  }

  /** projeto = X · A/C = Y · cliente = Z (não altera empresa se só projeto/A/C) */
  function extrairAtribuicoesIgual(t, out, avisos) {
    let mudou = false;
    const mEmp = t.match(
      /\b(?:cliente|empresa)\s*=\s*([^\n]+?)(?=\s+(?:projeto|ref|empreendimento|a\/?c)\s*=|$)/i
    );
    const mProj = t.match(
      /\b(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*=\s*([^\n]+?)(?=\s+(?:a\/?c|contato)\s*=|$)/i
    );
    const mAc = t.match(/\b(?:a\/?c|contato)\s*=\s*([^\n]+?)(?=\s+(?:cliente|empresa|projeto|ref)\s*=|$)/i);

    if (mEmp) {
      const emp = empresaFormatada(limparValorAtribuido(mEmp[1]));
      if (!empresaPareceInvalida(emp)) {
        out.cliente.empresa = emp;
        mudou = true;
        avisos.push(`Cliente: ${emp}.`);
      }
    }
    if (mProj) {
      const ref = tituloCase(limparValorAtribuido(mProj[1]));
      if (ref) {
        out.cliente.ref = ref;
        mudou = true;
        avisos.push(`Projeto: ${ref}.`);
      }
    }
    if (mAc) {
      const ac = tituloCase(limparValorAtribuido(mAc[1]));
      if (ac) {
        out.cliente.contato = ac;
        out._atualizou_ac = true;
        mudou = true;
        avisos.push(`A/C: ${ac}.`);
      }
    }
    if (mudou && !mEmp) out._somente_meta_cliente = true;
    return mudou;
  }

  function categoriaEscopo(t) {
    if (/\bexternas?\b/i.test(t) && !/\binternas?\b/i.test(t)) return "externas";
    if (/\bplantas?\b/i.test(t) && !/\bperspectivas?\b/i.test(t) && !/\bimagens?\b/i.test(t)) {
      return "plantas";
    }
    return "internas";
  }

  /** Mensagens sobre imagens/escopo → listas em externas/internas/plantas */
  function extrairEscopoImagens(t, out, avisos) {
    if (!ehMensagemSoEscopo(t)) return false;

    const cat = categoriaEscopo(t);

    const mLista = t.match(
      /\b(?:escopo|imagens?|perspectivas?|internas?|externas?)\s*[=:]\s*([^\n]+)/i
    );
    if (mLista) {
      const itens = mLista[1]
        .split(/[,;]| e (?=[a-záéíóú])/i)
        .map(limpaItem)
        .filter((x) => x.length >= 3 && x.length < 60);
      if (itens.length) {
        out[cat] = itens.map((x) => tituloCase(x));
        marcarSomenteEscopo(out);
        avisos.push(`Escopo (${cat}): ${itens.length} ambiente(s).`);
        return true;
      }
    }

    const mQtdImg = t.match(/\b(\d{1,2})\s+imagens?\s*(internas?|externas?)?/i);
    if (mQtdImg) {
      const qtd = parseInt(mQtdImg[1], 10);
      const c = mQtdImg[2] ? categoriaEscopo(mQtdImg[2]) : cat;
      const resto = t.slice(mQtdImg.index + mQtdImg[0].length);
      const nomes = resto
        .split(/[,;]| e (?=[a-záéíóú])/i)
        .map(limpaItem)
        .filter((x) => x.length >= 3 && x.length < 50);
      if (nomes.length >= 2) {
        out[c] = nomes.map((x) => tituloCase(x));
      } else {
        out[c] = gerarListaPlaceholder(qtd, c === "externas" ? "Perspectiva externa" : "Perspectiva interna");
      }
      marcarSomenteEscopo(out);
      avisos.push(`${qtd} imagem(ns) em ${c}.`);
      return true;
    }

    let m = t.match(
      /\b(?:apenas|somente|s[oó]|mais)?\s*(?:uma|um|\d{1,2})?\s*(?:perspectivas?|plantas?|imagens?)\s+(?:da|de|do|das|dos)\s+([a-záéíóúâêôãõç][a-záéíóúâêôãõç0-9\s-]{2,45}?)(?=\s*$|[,.])/i
    );
    if (!m) {
      const mDa = t.match(/\bimagens?\s+(?:da|de|do|das|dos)\s+(.+?)(?=\s*$|[,.])/i);
      if (mDa) {
        const pedaco = mDa[1].trim();
        if (/\s+e\s+/i.test(pedaco)) {
          const itens = pedaco
            .split(/\s+e\s+/i)
            .map(limpaItem)
            .filter((x) => x.length >= 3);
          if (itens.length >= 2) {
            out[cat] = itens.map((x) => tituloCase(x));
            marcarSomenteEscopo(out);
            avisos.push(`Escopo: ${itens.length} ambiente(s).`);
            return true;
          }
        }
        m = [, pedaco];
      }
    }
    if (!m) {
      m = t.match(
        /\b(?:apenas|somente|s[oó]|mais)\s+(?:a\s+)?([a-záéíóúâêôãõç][a-záéíóúâêôãõç0-9\s-]{3,45}?)(?=\s*$|[,.])/i
      );
    }
    if (m && m[1]) {
      const raw = m[1].trim().replace(/^(?:da|de|do)\s+/i, "");
      if (/\s+e\s+/i.test(raw)) {
        const itens = raw
          .split(/\s+e\s+/i)
          .map(limpaItem)
          .filter((x) => x.length >= 3);
        if (itens.length >= 2) {
          out[cat] = itens.map((x) => tituloCase(x));
          marcarSomenteEscopo(out);
          avisos.push(`Escopo: ${itens.length} ambiente(s).`);
          return true;
        }
      }
      const amb = tituloCase(raw);
      if (amb && amb.length >= 3) {
        const c = /\bplantas?\b/i.test(t) && !/\bimagens?\b/i.test(t) ? "plantas" : cat;
        out[c] = [amb];
        marcarSomenteEscopo(out);
        avisos.push(`Escopo: ${amb}.`);
        return true;
      }
    }

    if (/,/.test(t)) {
      const itens = t
        .split(/[,;]| e (?=[a-záéíóú])/i)
        .map(limpaItem)
        .filter((x) => {
          const n = norm(x);
          return (
            x.length >= 3 &&
            x.length < 50 &&
            !/^(?:apenas|somente|imagens?|perspectivas?|internas?|externas?|escopo)$/i.test(n)
          );
        });
      if (itens.length >= 2) {
        out[cat] = itens.map((x) => tituloCase(x));
        marcarSomenteEscopo(out);
        avisos.push(`Escopo: ${itens.length} ambiente(s) listados.`);
        return true;
      }
    }

    return false;
  }

  /** "Integra voluntarios da patria raquel chiara" → empresa + ref + A/C */
  function extrairEmpresaProjetoNomeCorrido(t, out, avisos) {
    const s = (t || "").trim();
    if (textoTemSecoesEstruturadas(s)) return false;
    if (/(?:^|\n)\s*cliente\s*:/im.test(s)) return false;
    if (ehMensagemSoEscopo(s)) return false;
    if (/^\s*(?:apenas|somente|s[oó]|uma|um|\d+)\b/i.test(s) && /\bperspectivas?\b/i.test(s)) {
      return false;
    }
    if (/\b(?:projeto|cliente|empresa|ref)\s*[=:]/i.test(s)) return false;
    if (/\d+\s+perspectivas?|\bpelo\s+valor\b/i.test(s)) return false;
    const partes = s.split(/\s+/).filter(Boolean);
    if (partes.length < 4 || partes.length > 12) return false;
    const contato = partes.slice(-2).join(" ");
    if (!/^[a-záéíóúâêôãõç]/i.test(contato) || contato.length < 5) return false;
    const empresa = partes[0];
    const ref = partes.slice(1, -2).join(" ");
    if (empresa.length < 3 || ref.length < 4) return false;
    if (/^(?:projeto|cliente|ref|externas|internas)$/i.test(empresa)) return false;
    out.cliente.empresa = empresaFormatada(empresa);
    out.cliente.ref = tituloCase(ref);
    out.cliente.contato = tituloCase(contato);
    avisos.push("Cliente, projeto e A/C interpretados do texto.");
    return true;
  }

  /** "empresa - integra projeto voluntarios da patria ac/ raquel chiara" */
  function extrairLinhaEmpresaProjetoAc(t, out, avisos) {
    const m =
      t.match(
        /\bempresa\s*[-–—:]\s*([a-záéíóúâêôãõç0-9][a-záéíóúâêôãõç0-9&.'-]*)\s+projeto\s+(.+?)\s+(?:a\/?c|ac)\s*[/:.]?\s*([a-záéíóúâêôãõç][a-záéíóúâêôãõç\s.'-]{2,45})/i
      ) ||
      t.match(
        /\bempresa\s+([a-záéíóúâêôãõç0-9][a-záéíóúâêôãõç0-9&.'-]{2,30}?)\s+projeto\s+(.+?)\s+(?:a\/?c|ac)\s*[/:.]?\s*([a-záéíóúâêôãõç][a-záéíóúâêôãõç\s.'-]{2,45})/i
      );
    if (!m) return false;
    out.cliente.empresa = empresaFormatada(m[1]);
    out.cliente.ref = tituloCase(m[2].replace(/\s+e\s+aos.*$/i, "").trim());
    out.cliente.contato = tituloCase(m[3].trim());
    avisos.push("Empresa, projeto e A/C interpretados do texto.");
    return true;
  }

  /** "raquel chiara é o nome da cliente" → sempre A/C (pessoa), nunca substitui empresa */
  function extrairNomeExplicito(t, out, avisos) {
    const m = t.match(
      /(?:^|[\s,])([a-záéíóúâêôãõç][\w\s.'-]{2,45}?)\s+é\s+o\s+nome\s+(?:d[ao]s?\s+)?(?:cliente|clientes|a\/c|contato)\b/i
    );
    if (!m) return false;
    const nome = tituloCase(m[1].trim());
    out.cliente.contato = nome;
    out._atualizou_ac = true;
    avisos.push(`A/C atualizado: ${nome}.`);
    return true;
  }

  function extrairPerspectivasSimples(t, out, avisos) {
    const m =
      t.match(/\b(?:contempla|comtempla|com|inclui)\s+(\d{1,2})\s+perspectivas?\s+([a-záéíóúâêôãõç0-9][a-záéíóúâêôãõç0-9\s-]{2,45})/i) ||
      t.match(/\b(\d{1,2})\s+perspectivas?\s+([a-záéíóúâêôãõç0-9][a-záéíóúâêôãõç0-9\s-]{2,45})/i) ||
      t.match(/\b(\d{1,2})\s+perspectiva\s+([a-záéíóúâêôãõç0-9][a-záéíóúâêôãõç0-9\s-]{2,45})/i);
    if (!m) return false;
    const qtd = Math.min(99, parseInt(m[1], 10) || 1);
    let amb = m[2].trim().replace(/\s+p(?:or|elo)\s+.*$/i, "").replace(/[,.]$/, "");
    amb = tituloCase(amb);
    const cat = /\bexterna/i.test(t) ? "externas" : "internas";
    if (out[cat] && out[cat].length) return false;
    out[cat] = qtd === 1 ? [amb] : gerarListaPlaceholder(qtd, amb);
    if (ehMensagemSoEscopo(t)) marcarSomenteEscopo(out);
    avisos.push(`${qtd} perspectiva(s) ${cat}: ${amb}.`);
    if (!out.modo || out.modo === "completo") {
      out.modo = "adicional";
      out.estrategia = "historico";
    }
    return true;
  }

  function briefingLocalSuficiente(p) {
    if (!p) return false;
    const nImg =
      (p.externas && p.externas.length) +
      (p.internas && p.internas.length) +
      (p.plantas && p.plantas.length);
    const temCli = p.cliente.empresa !== "CLIENTE" && !empresaPareceInvalida(p.cliente.empresa);
    const temRef = p.cliente.ref && p.cliente.ref !== "PROJETO";
    const temAc = p.cliente.contato && p.cliente.contato !== "—";
    if (nImg > 0 && temCli) return true;
    if (temCli && temRef && temAc) return true;
    if (temCli && temRef && nImg > 0) return true;
    if (p.modo === "adicional" && nImg > 0 && p.preco_unitario_contrato > 0) {
      return true;
    }
    if (p.modo === "adicional" && temCli && (nImg > 0 || p.preco_unitario_contrato > 0)) {
      return true;
    }
    if (p._somente_escopo && nImg > 0) return true;
    return false;
  }

  function extrairRotulosCompactos(t, out, avisos) {
    const mSeq = t.match(
      /\bcliente\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s&.'-]{1,40}?)\s+projeto\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s&.'-]{1,50}?)\s+(?:a\/?c|ac)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s.'-]{1,40}?)(?=\s+planta\b|\s+valor\b|\s+externas?\b|\s+internas?\b|$)/i
    );
    if (mSeq) {
      if (out.cliente.empresa === "CLIENTE") out.cliente.empresa = empresaFormatada(mSeq[1]);
      if (out.cliente.ref === "PROJETO") out.cliente.ref = tituloCase(mSeq[2]);
      if (out.cliente.contato === "—") out.cliente.contato = tituloCase(mSeq[3]);
      avisos.push("Cliente, projeto e A/C lidos do texto corrido.");
      return true;
    }

    const mCli = t.match(/\bcliente\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][\w\s&.'-]{2,40}?)(?=\s+projeto\b|\s+ref\b|\s+a\/?c\b|\s+planta\b|$)/i);
    const mProj = t.match(/\b(?:projeto|ref)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][\w\s&.'-]{2,50}?)(?=\s+a\/?c\b|\s+planta\b|\s+valor\b|$)/i);
    const mAc = t.match(/\b(?:a\/?c|ac)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\w\s.'-]{2,40}?)(?=\s+planta\b|\s+valor\b|\s+externas?\b|$)/i);
    if (mCli && out.cliente.empresa === "CLIENTE") {
      out.cliente.empresa = empresaFormatada(mCli[1]);
      avisos.push(`Cliente: ${out.cliente.empresa}.`);
    }
    if (mProj && (out.cliente.ref === "PROJETO" || /\s+e$/i.test(out.cliente.ref))) {
      out.cliente.ref = tituloCase(mProj[1].replace(/\s+e$/i, ""));
    }
    if (mAc && out.cliente.contato === "—") {
      out.cliente.contato = tituloCase(mAc[1]);
    }
    return !!(mSeq || mCli || mProj || mAc);
  }

  function extrairPlantasTextoCorrido(t, out, avisos) {
    if (out.plantas && out.plantas.length) return;
    const bloco = t.split(/\bvalor\s+s[eé]r\b/i)[0];
    const partes = bloco.split(/\bplanta\s+/i).slice(1);
    if (!partes.length) return;
    const itens = partes
      .map((p) => limpaItem(p.split(/\b(?:valor|externas?|internas?)\b/i)[0]))
      .filter((x) => x.length >= 3 && x.length < 80);
    if (itens.length) {
      out.plantas = itens.map((x) => ( /^planta/i.test(x) ? x : `Planta ${tituloCase(x)}`));
      avisos.push(`${itens.length} planta(s) identificada(s) no texto.`);
    }
  }

  /** Interpreta frases livres (chat) quando não há listas com cabeçalho. */
  function enriquecerLinguagemNatural(texto, out) {
    const t = texto || "";
    const avisos = out._avisos || [];

    if (empresaPareceInvalida(out.cliente.empresa)) {
      out.cliente.empresa = "CLIENTE";
    }

    const estruturado = textoTemSecoesEstruturadas(t);

    if (extrairEscopoImagens(t, out, avisos)) {
      out._avisos = avisos;
      return out;
    }
    if (!estruturado && extrairListasPorLinhas(t, out, avisos)) {
      out._avisos = avisos;
      return out;
    }
    if (!estruturado && extrairAmbientesPorVirgula(t, out, avisos)) {
      out._avisos = avisos;
      return out;
    }
    extrairAtribuicoesIgual(t, out, avisos);
    extrairNomeExplicito(t, out, avisos);
    extrairLinhaEmpresaProjetoAc(t, out, avisos);
    extrairEmpresaProjetoNomeCorrido(t, out, avisos);
    extrairPerspectivasSimples(t, out, avisos);
    extrairRotulosCompactos(t, out, avisos);
    extrairPlantasTextoCorrido(t, out, avisos);

    const mEmpresa = t.match(
      /(?:^|[\s,;.\-–—])(?:da\s+)?empresa\s+([a-záéúâêôãõç0-9][a-záéúâêôãõç0-9\s&.'-]{1,48}?)(?=\s*[-–—,]|\s+projeto\b|\s+empreendimento\b|\s+aos\s+cuidados|\s+desconto\b|$)/i
    );
    const mEmpresa2 = t.match(
      /(?:apenas\s+)?(?:da\s+)?empresa\s+([a-záéúâêôãõç][a-záéúâêôãõç0-9\s&.'-]{2,40}?)(?=\s*[-–—,]|\s+projeto\b|\s*,|\s+e\s+aos|\s+aos\s+cuidados|$)/i
    );
    const mClienteSo = t.match(
      /\bcliente\s+([a-záéúâêôãõç][a-záéúâêôãõç0-9\s&.'-]{2,40}?)(?=\s*[-–—,]|\s+projeto\b|\s+ref\b|\s+aos\s+cuidados|$)/i
    );
    const mProjeto = t.match(
      /(?:^|[\s,;.\-–—])projeto\s+([a-záéúâêôãõç0-9][a-záéúâêôãõç0-9\s&.'-]{1,60}?)(?=\s+e\s+aos\s+cuidados|\s+aos\s+cuidados\s+de|\s+desconto\b|[,.]|$)/i
    );
    const mContato = t.match(
      /aos\s+cuidados\s+de\s+([a-záéúâêôãõç][a-záéúâêôãõç\s.'-]{1,40}?)(?=\s*[,.\-–—]|$)/i
    );
    const mAcCurto = t.match(
      /(?:^|[\s,;.\-–—])(?:a\/?c)\s+([a-záéúâêôãõç][a-záéúâêôãõç\s.'-]{2,35}?)(?=\s*[,.\-–—]|$)/i
    );

    if (out.cliente.empresa === "CLIENTE" && mEmpresa) {
      out.cliente.empresa = empresaFormatada(mEmpresa[1]);
      avisos.push(`Cliente interpretado: ${out.cliente.empresa}.`);
    } else if (out.cliente.empresa === "CLIENTE" && mEmpresa2) {
      out.cliente.empresa = empresaFormatada(mEmpresa2[1]);
      avisos.push(`Cliente interpretado: ${out.cliente.empresa}.`);
    } else if (out.cliente.empresa === "CLIENTE" && mClienteSo) {
      out.cliente.empresa = empresaFormatada(mClienteSo[1]);
      avisos.push(`Cliente interpretado: ${out.cliente.empresa}.`);
    }
    if (mProjeto) {
      const refNl = mProjeto[1].trim().replace(/\s+e$/i, "").replace(/[.;,]+$/, "");
      if (refNl) {
        out.cliente.ref = tituloCase(refNl);
        avisos.push(`Projeto interpretado: ${out.cliente.ref}.`);
      }
    } else if (out.cliente.ref && /\s+(?:e\s+)?aos\s+cuidados/i.test(out.cliente.ref)) {
      out.cliente.ref = tituloCase(
        out.cliente.ref.replace(/\s+(?:e\s+)?aos\s+cuidados.*$/i, "").replace(/\s+e$/i, "")
      );
    } else if (out.cliente.ref && /\s+e$/i.test(out.cliente.ref)) {
      out.cliente.ref = tituloCase(out.cliente.ref.replace(/\s+e$/i, ""));
    }
    if (out.cliente.contato === "—" && mContato) {
      out.cliente.contato = tituloCase(mContato[1]);
      avisos.push(`A/C interpretado: ${out.cliente.contato}.`);
    } else if (out.cliente.contato === "—" && mAcCurto) {
      out.cliente.contato = tituloCase(mAcCurto[1]);
    }

    const aDefinir = /\ba\s+definir\b/i.test(t);
    const padroesQtd = [
      {
        cat: "internas",
        re: /(\d{1,3})\s*(?:(?:perspectivas?|imagens?|ilustra[cç][oõ]es?|views?)\s*)?internas?/gi,
        rotulo: aDefinir ? "A definir" : "Perspectiva interna",
      },
      {
        cat: "externas",
        re: /(\d{1,3})\s*(?:(?:perspectivas?|imagens?|ilustra[cç][oõ]es?)\s*)?externas?/gi,
        rotulo: aDefinir ? "A definir" : "Perspectiva externa",
      },
      {
        cat: "plantas",
        re: /(\d{1,3})\s*plantas?(?:\s+humanizadas?)?/gi,
        rotulo: aDefinir ? "A definir" : "Planta",
      },
    ];

    for (const { cat, re, rotulo } of padroesQtd) {
      if (out[cat] && out[cat].length) continue;
      const m = re.exec(t);
      if (!m) continue;
      const qtd = parseInt(m[1], 10);
      if (qtd > 0 && qtd <= 99) {
        out[cat] = gerarListaPlaceholder(qtd, rotulo);
        avisos.push(`${qtd} ${cat} (${rotulo.toLowerCase()}).`);
      }
    }

    const soInternas = /\binternas?\b/i.test(t) && !/\bexternas?\b/i.test(t);
    const soExternas = /\bexternas?\b/i.test(t) && !/\binternas?\b/i.test(t);
    if (!out.internas.length && soInternas && /\bdefinir\b/i.test(t)) {
      const m = /(\d{1,3})\s+/.exec(t);
      const qtd = m ? parseInt(m[1], 10) : 1;
      if (qtd > 0) {
        out.internas = gerarListaPlaceholder(qtd, "A definir");
        avisos.push(`${qtd} internas a definir.`);
      }
    }

    out._avisos = avisos;
    return out;
  }

  function mesclarBriefing(anterior, novo) {
    if (!novo) return anterior;
    if (!anterior) return novo;

    const out = {
      cliente: { ...anterior.cliente },
      externas: [...(anterior.externas || [])],
      internas: [...(anterior.internas || [])],
      plantas: [...(anterior.plantas || [])],
      tour_virtual: [...(anterior.tour_virtual || [])],
      filmes: [...(anterior.filmes || [])],
      apps: [...(anterior.apps || [])],
      drone: [...(anterior.drone || [])],
      extras_diversos: [...(anterior.extras_diversos || [])],
      extras_detectados: [...(anterior.extras_detectados || [])],
      desconto_pct: anterior._desconto_explicito ? anterior.desconto_pct || 0 : 0,
      desconto_label: anterior._desconto_explicito ? anterior.desconto_label : null,
      _desconto_explicito: !!(anterior._desconto_explicito && anterior.desconto_pct > 0),
      modo: anterior.modo || "completo",
      preco_unitario_contrato: anterior.preco_unitario_contrato || 0,
      estrategia: anterior.estrategia || "auto",
      mostrar_precos_individuais: anterior.mostrar_precos_individuais,
      _origem: novo._origem || anterior._origem,
      _avisos: [...(anterior._avisos || []), ...(novo._avisos || [])],
    };

    const trocaCliente =
      novo.cliente.empresa !== "CLIENTE" &&
      anterior.cliente.empresa !== "CLIENTE" &&
      norm(novo.cliente.empresa) !== norm(anterior.cliente.empresa);
    const novoTemListas =
      (novo.externas && novo.externas.length) +
      (novo.internas && novo.internas.length) +
      (novo.plantas && novo.plantas.length) > 0;

    const substituirListas =
      (trocaCliente && novoTemListas) ||
      (novo.modo === "adicional" && novoTemListas);

    if (substituirListas) {
      out.externas = [...(novo.externas || [])];
      out.internas = [...(novo.internas || [])];
      out.plantas = [...(novo.plantas || [])];
    } else {
      function uni(cat) {
        const vistos = new Set();
        const lista = [];
        for (const item of [...(anterior[cat] || []), ...(novo[cat] || [])]) {
          const k = norm(item);
          if (!k || vistos.has(k)) continue;
          vistos.add(k);
          lista.push(item);
        }
        return lista;
      }
      out.externas = uni("externas");
      out.internas = uni("internas");
      out.plantas = uni("plantas");
    }

    const corrigeSoAc =
      !!(novo._atualizou_ac && novo.cliente.contato !== "—") ||
      (novo.cliente.contato !== "—" &&
        norm(novo.cliente.contato) === norm(novo.cliente.empresa) &&
        anterior.cliente.empresa !== "CLIENTE" &&
        !empresaPareceInvalida(anterior.cliente.empresa));
    const novoSoMeta =
      !!novo._somente_meta_cliente ||
      (novo.cliente.empresa === "CLIENTE" &&
        (novo.cliente.ref !== "PROJETO" || novo.cliente.contato !== "—"));
    const novoSoEscopo = !!novo._somente_escopo;

    if (
      !novoSoEscopo &&
      novo.cliente.empresa !== "CLIENTE" &&
      !empresaPareceInvalida(novo.cliente.empresa) &&
      !corrigeSoAc &&
      !novoSoMeta
    ) {
      out.cliente.empresa = novo.cliente.empresa;
    }
    if (!novoSoEscopo && novo.cliente.ref !== "PROJETO") {
      const refLimpa = tituloCase(limparValorAtribuido(novo.cliente.ref));
      if (refLimpa && !refPareceInvalida(refLimpa)) out.cliente.ref = refLimpa;
    }
    if (!novoSoEscopo && novo.cliente.contato !== "—") {
      out.cliente.contato = novo.cliente.contato;
    }
    if (novo._remove_desconto) {
      out.desconto_pct = 0;
      out.desconto_label = null;
      out._desconto_explicito = false;
    } else if (novo._desconto_explicito && novo.desconto_pct > 0) {
      out.desconto_pct = novo.desconto_pct;
      out.desconto_label = novo.desconto_label || `${novo.desconto_pct}%`;
      out._desconto_explicito = true;
    }
    if (novo.modo === "adicional") {
      out.modo = "adicional";
      out.estrategia = "historico";
      if (novo.preco_unitario_contrato > 0) {
        out.preco_unitario_contrato = novo.preco_unitario_contrato;
      }
    }
    if (novo.estrategia && novo.estrategia !== "auto") out.estrategia = novo.estrategia;
    if (novo.mostrar_precos_individuais) out.mostrar_precos_individuais = true;

    if (novo._remover_alvos && novo._remover_alvos.length) {
      const n = aplicarRemocaoAlvos(out, novo._remover_alvos);
      if (n > 0) {
        out._somente_escopo = true;
        out._avisos.push(`Removido(s) ${n} item(ns) do escopo.`);
      }
    }

    out._avisos = [...new Set(out._avisos)].slice(0, 8);
    return out;
  }

  function parseConversacional(textoOrig) {
    const out = parse(textoOrig);
    if (detectarRemocaoDesconto(textoOrig)) {
      out.desconto_pct = 0;
      out.desconto_label = null;
      out._remove_desconto = true;
      if (ehMensagemSoCorrecaoDesconto(textoOrig)) {
        out.cliente = { empresa: "CLIENTE", ref: "PROJETO", contato: "—" };
        out._avisos = (out._avisos || []).filter((a) => !/assumi.*cliente/i.test(a));
        out._avisos.push("Desconto removido conforme sua mensagem.");
      }
    }
    if (ehMensagemSoEscopo(textoOrig)) {
      marcarSomenteEscopo(out);
      out._avisos = (out._avisos || []).filter((a) => !/assumi.*cliente/i.test(a));
    }
    enriquecerLinguagemNatural(textoOrig, out);
    if (out._somente_escopo) {
      marcarSomenteEscopo(out);
      out._avisos = (out._avisos || []).filter(
        (a) => !/interpretados do texto|assumi.*cliente/i.test(a)
      );
    }
    aplicarModoAdicional(textoOrig, out);
    if (!out.preco_unitario_contrato) aplicarPrecoContrato(textoOrig, out);
    if (!out.externas.length && !out.internas.length && !out.plantas.length &&
        !(out.tour_virtual && out.tour_virtual.length)) {
      const det = detectarExtrasSoltos(textoOrig, {
        tour_virtual: out.tour_virtual,
        filmes: out.filmes,
        apps: out.apps,
        drone: out.drone,
        extras_diversos: out.extras_diversos,
      });
      if (det.length) out.extras_detectados = det;
    }
    const av = out._avisos || [];
    const temImg =
      out.externas.length || out.internas.length || out.plantas.length;
    if (temImg) {
      for (let i = av.length - 1; i >= 0; i -= 1) {
        if (/Não consegui identificar nenhuma seção/.test(av[i])) av.splice(i, 1);
      }
    }
    aplicarRemocaoEscopo(textoOrig, out);

    const nTec =
      (out.tour_virtual && out.tour_virtual.length) +
      (out.filmes && out.filmes.length) +
      (out.apps && out.apps.length);
    if (nTec && ehMensagemSoEscopo(textoOrig)) marcarSomenteEscopo(out);

    out._avisos = av;
    out._origem = "conversacional";
    return out;
  }

  function serializar(parsed) {
    const p = parsed || {};
    const c = p.cliente || { empresa: "CLIENTE", ref: "PROJETO", contato: "—" };
    const linhas = [
      `Cliente: ${c.empresa}`,
      `Ref: ${c.ref}`,
      `A/C: ${c.contato}`,
    ];
    if (p.modo === "adicional") {
      linhas.push("Modo: proposta adicional (preço do contrato)");
      if (p.preco_unitario_contrato > 0) {
        linhas.push(`Preço unitário contrato: R$ ${p.preco_unitario_contrato}`);
      }
    }
    if (p.desconto_pct > 0 && p._desconto_explicito) linhas.push(`Desconto: ${p.desconto_pct}%`);
    if (p.estrategia === "historico") linhas.push("Use o histórico do cliente.");
    else if (p.estrategia === "planilha") linhas.push("Use preço de planilha.");

    function bloco(titulo, itens) {
      if (!itens || !itens.length) return;
      linhas.push("", `${titulo}:`);
      for (const it of itens) linhas.push(`- ${it}`);
    }

    bloco("Externas", p.externas);
    bloco("Internas", p.internas);
    bloco("Plantas", p.plantas);
    bloco("Tour Virtual", p.tour_virtual);
    bloco("Filmes", p.filmes);
    bloco("Apps", p.apps);
    bloco("Drone", p.drone);
    bloco("Extras", p.extras_diversos);
    return linhas.join("\n").trim();
  }

  function parse(textoOrig) {
    const texto = (textoOrig || "").trim();
    const avisos = [];

    if (!texto) {
      return {
        cliente: { empresa: "CLIENTE", ref: "PROJETO", contato: "—" },
        externas: [], internas: [], plantas: [],
        desconto_pct: 0, desconto_label: null,
        _desconto_explicito: false,
        modo: "completo",
        preco_unitario_contrato: 0,
        estrategia: "auto",
        mostrar_precos_individuais: false,
        _origem: "local", _avisos: ["Texto vazio."],
      };
    }

    const removeDesconto = detectarRemocaoDesconto(texto);
    const soCorrecaoDesconto = ehMensagemSoCorrecaoDesconto(texto);

    const mCli = RE_CLIENTE.exec(texto);
    const mRef = RE_REF.exec(texto);
    const mCon = RE_CONTATO.exec(texto);

    let cliente = mCli ? mCli[1].trim().replace(/[.;,]+$/, "") : "";
    let ref = mRef ? mRef[1].trim().replace(/[.;,]+$/, "") : "";
    let contato = mCon ? mCon[1].trim().replace(/[.;,]+$/, "") : "";

    const estruturado = textoTemSecoesEstruturadas(texto);

    if (!cliente && !soCorrecaoDesconto && !ehMensagemSoEscopo(texto) && !estruturado) {
      const primeira = texto.split(/\r?\n/, 1)[0].trim();
      const linhaSoMeta = /^\s*(?:projeto|ref|empreendimento|a\/?c|contato)\s*=/i.test(primeira);
      const mCaps =
        !linhaSoMeta &&
        primeira.match(
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
        } else if (
          primeira &&
          primeira.length < 60 &&
          !ehLinhaMetaDescritiva(primeira) &&
          !linhaSoMeta
        ) {
          cliente = primeira;
          avisos.push(`Cliente não foi marcado explicitamente — assumi '${cliente}' (1ª linha).`);
        }
      }
    }

    let desconto_pct = 0;
    let desconto_label = null;
    let _desconto_explicito = false;
    if (!removeDesconto) {
      const d = detectarPedidoDesconto(texto);
      desconto_pct = d.pct;
      desconto_label = d.label;
      _desconto_explicito = d.explicito;
    }

    let estrategia = "auto";
    if (RE_ESTRATEGIA_PLAN.test(texto)) estrategia = "planilha";
    else if (RE_ESTRATEGIA_HIST.test(texto)) estrategia = "historico";

    const blocos = splitSecoes(texto);
    const externas = extraiLista(blocos.externas || "");
    const internas = extraiLista(blocos.internas || "");
    const plantas = extraiLista(blocos.plantas || "");

    // Extras (tour virtual, filmes, apps, drone, extras genéricos)
    const tour_virtual = extraiLista(blocos.tour_virtual || "");
    const filmes = extraiLista(blocos.filmes || "");
    const apps = extraiLista(blocos.apps || "");
    const drone = extraiLista(blocos.drone || "");
    const extras_diversos = extraiLista(blocos.extras || "");

    // Só interpreta tecnologias dentro do bloco "Escopo:" / "Tecnologias:" (nunca no texto inteiro)
    const blocoEscopo = [blocos.escopo, blocos.tour_virtual, blocos.filmes, blocos.apps, blocos.drone]
      .filter(Boolean)
      .join("\n");
    const detSolta = blocoEscopo
      ? detectarExtrasSoltos(blocoEscopo, { tour_virtual, filmes, apps, drone, extras_diversos })
      : [];

    if (!externas.length && !internas.length && !plantas.length &&
        !tour_virtual.length && !filmes.length && !apps.length && !drone.length &&
        !extras_diversos.length && !detSolta.length) {
      avisos.push("Não consegui identificar nenhuma seção (Externas/Internas/Plantas/Tour Virtual/Filmes/Apps). Use cabeçalhos tipo 'Externas:' seguidos da lista.");
    }

    const empresaFmt = empresaFormatada(cliente);
    const refFmt = ref ? tituloCase(limparValorAtribuido(ref)) : "PROJETO";
    const contatoFmt = contato ? tituloCase(limparValorAtribuido(contato)) : "—";
    return {
      cliente: {
        empresa: empresaPareceInvalida(empresaFmt) ? "CLIENTE" : empresaFmt,
        ref: refFmt && !empresaPareceInvalida(refFmt) ? refFmt : "PROJETO",
        contato: contatoFmt,
      },
      externas, internas, plantas,
      tour_virtual, filmes, apps, drone,
      extras_diversos,
      extras_detectados: detSolta,
      desconto_pct,
      desconto_label,
      _desconto_explicito,
      modo: "completo",
      preco_unitario_contrato: 0,
      estrategia,
      mostrar_precos_individuais: RE_PRECOS_IND.test(texto),
      _origem: "local",
      _avisos: avisos,
    };
  }

  // Detecta menções soltas (sem cabeçalho) de extras no texto inteiro.
  // Útil pra prompts curtos tipo "...e D.Brave, filme produto 1:30, tour virtual áreas de lazer".
  function detectarExtrasSoltos(texto, jaMencionados) {
    const PRECOS = window.FLYING_PRECOS;
    if (!PRECOS) return [];
    const det = [];
    const alvo = norm(texto);

    function jaTem(lista, item) {
      return (lista || []).some((x) => norm(x).includes(item) || item.includes(norm(x)));
    }

    // Tour virtual: detecta variantes específicas
    for (const amb of (PRECOS.tour_virtual && PRECOS.tour_virtual.ambientes) || []) {
      if (amb.chave === "outro") continue;
      for (const pad of amb.padroes) {
        if (pad === ".*" || pad === ".\\*") continue;
        if (new RegExp(pad).test(alvo)) {
          // Confere se não veio de uma seção explícita "Tour Virtual:"
          if (!jaTem(jaMencionados.tour_virtual, amb.rotulo.toLowerCase())) {
            // E não duplica
            if (!det.some((d) => d.tipo === "tour_virtual" && d.chave === amb.chave)) {
              det.push({ tipo: "tour_virtual", chave: amb.chave, rotulo: amb.rotulo, preco: amb.preco });
            }
          }
          break;
        }
      }
    }

    // Filmes
    for (const f of (PRECOS.filmes && PRECOS.filmes.catalogo) || []) {
      for (const pad of f.padroes) {
        if (new RegExp(pad).test(alvo)) {
          if (!jaTem(jaMencionados.filmes, f.rotulo.toLowerCase()) &&
              !det.some((d) => d.tipo === "filme" && d.chave === f.chave)) {
            det.push({ tipo: "filme", chave: f.chave, rotulo: f.rotulo, preco: f.preco });
          }
          break;
        }
      }
    }

    // Apps
    for (const a of (PRECOS.apps && PRECOS.apps.catalogo) || []) {
      for (const pad of a.padroes) {
        if (new RegExp(pad).test(alvo)) {
          if (!jaTem(jaMencionados.apps, a.rotulo.toLowerCase()) &&
              !det.some((d) => d.tipo === "app" && d.chave === a.chave)) {
            det.push({ tipo: "app", chave: a.chave, rotulo: a.rotulo, preco: a.preco });
          }
          break;
        }
      }
    }

    // Maquete eletrônica (só se ainda não detectado)
    const mq = PRECOS.maquete_eletronica;
    if (mq) {
      for (const pad of mq.padroes) {
        if (new RegExp(pad).test(alvo)) {
          det.push({ tipo: "maquete", chave: mq.chave, rotulo: mq.rotulo, preco: mq.preco });
          break;
        }
      }
    }

    // Estudo de fachada
    const ef = PRECOS.estudo_fachada;
    if (ef) {
      for (const pad of ef.padroes) {
        if (new RegExp(pad).test(alvo)) {
          // Só se NÃO houver imagens externas — evita confusão
          // (estudo de fachada é serviço separado, não perspectiva)
          if (/estudo.*fachada|estudo cromatic|cromatic.*fachada/i.test(texto)) {
            det.push({ tipo: "estudo_fachada", chave: ef.chave, rotulo: ef.rotulo, preco: ef.preco });
            break;
          }
        }
      }
    }

    // Drone (só se houver "voo de drone" claro)
    for (const d of (PRECOS.drone && PRECOS.drone.catalogo) || []) {
      for (const pad of d.padroes) {
        if (new RegExp(pad).test(alvo)) {
          if (!det.some((x) => x.tipo === "drone" && x.chave === d.chave)) {
            det.push({ tipo: "drone", chave: d.chave, rotulo: d.rotulo, preco: d.preco });
          }
          break;
        }
      }
    }

    return det;
  }

  window.FlyingParser = {
    parse,
    parseConversacional,
    serializar,
    mesclarBriefing,
    enriquecerLinguagemNatural,
    detectarRemocaoDesconto,
    detectarPedidoDesconto,
    detectarPropostaAdicional,
    briefingLocalSuficiente,
    ehMensagemSoEscopo,
    textoTemSecoesEstruturadas,
    aplicarRemocaoEscopo,
    empresaPareceInvalida,
    refPareceInvalida,
    ehMensagemSoCorrecaoDesconto,
    norm,
    limpaItem,
  };
})();
