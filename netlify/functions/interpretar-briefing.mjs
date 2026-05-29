/**
 * Interpreta mensagem de chat / briefing em linguagem natural → JSON da proposta Flying.
 * Variáveis: GEMINI_API_KEY ou ANTHROPIC_API_KEY (mesmo padrão do analisar-planta).
 */

const PROMPT = `Você converte mensagens em português sobre propostas comerciais da Flying Studio (imagens 3D imobiliárias) em JSON.

Responda APENAS JSON válido (sem markdown):
{
  "cliente": {"empresa": "NOME EMPRESA EM MAIÚSCULAS", "ref": "Nome do projeto", "contato": "Nome do contato"},
  "externas": ["ambiente1", "ambiente2"],
  "internas": ["ambiente1"],
  "plantas": ["implantação térreo"],
  "desconto_pct": 0,
  "estrategia": "auto",
  "mostrar_precos_individuais": false,
  "avisos": []
}

Regras:
- Entenda frases como: "10 perspectivas internas a definir, empresa Tarraf, projeto Vila Mariana, A/C Larissa".
- "Cliente X Projeto Y A/C Z" sem dois-pontos também vale.
- Se disser "N internas/externas/plantas a definir", gere N itens "A definir 01", "A definir 02", etc.
- Se listar plantas ou ambientes em CAPS ou texto corrido, coloque em externas/internas/plantas conforme o tipo.
- Nomes de ambiente curtos, sem prefixo "Perspectiva" (o sistema adiciona depois).
- empresa sempre MAIÚSCULAS; ref e contato em formato título.
- estrategia: "planilha" se pedir tabela/planilha; "historico" se pedir histórico do cliente; senão "auto".
- Ignore valores em R$, forma de pagamento e sinal — não entram no JSON. Percentuais de parcelas (50% sinal, 50% entrega) NÃO são desconto.
- desconto_pct: use valor > 0 SOMENTE se o usuário pedir desconto explicitamente (ex.: "10% de desconto"). Caso contrário sempre 0.
- Proposta adicional / imagens adicionais / mesmo valor do contrato: liste só os itens mencionados; não invente escopo grande.
- Se o usuário NEGAR desconto ("não pedi 12%", "sem desconto", "tirar desconto"), use desconto_pct: 0 e NÃO altere cliente/projeto/contato — mantenha empresa "CLIENTE" se não souber o nome.
- ESCOPO vs CLIENTE: se a mensagem fala só de imagens/perspectivas/plantas/ambientes ("apenas uma perspectiva da brinquedoteca", "3 imagens: suite, gourmet", "mais imagens"), preencha SOMENTE externas/internas/plantas e deixe cliente {"empresa":"CLIENTE","ref":"PROJETO","contato":"—"} — NUNCA use palavras da frase como nome de empresa.
- Quando o usuário diz "imagens", trata como escopo (lista de ambientes), não como cadastro de cliente.
- Se faltar dado, use empresa "CLIENTE", ref "PROJETO", contato "—" e explique em avisos.`;

function extrairJson(texto) {
  const t = (texto || "").trim();
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini >= 0 && fim > ini) return JSON.parse(t.slice(ini, fim + 1));
  throw new Error("JSON inválido da IA");
}

function normalizar(raw) {
  const pick = (k) => (Array.isArray(raw[k]) ? raw[k].map((s) => String(s).trim()).filter(Boolean) : []);
  const c = raw.cliente && typeof raw.cliente === "object" ? raw.cliente : {};
  return {
    cliente: {
      empresa: String(c.empresa || "CLIENTE").trim().toUpperCase() || "CLIENTE",
      ref: String(c.ref || "PROJETO").trim() || "PROJETO",
      contato: String(c.contato || "—").trim() || "—",
    },
    externas: pick("externas"),
    internas: pick("internas"),
    plantas: pick("plantas"),
    desconto_pct: Number(raw.desconto_pct) || 0,
    desconto_label: null,
    estrategia: ["auto", "planilha", "historico"].includes(raw.estrategia) ? raw.estrategia : "auto",
    mostrar_precos_individuais: !!raw.mostrar_precos_individuais,
    tour_virtual: [],
    filmes: [],
    apps: [],
    drone: [],
    extras_diversos: [],
    extras_detectados: [],
    _origem: "ia",
    _avisos: pick("avisos"),
  };
}

async function chamarGemini(texto) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada.");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nMensagem do usuário:\n${texto}` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error?.message || res.statusText);
    if (/quota|rate limit|exceeded|free_tier/i.test(err.message)) err.code = "QUOTA";
    throw err;
  }
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return normalizar(extrairJson(out));
}

async function chamarAnthropic(texto) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada.");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.1,
      system: PROMPT,
      messages: [{ role: "user", content: texto }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || res.statusText);
  const out = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return normalizar(extrairJson(out));
}

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ erro: "Use POST" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const texto = String(payload.texto || "").trim();
    if (!texto) {
      return { statusCode: 400, headers, body: JSON.stringify({ erro: "Texto vazio." }) };
    }
    if (texto.length > 24000) {
      return { statusCode: 400, headers, body: JSON.stringify({ erro: "Texto muito longo." }) };
    }

    const provider = (process.env.PLANTAS_IA_PROVIDER || "gemini").toLowerCase();
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    if (!hasGemini && !hasAnthropic) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ erro: "IA não configurada. Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY no Netlify." }),
      };
    }

    const parsed = provider === "anthropic" && hasAnthropic
      ? await chamarAnthropic(texto)
      : hasGemini
        ? await chamarGemini(texto)
        : await chamarAnthropic(texto);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, provider, parsed }),
    };
  } catch (err) {
    const msg = err.message || String(err);
    const quota = err.code === "QUOTA" || /quota|rate limit|exceeded|free_tier/i.test(msg);
    return {
      statusCode: quota ? 429 : 500,
      headers,
      body: JSON.stringify({
        erro: quota
          ? "Cota da API Gemini esgotada. O site usa interpretação local até você ativar billing ou outro modelo."
          : msg,
        quota,
      }),
    };
  }
}
