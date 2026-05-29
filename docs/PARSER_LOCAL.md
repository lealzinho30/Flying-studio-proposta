# Proposta inteligente — modo local (sem API paga)

O site está configurado para **não depender de IA paga** (`FLYING_MODO_LOCAL = true` no `index.html`). Toda a inteligência do chat vem do **parser em JavaScript** + **leitura do PDF de orçamento**.

## Fluxo recomendado

### Passo 1 — Cliente e projeto (uma vez)

Use qualquer formato abaixo (ou envie o PDF `Orc_Cliente_Projeto_….pdf`):

```
Cliente: INTEGRA
Ref: Voluntários da Pátria
A/C: Fernanda Lima
```

```
empresa - integra projeto voluntarios da patria ac/ raquel chiara
```

```
Integra voluntarios da patria raquel chiara
```

### Passo 2 — Escopo (imagens)

Frases sobre **imagens, perspectivas, plantas ou ambientes** **não alteram** o cliente — só o escopo:

| Você escreve | O sistema entende |
|--------------|-------------------|
| `apenas uma perspectiva da brinquedoteca` | 1 interna: Brinquedoteca |
| `3 imagens internas: suite, gourmet, lobby` | 3 internas listadas |
| `mais imagens da academia e spa` | Academia + Spa |
| `escopo: fachada, portaria, lobby` | lista de ambientes |
| `10 perspectivas internas a definir` | 10 itens “A definir” |

### Passo 3 — Texto estruturado (propostas complexas)

Cole ou importe com cabeçalhos:

```
Cliente: TARRAF
Ref: Vila Mariana
A/C: Larissa

Externas:
- Fachada principal
- Área de lazer

Internas:
- Suíte decorada
- Lobby

Plantas:
- Implantação térreo
- Tipo A

Tour Virtual:
- Áreas de lazer

Filmes:
- Filme produto 1:30
```

### Ajustes e correções

| Intenção | Exemplo |
|----------|---------|
| Só projeto / A/C | `projeto = Voluntários da Pátria` · `A/C = Raquel Chiara` |
| Nome da cliente (pessoa) | `Raquel Chiara é o nome da cliente` → atualiza **A/C** |
| Remover item | `tirar brinquedoteca` · `remover suite` |
| Desconto | `10% de desconto` (só aplica se pedir) |
| Sem desconto | `não pedi 12%` · `sem desconto` |
| Proposta adicional | `1 perspectiva brinquedoteca pelo valor de 1.650` |
| Preço do contrato | `mesmo valor do contrato` + PDF no histórico |

## O que é ignorado (de propósito)

- Parcelas de pagamento (`50% sinal`, `20% na entrega`) — **não** viram desconto
- Valores em R$ no texto — use histórico PDF ou digite preço unitário na proposta adicional
- Forma de pagamento completa — não entra no briefing de imagens

## PDF do último orçamento

Arquivo tipo `Orc_Integra_Voluntarios_da_Patria_….pdf`:

- Cliente e projeto vêm do **nome do arquivo** e do texto do PDF
- Preços vêm do PDF para estratégia **Histórico**
- Texto lixo do corpo do PDF é filtrado

## Ativar IA de novo (opcional)

No `index.html`, altere para `window.FLYING_MODO_LOCAL = false;` e configure chaves no Netlify (`docs/CHAT_IA.md`).

## Testes do parser

Na raiz do repositório:

```bash
node scripts/test-parser-casos.js
```
