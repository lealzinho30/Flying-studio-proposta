#!/usr/bin/env node
/** Testes do parser de PDF/histórico (forma de pagamento + preço médio). */
"use strict";

const fs = require("fs");
const path = require("path");

global.window = {
  FlyingParser: {
    norm: (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
  },
  FLYING_PRECOS: {
    forma_pagamento_padrao: [
      { percentual: 50, marco: "Na aprovação desta Proposta" },
      { percentual: 25, marco: "Envio dos Shades" },
      { percentual: 25, marco: "Envio HR - Imagens finais" },
    ],
  },
};

const src = fs.readFileSync(path.join(__dirname, "../web/leitor_historico_pdf.js"), "utf8");
eval(src);

const hp = global.window.FlyingHistoricoPdf;
let ok = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    ok++;
    console.log("  ✓", msg);
  } else {
    fail++;
    console.error("  ✗", msg);
  }
}

const textoPagamento = `
Cliente: INTEGRA
Ref: Voluntarios da Patria

FORMA DE PAGAMENTO:
05% Pagos na assinatura do contrato
20% RO1 - Primeiro pacote de imagens
25% RO2 - Segundo pacote
50% Entrega final HR

Preço médio por imagem: R$ 1.900,00

ILUSTRAÇÕES EXTERNAS
1 Perspectiva Fachada R$ 3.000,00
2 Perspectiva Jardim R$ 1.900,00
Valor final do projeto R$ 45.000,00
`;

const p1 = hp.parseTexto(textoPagamento, { nomeArquivo: "Orc_Integra_Voluntarios.pdf" });
assert(p1 && p1.forma_pagamento && p1.forma_pagamento.length >= 3, "extrai parcelas do bloco FORMA DE PAGAMENTO");
assert(
  p1.forma_pagamento.some((x) => /assinatura|RO1/i.test(x.marco)),
  "marcos de pagamento legíveis"
);
assert(p1._resumo && p1._resumo.media_geral === 1900, "preço médio explícito R$ 1.900");
assert(p1.empresa_pdf === "INTEGRA" || p1.ref, "metadados cliente/ref");

const textoCorrido =
  "Forma de Pagamento 10% Pagos aceite 30% Envio Shades 30% RO1 30% Entrega HR Perspectiva R$ 2.500,00 Lobby R$ 1.750,00";
const p2 = hp.parseTexto(textoCorrido, { nomeArquivo: "orc_teste.pdf" });
assert(p2 && p2.forma_pagamento.length >= 3, "pagamento em linha corrida");
assert(p2._resumo && p2._resumo.media_geral > 0, "média a partir de preços soltos");

const html = hp.resumoHtml(p1, { html: true });
assert(/preço médio/i.test(html), "resumoHtml menciona preço médio");
assert(/Forma de pagamento/i.test(html), "resumoHtml lista forma de pagamento");

console.log(`\n${ok} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
