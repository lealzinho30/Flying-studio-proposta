"""Converte descrição livre em estrutura de proposta.

Estratégia:
  1) Se houver OPENAI_API_KEY, manda pro modelo com instrução estruturada e
     valida o JSON de volta.
  2) Sempre roda o parser local em paralelo (regex). Em caso de falha do LLM,
     ou no modo offline, ele entrega o resultado.

Saída comum (dict):
{
  "cliente": {"empresa": str, "ref": str, "contato": str},
  "externas": [str, ...],
  "internas": [str, ...],
  "plantas":  [str, ...],
  "desconto_pct": float,
  "desconto_label": str | None,
  "estrategia": "auto" | "planilha" | "historico",
  "data": "YYYY-MM-DD" | None,
  "mostrar_precos_individuais": bool,
  "extras": [...] | None,
  "_origem": "openai" | "local",
  "_avisos": [str, ...]
}
"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Any

# Cabeçalhos das listas que reconhecemos no texto livre
SECOES_CABEC = {
    "externas": [
        r"externas?",
        r"ilustra(?:c|ç)(?:o|õ)es externas",
        r"perspectivas externas",
        r"imagens externas",
        r"\bext\b",
    ],
    "internas": [
        r"internas?",
        r"ilustra(?:c|ç)(?:o|õ)es internas",
        r"perspectivas internas",
        r"imagens internas",
        r"\bint\b",
    ],
    "plantas": [
        r"plantas?",
        r"plantas? humanizadas?",
        r"plantas? baixas?",
        r"implanta(?:c|ç)(?:o|õ)es?",
    ],
    "tour_virtual": [
        r"tour virtual",
        r"visita virtual( web)?",
        r"vr 360",
        r"panoramas? 360",
    ],
    "filmes": [
        r"filmes?",
        r"v[ií]deos?",
        r"anima[cç][oõ]es?",
    ],
    "apps": [
        r"apps?",
        r"aplica[cç][oõ]es?",
        r"aplicativos?",
        r"experi[eê]ncias? digitais",
        r"tela touch",
        r"stand digital",
        r"estande digital",
    ],
    "drone": [
        r"drones?",
        r"fotografia a[eé]rea",
        r"voo de drone",
    ],
    "extras": [
        r"extras?",
        r"outros",
        r"adicionais?",
        r"tecnologias?",
        r"servi[cç]os? extras?",
    ],
}

# --- helpers de normalização ---


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def _limpa_item(s: str) -> str:
    s = s.strip().strip(".;,")
    s = re.sub(r"^[\-\*\u2022\u2013\u2014\d\.\)]+\s*", "", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


# --- parser local (não depende de API) ---


# Aceita tanto "Cliente: X" quanto "cliente X, ref Y" (separadores são quebra OU vírgula).
_RE_CLIENTE = re.compile(r"(?:^|\n|[,;.])\s*(?:cliente|empresa)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:ref|projeto|empreendimento|a/?c|contato|aos\s+cuidados))", re.I)
_RE_REF = re.compile(r"(?:^|\n|[,;.\-–—])\s*(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|a/?c|contato|aos\s+cuidados|\d+\s*%))", re.I)
_RE_CONTATO = re.compile(r"(?:^|\n|[,;.])\s*(?:a/?c|contato|aos\s+cuidados\s+de?)\s*[:\-\.]?\s+([^\n,;.]+?)(?=$|\n|[,;]|\.\s|\s+(?:cliente|empresa|ref|projeto|empreendimento|\d+\s*%))", re.I)
_RE_DESCONTO = re.compile(r"(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s*)?(?:desconto|desc\.?|off)", re.I)
_RE_DESCONTO_2 = re.compile(r"desconto\s*(?:de|:)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%", re.I)
_RE_ESTRATEGIA_PLAN = re.compile(r"\b(?:planilha|tabela\s*padr[aã]o|pre[cç]o\s*de\s*planilha|pre[cç]o\s*padr[aã]o)\b", re.I)
_RE_ESTRATEGIA_HIST = re.compile(r"\bhist[oó]ric|cliente\s*(?:antigo|anterior|recorrente)|m[eé]dia\s*do\s*cliente|mesma?\s*base\b", re.I)
_RE_PRECOS_IND = re.compile(r"pre[cç]os?\s*(?:individuais?|por\s*item|por\s*imagem)|coluna\s*de\s*pre[cç]o|estilo\s*brnpar", re.I)


def _split_secoes(texto: str) -> dict[str, str]:
    """Quebra o texto em blocos por categoria (externas/internas/plantas/outras).

    Detecta cabeçalhos como 'Externas:' / 'Internas:' / 'Plantas:' em qualquer
    lugar e usa a próxima ocorrência como fim do bloco.
    """
    matches: list[tuple[int, str, re.Match]] = []
    for cat, padroes in SECOES_CABEC.items():
        for pad in padroes:
            for m in re.finditer(rf"(?:^|\n|[\.;])\s*({pad})\s*[:\-]", texto, re.I):
                matches.append((m.start(), cat, m))
                break

    if not matches:
        return {}

    matches.sort(key=lambda x: x[0])
    blocos: dict[str, str] = {}
    for i, (start, cat, m) in enumerate(matches):
        end = matches[i + 1][0] if i + 1 < len(matches) else len(texto)
        bloco_txt = texto[m.end():end].strip()
        blocos[cat] = bloco_txt
    return blocos


def _extrai_lista(bloco: str) -> list[str]:
    """Pega itens de um bloco. Aceita separação por nova linha, vírgula ou ';'."""
    if not bloco:
        return []
    # primeiro tenta por nova linha (caso clássico de bullet list)
    linhas = [l for l in bloco.splitlines() if l.strip()]
    if len(linhas) >= 2:
        return [_limpa_item(l) for l in linhas if _limpa_item(l)]
    # senão, separa por vírgula ou ';'
    partes = re.split(r"[;,]| e ", bloco)
    return [_limpa_item(p) for p in partes if _limpa_item(p)]


def parse_local(texto: str) -> dict[str, Any]:
    avisos: list[str] = []

    cliente_match = _RE_CLIENTE.search(texto)
    ref_match = _RE_REF.search(texto)
    contato_match = _RE_CONTATO.search(texto)

    cliente = (cliente_match.group(1).strip() if cliente_match else "").rstrip(".;,")
    ref = (ref_match.group(1).strip() if ref_match else "").rstrip(".;,")
    contato = (contato_match.group(1).strip() if contato_match else "").rstrip(".;,")

    if not cliente:
        primeira = texto.strip().split("\n", 1)[0].strip()
        # Pega o token CAPS no começo (1+ palavras em CAPS, paradas em qualquer minúscula).
        m_caps = re.match(
            r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9](?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 &]*[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])?)\b",
            primeira,
        )
        if m_caps and len(m_caps.group(1)) >= 3:
            cliente = m_caps.group(1).strip()
            avisos.append(f"Cliente não foi marcado explicitamente — assumi '{cliente}' (1as palavras em CAPS).")
            # Tenta capturar a 'ref' que vem logo depois do nome
            if not ref:
                resto = primeira[m_caps.end():].strip(" -–—:,.")
                resto = re.sub(r"^(?:ref(?:er[eê]ncia)?|projeto|empreendimento)\s*[:\-]?\s*", "", resto, flags=re.I)
                resto = re.sub(r"\b(?:a/?c|contato|aos\s+cuidados\s+de?)\b.*$", "", resto, flags=re.I).strip(" ,.")
                resto = re.sub(r",\s*\d+\s*%.*$", "", resto)
                if 2 <= len(resto) <= 60:
                    ref = resto
        else:
            # Tenta achar token em CAPS (3+ letras maiúsculas) em qualquer lugar
            m_any_caps = re.search(r"\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+)?)\b", texto)
            if m_any_caps and m_any_caps.group(1) not in {"EXTERNAS", "INTERNAS", "PLANTAS", "REF", "PROJETO", "CLIENTE", "EMPRESA", "DESCONTO", "HISTORICO", "HISTÓRICO", "PLANILHA", "TÉRREO"}:
                cliente = m_any_caps.group(1).strip()
                avisos.append(f"Cliente não foi marcado explicitamente — assumi '{cliente}' (palavra em CAPS no texto).")
            elif primeira and len(primeira) < 60:
                cliente = primeira
                avisos.append(f"Cliente não foi marcado explicitamente — assumi '{cliente}' (1ª linha).")

    desconto_pct = 0.0
    m = _RE_DESCONTO.search(texto) or _RE_DESCONTO_2.search(texto)
    if m:
        desconto_pct = float(m.group(1).replace(",", "."))

    estrategia = "auto"
    if _RE_ESTRATEGIA_PLAN.search(texto):
        estrategia = "planilha"
    elif _RE_ESTRATEGIA_HIST.search(texto):
        estrategia = "historico"

    mostrar_precos_individuais = bool(_RE_PRECOS_IND.search(texto))

    blocos = _split_secoes(texto)
    externas = _extrai_lista(blocos.get("externas", ""))
    internas = _extrai_lista(blocos.get("internas", ""))
    plantas = _extrai_lista(blocos.get("plantas", ""))
    tour_virtual = _extrai_lista(blocos.get("tour_virtual", ""))
    filmes = _extrai_lista(blocos.get("filmes", ""))
    apps = _extrai_lista(blocos.get("apps", ""))
    drone = _extrai_lista(blocos.get("drone", ""))
    extras_diversos = _extrai_lista(blocos.get("extras", ""))

    extras_detectados = _detectar_extras_soltos(texto, jaMencionados={
        "tour_virtual": tour_virtual, "filmes": filmes, "apps": apps,
        "drone": drone, "extras_diversos": extras_diversos,
    })

    if not (externas or internas or plantas or tour_virtual or filmes or apps or drone or extras_diversos or extras_detectados):
        avisos.append("Não consegui identificar nenhuma seção (Externas/Internas/Plantas/Tour Virtual/Filmes/Apps). "
                      "Use cabeçalhos tipo 'Externas:' seguidos de uma lista.")

    return {
        "cliente": {
            "empresa": cliente or "CLIENTE",
            "ref": ref or "PROJETO",
            "contato": contato or "—",
        },
        "externas": externas,
        "internas": internas,
        "plantas":  plantas,
        "tour_virtual": tour_virtual,
        "filmes": filmes,
        "apps": apps,
        "drone": drone,
        "extras_diversos": extras_diversos,
        "extras_detectados": extras_detectados,
        "desconto_pct": desconto_pct,
        "desconto_label": None,
        "estrategia": estrategia,
        "data": None,
        "mostrar_precos_individuais": mostrar_precos_individuais,
        "extras": None,
        "_origem": "local",
        "_avisos": avisos,
    }


def _detectar_extras_soltos(texto: str, jaMencionados: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Vasculha o texto inteiro buscando menções a tour virtual / filmes / apps / etc
    que não estejam dentro de uma seção explícita."""
    import json
    from pathlib import Path

    PRECOS_PATH = Path(__file__).resolve().parent.parent / "data" / "precos_planilha.json"
    try:
        with open(PRECOS_PATH, encoding="utf-8") as f:
            precos = json.load(f)
    except Exception:
        return []

    alvo = _norm(texto)
    det: list[dict[str, Any]] = []

    def _ja_tem(lista, item_norm):
        return any(item_norm in _norm(x) or _norm(x) in item_norm for x in (lista or []))

    # Tour virtual
    for amb in (precos.get("tour_virtual", {}).get("ambientes") or []):
        if amb["chave"] == "outro":
            continue
        for pad in amb.get("padroes", []):
            if re.search(pad, alvo):
                if not _ja_tem(jaMencionados.get("tour_virtual"), _norm(amb["rotulo"])):
                    if not any(d["tipo"] == "tour_virtual" and d["chave"] == amb["chave"] for d in det):
                        det.append({"tipo": "tour_virtual", "chave": amb["chave"], "rotulo": amb["rotulo"], "preco": amb["preco"]})
                break

    # Filmes
    for f in (precos.get("filmes", {}).get("catalogo") or []):
        for pad in f.get("padroes", []):
            if re.search(pad, alvo):
                if not _ja_tem(jaMencionados.get("filmes"), _norm(f["rotulo"])):
                    if not any(d["tipo"] == "filme" and d["chave"] == f["chave"] for d in det):
                        det.append({"tipo": "filme", "chave": f["chave"], "rotulo": f["rotulo"], "preco": f["preco"]})
                break

    # Apps
    for a in (precos.get("apps", {}).get("catalogo") or []):
        for pad in a.get("padroes", []):
            if re.search(pad, alvo):
                if not _ja_tem(jaMencionados.get("apps"), _norm(a["rotulo"])):
                    if not any(d["tipo"] == "app" and d["chave"] == a["chave"] for d in det):
                        det.append({"tipo": "app", "chave": a["chave"], "rotulo": a["rotulo"], "preco": a["preco"]})
                break

    # Maquete eletrônica
    mq = precos.get("maquete_eletronica")
    if mq:
        for pad in mq.get("padroes", []):
            if re.search(pad, alvo):
                det.append({"tipo": "maquete", "chave": mq["chave"], "rotulo": mq["rotulo"], "preco": mq["preco"]})
                break

    # Estudo de fachada
    ef = precos.get("estudo_fachada")
    if ef:
        for pad in ef.get("padroes", []):
            if re.search(pad, alvo):
                if re.search(r"estudo.*fachada|estudo cromatic|cromatic.*fachada", texto, re.I):
                    det.append({"tipo": "estudo_fachada", "chave": ef["chave"], "rotulo": ef["rotulo"], "preco": ef["preco"]})
                    break

    # Drone
    for d in (precos.get("drone", {}).get("catalogo") or []):
        for pad in d.get("padroes", []):
            if re.search(pad, alvo):
                if not any(x["tipo"] == "drone" and x["chave"] == d["chave"] for x in det):
                    det.append({"tipo": "drone", "chave": d["chave"], "rotulo": d["rotulo"], "preco": d["preco"]})
                break

    return det


# --- camada OpenAI (opcional) ---


SYSTEM_PROMPT = """Você é um assistente que converte descrições livres em português de
propostas comerciais da Flying Studio em JSON estruturado. Devolva APENAS JSON válido,
sem markdown, sem texto extra.

Schema:
{
  "cliente": {"empresa": "...", "ref": "...", "contato": "..."},
  "externas": ["nome do ambiente", ...],
  "internas": ["nome do ambiente", ...],
  "plantas":  ["nome", ...],
  "desconto_pct": 0,
  "desconto_label": null,
  "estrategia": "auto" | "planilha" | "historico",
  "data": null,
  "mostrar_precos_individuais": false,
  "extras": null
}

Regras importantes:
- Se o usuário mencionou explicitamente "preço de planilha" ou "tabela padrão",
  estrategia = "planilha".
- Se mencionou "histórico do cliente" ou "preço médio do cliente" ou "mesma base
  do projeto anterior", estrategia = "historico".
- Caso contrário estrategia = "auto".
- Para imagens, mantenha o nome curto do ambiente (ex.: "Fachada", "Lobby", "Implantação Térreo").
  NÃO prefixe com "Perspectiva" — o gerador faz isso.
- Se o usuário disser "10% de desconto", desconto_pct = 10.
- Se mencionar "preços individuais por imagem" ou "coluna de valor", mostrar_precos_individuais = true.
"""


def parse_openai(texto: str) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    try:
        client = OpenAI(api_key=api_key)
        modelo = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        resp = client.chat.completions.create(
            model=modelo,
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": texto},
            ],
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        return {"_erro": f"OpenAI falhou: {exc}", "_origem": "openai-falhou"}

    data["_origem"] = "openai"
    data.setdefault("_avisos", [])
    data.setdefault("extras", None)
    data.setdefault("data", None)
    data.setdefault("desconto_label", None)
    data.setdefault("mostrar_precos_individuais", False)
    data.setdefault("estrategia", "auto")
    cli = data.setdefault("cliente", {})
    cli.setdefault("empresa", "CLIENTE")
    cli.setdefault("ref", "PROJETO")
    cli.setdefault("contato", "—")
    for k in ("externas", "internas", "plantas"):
        data.setdefault(k, [])
    data.setdefault("desconto_pct", 0)
    return data


# --- entrada pública ---


def parse(texto: str) -> dict[str, Any]:
    """Tenta OpenAI; se não der, usa parser local. Sempre devolve dict válido."""
    texto = (texto or "").strip()
    if not texto:
        out = parse_local("")
        out["_avisos"].insert(0, "Texto vazio.")
        return out

    aviso_falha = None
    res_ai = parse_openai(texto)
    if res_ai is not None and "_erro" not in res_ai:
        # Ainda roda o parser local para preencher campos eventualmente faltantes
        local = parse_local(texto)
        if not res_ai.get("externas") and local["externas"]:
            res_ai["externas"] = local["externas"]
        if not res_ai.get("internas") and local["internas"]:
            res_ai["internas"] = local["internas"]
        if not res_ai.get("plantas") and local["plantas"]:
            res_ai["plantas"] = local["plantas"]
        return res_ai
    if res_ai is not None and "_erro" in res_ai:
        aviso_falha = res_ai["_erro"]

    out = parse_local(texto)
    if aviso_falha:
        out["_avisos"].insert(0, f"OpenAI indisponível, usando parser local. ({aviso_falha})")
    return out
