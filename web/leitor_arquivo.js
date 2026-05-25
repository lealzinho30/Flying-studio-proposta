// leitor_arquivo.js — extrai texto de PDF, DOCX, XLSX, TXT, CSV no navegador.
//
// API:
//   window.FlyingFileReader.lerArquivo(file) -> { texto, formato, linhas, aviso }
//
// Estratégia:
//   - .txt / .csv  → readAsText()
//   - .docx        → mammoth.js (extrai texto cru)
//   - .xlsx / .xls → SheetJS (concatena todas as planilhas)
//   - .pdf         → pdf.js (concatena texto de todas as páginas)

(function () {
  "use strict";

  function ext(file) {
    const m = (file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file, "utf-8");
    });
  }
  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(file);
    });
  }

  async function lerPDF(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js não carregou");
    const buf = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const partes = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const texto = content.items.map((it) => it.str).join(" ");
      partes.push(texto);
    }
    return partes.join("\n");
  }

  async function lerDOCX(file) {
    if (!window.mammoth) throw new Error("mammoth.js não carregou");
    const buf = await readAsArrayBuffer(file);
    const out = await mammoth.extractRawText({ arrayBuffer: buf });
    return out.value || "";
  }

  async function lerXLSX(file) {
    if (!window.XLSX) throw new Error("SheetJS não carregou");
    const buf = await readAsArrayBuffer(file);
    const wb = XLSX.read(buf, { type: "array" });
    const partes = [];
    for (const nome of wb.SheetNames) {
      const ws = wb.Sheets[nome];
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: "; " });
      partes.push(`# ${nome}\n${csv}`);
    }
    return partes.join("\n\n");
  }

  // Tenta categorizar automaticamente um texto cru (lista bruta sem cabeçalhos).
  // Aplica heurística por palavras-chave para separar em externas/internas/plantas.
  function categorizarAutomatico(texto) {
    const linhas = texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l.length < 80 && !/^[\s\-_=]+$/.test(l));

    const KW_EXT = ["fachada", "portaria", "playground", "piscina", "quadra", "jardim", "rooftop", "voo", "drone", "fotomontagem", "churrasqueira", "horta", "redário", "fitness externo", "petplace", "pet place", "solarium", "mirante", "deck", "spa externo", "jacuzzi", "gourmet"];
    const KW_INT = ["lobby", "salão de festas", "salão de jogos", "academia", "fitness", "cinema", "lavanderia", "coworking", "brinquedoteca", "cozinha", "sauna", "sala", "quarto", "banho", "banheiro", "living", "espaço pet", "pet (di", "espaço beauty", "beauty", "maleiro", "mini market", "camarote", "espaço zen", "lazer coberto", "terraço", "bicicletário"];
    const KW_PLT = ["planta", "implantação", "implantacao", "tipo a", "tipo b", "tipo c", "tipo d", "garden", "duplex", "cobertura", "subsolo", "mosca", "pavimento"];

    function classify(linha) {
      const n = linha.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (KW_PLT.some((k) => n.includes(k))) return "plantas";
      if (KW_EXT.some((k) => n.includes(k))) return "externas";
      if (KW_INT.some((k) => n.includes(k))) return "internas";
      return null;
    }

    const grupos = { externas: [], internas: [], plantas: [], desconhecidos: [] };
    for (const l of linhas) {
      const cat = classify(l);
      if (cat) grupos[cat].push(l);
      else grupos.desconhecidos.push(l);
    }

    if (!grupos.externas.length && !grupos.internas.length && !grupos.plantas.length) return null;

    let saida = "";
    if (grupos.externas.length) saida += `Externas:\n${grupos.externas.map((x) => "- " + x).join("\n")}\n\n`;
    if (grupos.internas.length) saida += `Internas:\n${grupos.internas.map((x) => "- " + x).join("\n")}\n\n`;
    if (grupos.plantas.length) saida += `Plantas:\n${grupos.plantas.map((x) => "- " + x).join("\n")}\n\n`;
    if (grupos.desconhecidos.length) saida += `# Itens não categorizados (revise abaixo):\n${grupos.desconhecidos.map((x) => "- " + x).join("\n")}\n`;
    return saida.trim();
  }

  async function lerArquivo(file) {
    const formato = ext(file);
    let texto = "";
    let aviso = null;
    try {
      if (formato === "txt" || formato === "csv") texto = await readAsText(file);
      else if (formato === "docx") texto = await lerDOCX(file);
      else if (formato === "doc") {
        aviso = "Formato .doc antigo — recomendamos salvar como .docx ou copiar/colar o texto.";
        try { texto = await readAsText(file); } catch (_) { texto = ""; }
      }
      else if (formato === "xlsx" || formato === "xls") texto = await lerXLSX(file);
      else if (formato === "pdf") texto = await lerPDF(file);
      else { aviso = `Formato .${formato} não suportado — copie e cole o texto.`; texto = ""; }
    } catch (e) {
      return { texto: "", formato, linhas: 0, aviso: `Erro ao ler ${file.name}: ${e.message}` };
    }

    const limpo = (texto || "").replace(/\r/g, "").trim();
    const linhas = limpo ? limpo.split("\n").filter((l) => l.trim()).length : 0;

    // Tenta categorizar automaticamente se o texto não tem cabeçalhos
    const temCabec = /\b(externas?|internas?|plantas?|implanta|cliente|ref)\b\s*[:\-]/i.test(limpo);
    let textoFinal = limpo;
    if (!temCabec) {
      const cat = categorizarAutomatico(limpo);
      if (cat) {
        textoFinal = cat;
        aviso = (aviso ? aviso + " " : "") + "Itens categorizados automaticamente — confira antes de gerar.";
      }
    }

    return { texto: textoFinal, formato, linhas, aviso };
  }

  window.FlyingFileReader = { lerArquivo };
})();
