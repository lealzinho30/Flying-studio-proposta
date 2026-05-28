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

  const RE_CLIENTE = /(?:^|\n|[,;.])\s*(?:cliente|empresa)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:ref|projeto|empreendimento|a\/?c|contato|aos\s+cuidados))/i;
  const RE_REF = /(?:^|\n|[,;.\-–—])\s*(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|a\/?c|contato|aos\s+cuidados|\d+\s*%))/i;
  const RE_CONTATO = /(?:^|\n|[,;.])\s*(?:a\/?c|contato|aos\s+cuidados\s+de?)\s*[:\-.]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|ref|projeto|empreendimento|\d+\s*%))/i;
  const RE_DESCONTO = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s*)?(?:desconto|desc\.?|off)/i;
  const RE_DESCONTO2 = /desconto\s*(?:de|:)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i;
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

  /** Interpreta frases livres (chat) quando não há listas com cabeçalho. */
  function enriquecerLinguagemNatural(texto, out) {
    const t = texto || "";
    const avisos = out._avisos || [];

    const mEmpresa = t.match(
      /(?:^|[\s,;.\-–—])(?:da\s+)?empresa\s+([a-záéúâêôãõç0-9][a-záéúâêôãõç0-9\s&.'-]{1,48}?)(?=\s*[-–—,]|\s+projeto\b|\s+empreendimento\b|\s+aos\s+cuidados|\s+desconto\b|$)/i
    );
    const mProjeto = t.match(
      /(?:^|[\s,;.\-–—])projeto\s+([a-záéúâêôãõç0-9][a-záéúâêôãõç0-9\s&.'-]{1,60}?)(?=\s+e\s+aos\s+cuidados|\s+aos\s+cuidados\s+de|\s+desconto\b|[,.]|$)/i
    );
    const mContato = t.match(
      /aos\s+cuidados\s+de\s+([a-záéúâêôãõç][a-záéúâêôãõç\s.'-]{1,40}?)(?=\s*[,.\-–—]|$)/i
    );

    if ((!out.cliente.empresa || out.cliente.empresa === "CLIENTE") && mEmpresa) {
      out.cliente.empresa = empresaFormatada(mEmpresa[1]);
      avisos.push(`Cliente interpretado: ${out.cliente.empresa}.`);
    }
    if (mProjeto) {
      let refNl = mProjeto[1].trim().replace(/\s+e$/i, "").replace(/[.;,]+$/, "");
      if ((!out.cliente.ref || out.cliente.ref === "PROJETO" || /\s+e$/i.test(out.cliente.ref)) && refNl) {
        out.cliente.ref = tituloCase(refNl);
        avisos.push(`Projeto interpretado: ${out.cliente.ref}.`);
      }
    } else if (out.cliente.ref && /\s+e$/i.test(out.cliente.ref)) {
      out.cliente.ref = tituloCase(out.cliente.ref.replace(/\s+e$/i, ""));
    }
    if ((!out.cliente.contato || out.cliente.contato === "—") && mContato) {
      out.cliente.contato = tituloCase(mContato[1]);
      avisos.push(`A/C interpretado: ${out.cliente.contato}.`);
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

  function parseConversacional(textoOrig) {
    const out = parse(textoOrig);
    enriquecerLinguagemNatural(textoOrig, out);
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
    if (!out.externas.length && !out.internas.length && !out.plantas.length) {
      const idx = av.findIndex((a) => a.includes("Não consegui identificar nenhuma seção"));
      if (idx >= 0) av.splice(idx, 1);
    }
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
    if (p.desconto_pct > 0) linhas.push(`Desconto: ${p.desconto_pct}%`);
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

    return {
      cliente: {
        empresa: cliente || "CLIENTE",
        ref: ref || "PROJETO",
        contato: contato || "—",
      },
      externas, internas, plantas,
      tour_virtual, filmes, apps, drone,
      extras_diversos,
      extras_detectados: detSolta,
      desconto_pct,
      desconto_label: null,
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
    enriquecerLinguagemNatural,
    norm,
    limpaItem,
  };
})();
