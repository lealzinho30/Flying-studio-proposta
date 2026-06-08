#!/usr/bin/env node
/**
 * Testes de regressão do parser local (sem navegador).
 * Uso: node scripts/test-parser-casos.js
 */
"use strict";

global.window = global;
require("../web/parser.js");

const FP = global.FlyingParser;

function merge(base, texto) {
  const novo = FP.parseConversacional(texto);
  return FP.mesclarBriefing(base, novo);
}

function baseIntegra() {
  return FP.parseConversacional(
    "Cliente: INTEGRA\nRef: VOLUNTARIOS DA PATRIA\nA/C: FERNANDA LIMA"
  );
}

const casos = [
  {
    nome: "escopo perspectiva brinquedoteca",
    run() {
      const m = merge(baseIntegra(), "apenas uma perspectiva da brinquedoteca");
      return (
        m.cliente.empresa === "INTEGRA" &&
        m.internas.some((x) => /brinquedoteca/i.test(x))
      );
    },
  },
  {
    nome: "3 imagens lista",
    run() {
      const m = merge(baseIntegra(), "3 imagens internas: suite, gourmet, lobby");
      return m.cliente.empresa === "INTEGRA" && m.internas.length === 3;
    },
  },
  {
    nome: "projeto= não troca empresa",
    run() {
      const m = merge(baseIntegra(), "projeto = Voluntarios da Patria A/C = Raquel Chiara");
      return m.cliente.empresa === "INTEGRA" && /voluntarios/i.test(m.cliente.ref);
    },
  },
  {
    nome: "empresa integra corrida",
    run() {
      const p = FP.parseConversacional("Integra voluntarios da patria raquel chiara");
      return p.cliente.empresa === "INTEGRA" && p.cliente.contato === "Raquel Chiara";
    },
  },
  {
    nome: "estruturado externas internas",
    run() {
      const p = FP.parseConversacional(`Cliente: TARRAF
Ref: Vila Mariana
Externas:
- Fachada
Internas:
- Lobby`);
      return p.cliente.empresa === "TARRAF" && p.externas.length && p.internas.length;
    },
  },
  {
    nome: "proposta adicional valor",
    run() {
      const p = FP.parseConversacional(
        "proposta que contempla 1 perspectiva brinquedoteca pelo valor de 1.650"
      );
      return p.preco_unitario_contrato === 1650 && p.internas.length === 1;
    },
  },
  {
    nome: "remover escopo",
    run() {
      let b = baseIntegra();
      b = merge(b, "internas: suite, gourmet, lobby");
      b.internas = ["Suite", "Gourmet", "Lobby"];
      const m = merge(b, "tirar gourmet");
      return m.internas.length === 2 && !m.internas.some((x) => /gourmet/i.test(x));
    },
  },
  {
    nome: "desconto parcela ignorado",
    run() {
      const p = FP.parseConversacional("50% na entrega 50% no aceite");
      return p.desconto_pct === 0;
    },
  },
  {
    nome: "desconto explicito",
    run() {
      const p = FP.parseConversacional("cliente X projeto Y 10% de desconto");
      return p._desconto_explicito && p.desconto_pct === 10;
    },
  },
  {
    nome: "lista por linhas",
    run() {
      const m = merge(
        baseIntegra(),
        "internas:\n- Suite\n- Gourmet\n- Lobby"
      );
      return m.internas.length >= 3;
    },
  },
  {
    nome: "briefing corrido avita perspectivas",
    run() {
      const p = FP.parseConversacional(
        "avita francisto polito thiago perspectiva de fachada A Perspectiva de facha B Perspectiva fotomantagem perspectiva living perspe brinquedoteca"
      );
      return (
        p.cliente.empresa === "AVITA" &&
        /francisco\s+polito/i.test(p.cliente.ref) &&
        p.cliente.contato === "Thiago" &&
        p.externas.length >= 2 &&
        p.internas.length >= 2 &&
        !p._somente_escopo
      );
    },
  },
  {
    nome: "lista perspectivas sem quantidade",
    run() {
      const p = FP.parseConversacional(
        "perspectiva de portaria perspectiva de playground perspectiva academia"
      );
      return p.externas.length >= 2 && p.internas.length >= 1;
    },
  },
];

let ok = 0;
let fail = 0;
for (const c of casos) {
  try {
    if (c.run()) {
      console.log("✓", c.nome);
      ok += 1;
    } else {
      console.log("✗", c.nome);
      fail += 1;
    }
  } catch (e) {
    console.log("✗", c.nome, "-", e.message);
    fail += 1;
  }
}
console.log(`\n${ok} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
