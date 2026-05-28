/**
 * Analisa PDF de projeto (páginas em JPEG base64) e devolve listagem Flying.
 * Variáveis de ambiente (Netlify):
 *   PLANTAS_IA_PROVIDER = gemini | anthropic  (padrão: anthropic)
 *   GEMINI_API_KEY      — Google AI Studio (tier gratuito disponível)
 *   ANTHROPIC_API_KEY   — se usar Claude
 */

const PROMPT_SISTEMA = `Você é especialista em propostas comerciais da Flying Studio (imagens 3D para lançamentos imobiliários).

Analise as páginas do projeto arquitetônico (plantas, implantação, cortes, fachadas, áreas comuns) e liste TODAS as imagens 3D que faz sentido orçar para marketing do empreendimento.

Regras:
- externas: perspectivas externas, fachadas, áreas de lazer vistas de fora, piscina, jardim, rooftop, bird view, portaria, playground, gourmet externo, etc.
- internas: perspectivas de ambientes internos (academia, salão de festas, suíte, lobby, etc.)
- plantas: plantas humanizadas / implantações (térreo, tipo, mezanino, rooftop, garagem se relevante)
- Use prefixos: "Perspectiva " para externas/internas quando não estiver no nome; "Planta Humanizada " para plantas/implantação.
- NÃO inclua tour virtual, filmes, apps, drone, maquete — só imagens estáticas 3D.
- Não invente ambientes que não aparecem no projeto; em dúvida, inclua com confiança "media" no JSON.
- Responda APENAS com JSON válido (sem markdown), neste formato:
{"externas":["..."],"internas":["..."],"plantas":["..."],"avisos":["..."],"cliente_sugerido":{"empresa":"","ref":"","contato":""}}`;

function extrairJson(texto) {
  const t = (texto || "").trim();
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini >= 0 && fim > ini) {
    try {
      return JSON.parse(t.slice(ini, fim + 1));
    } catch (_) { /* continua */ }
  }
  throw new Error("A IA não retornou JSON válido. Tente novamente ou reduza o PDF.");
}

function normalizarListagem(raw) {
  const pick = (k) => (Array.isArray(raw[k]) ? raw[k].map((s) => String(s).trim()).filter(Boolean) : []);
  return {
    externas: pick("externas"),
    internas: pick("internas"),
    plantas: pick("plantas"),
    avisos: pick("avisos"),
    cliente_sugerido: raw.cliente_sugerido && typeof raw.cliente_sugerido === "object"
      ? {
          empresa: String(raw.cliente_sugerido.empresa || "").trim(),
          ref: String(raw.cliente_sugerido.ref || "").trim(),
          contato: String(raw.cliente_sugerido.contato || "").trim(),
        }
      : null,
  };
}

async function chamarGemini(images, textoExtraido) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada no Netlify.");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const parts = [{ text: PROMPT_SISTEMA }];
  if (textoExtraido) {
    parts.push({ text: `Texto extraído do PDF (legendas e rótulos):\n${textoExtraido.slice(0, 14000)}` });
  }
  for (const img of images) {
    const data = (img.dataUrl || "").replace(/^data:image\/\w+;base64,/, "");
    if (!data) continue;
    parts.push({ inline_data: { mime_type: img.mime || "image/jpeg", data } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || res.statusText;
    throw new Error(`Gemini: ${msg}`);
  }
  const texto = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return normalizarListagem(extrairJson(texto));
}

async function chamarAnthropic(images, textoExtraido) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada no Netlify.");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const content = [{ type: "text", text: PROMPT_SISTEMA }];
  if (textoExtraido) {
    content.push({ type: "text", text: `Texto extraído do PDF:\n${textoExtraido.slice(0, 14000)}` });
  }
  for (const img of images) {
    const data = (img.dataUrl || "").replace(/^data:image\/\w+;base64,/, "");
    if (!data) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mime || "image/jpeg", data },
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.15,
      messages: [{ role: "user", content }],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || res.statusText;
    throw new Error(`Claude: ${msg}`);
  }
  const texto = (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return normalizarListagem(extrairJson(texto));
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ erro: "Use POST" }) };
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const payload = JSON.parse(event.body || "{}");
    const images = Array.isArray(payload.images) ? payload.images : [];
    if (!images.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ erro: "Nenhuma página de imagem enviada." }) };
    }
    if (images.length > 14) {
      return { statusCode: 400, headers, body: JSON.stringify({ erro: "Máximo de 14 páginas por análise." }) };
    }

    const textoExtraido = payload.textoExtraido || "";
    const provider = (process.env.PLANTAS_IA_PROVIDER || "anthropic").toLowerCase();
    const listagem = provider === "anthropic"
      ? await chamarAnthropic(images, textoExtraido)
      : await chamarGemini(images, textoExtraido);

    const total = listagem.externas.length + listagem.internas.length + listagem.plantas.length;
    if (total === 0) {
      listagem.avisos.push("Nenhum item identificado — confira se o PDF contém plantas legíveis ou envie menos páginas em branco.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        provider,
        listagem,
        total,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ erro: err.message || String(err) }),
    };
  }
}
