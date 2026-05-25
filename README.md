# Flying Studio — Automação de Propostas

Automação para gerar **propostas comerciais Flying Studio** em formato Word (.docx) idênticas
ao padrão usado pela equipe.

Tem **três formas de usar**:

- **🌐 Versão web 100% no navegador** (`web/index.html`) — **NÃO precisa de Python**.
  Você abre o `index.html` direto no browser (ou hospeda no GitHub Pages) e o
  app gera o `.docx` localmente, sem servidor. Recomendado para uso do dia a dia.
- **Interface web Flask** — `python3 app.py` → abre em `http://localhost:5000`.
  Mesma UI, mas com Python rodando localmente.
- **CLI** — `python3 gerador.py exemplos/exemplo_galli.yaml` para fluxo automatizado
  com YAML.

## 🌐 Versão estática (sem Python)

A pasta `web/` contém uma aplicação 100% client-side. Para usar:

**Opção 1 — Abrir local:**
1. Baixe a pasta `web/` (basta `index.html`, `app.js`, `data.js`, `parser.js`, `orcamento.js`, `docx_gen.js` e `styles.css`).
2. Dê duplo clique em `web/index.html` — abre em qualquer navegador.
3. Descreva o projeto, clique em **Gerar proposta**, depois em **Baixar**.

**Opção 2 — Hospedar no GitHub Pages (grátis, com link público):**
1. Settings → Pages → Source: `Deploy from a branch`
2. Branch: `main` · Folder: `/web` (ou copie `web/` para a raiz)
3. Acesse `https://seuusuario.github.io/Flying-studio-proposta/`

O `.docx` é gerado direto no navegador via a biblioteca [docx](https://docx.js.org/) carregada por CDN.

A lógica de preço sempre faz **dois levantamentos lado a lado**:

1. **Planilha** — usa a tabela de preços padrão da Flying (Externas R$1.900, Internas R$1.750,
   Plantas Tipo R$1.200, Implantações R$3.000, Fachada/Voo R$3.000 etc.)
2. **Histórico do cliente** — reaplica os preços que esse mesmo cliente pagou no último projeto.
   Se o cliente costuma pagar premium (ex. BRNPAR a R$1.800/interna em vez de R$1.750), o
   levantamento já reflete isso automaticamente.

A quantidade de imagens é variável a cada projeto — você só precisa listar os ambientes.

## Estrutura

```
web/               # ⭐ Versão 100% navegador (sem Python)
  index.html       #   abra direto no browser
  app.js           #   controlador da UI
  parser.js        #   parser regex
  orcamento.js     #   cálculo dos 2 levantamentos
  docx_gen.js      #   gera .docx via docx.js
  data.js          #   tabela de preços + histórico embutidos
  styles.css       #   estilos

app.py             # Servidor web Flask com UI da IA (mesma UI, com Python)
gerador.py         # CLI (alternativa via YAML)
flying/
  ai_parser.py     # converte texto livre em estrutura (OpenAI ou regex local)
  precos.py        # tabela de preços + classificador de imagens
  historico.py     # acesso ao histórico de cada cliente
  orcamento.py     # faz os 2 levantamentos
  docx_writer.py   # gera o .docx no formato Flying Studio
templates/         # HTML da UI Flask
static/            # CSS da UI Flask
data/
  precos_planilha.json     # tabela base (você pode editar para ajustar valores)
  historico_clientes.json  # histórico extraído dos PDFs reais (5 clientes)
exemplos/          # exemplos de YAML para o CLI
saida/             # DOCX gerados pelo CLI/Flask
docs/screenshots/  # screenshots de demonstração
```

## Instalação

```bash
pip install -r requirements.txt
```

Dependências: `python-docx`, `PyYAML`, `Flask`, `openai`.

## Uso pela interface web (recomendado)

```bash
python3 app.py
# → abre em http://localhost:5000
```

Na tela inicial você cola/digita um texto descrevendo o projeto. Exemplos que o
sistema entende:

```
Cliente: HABRAS
Ref: Itaquá Japonês
A/C: Beatriz Freire
10% de desconto. Use o histórico do cliente.

Externas:
- Fachada
- Fotomontagem
- Voo de pássaro
- Portaria

Internas: Salão de Festas, Cinema, Fitness, Coworking

Plantas: Implantação Geral, Tipo A, Tipo B, Tipo C
```

Ou de forma curta:

```
HABRAS Itaquá Japonês, A/C Beatriz Freire, 10% desconto, histórico.
Externas: Fachada, Fotomontagem, Voo de pássaro, Portaria, Playground, Piscinas, Solarium, Quadra
Internas: Salão de Festas, Cinema, Fitness, Coworking, Brinquedoteca, Pet Place, Sala, Terraço
Plantas: Implantação Geral, Tipo A Garden, Tipo B, Tipo C, Tipo D
```

A página de resultado mostra os **dois levantamentos lado a lado** (planilha vs
histórico do cliente, com a estratégia escolhida em destaque) e um botão para
baixar o `.docx`.

### IA: OpenAI vs parser local

- **Sem chave de API** (default): roda um parser regex local que detecta
  cabeçalhos (`Cliente:`, `Ref:`, `A/C:`, `Externas:`, `Internas:`, `Plantas:`,
  `X% desconto`, *"use histórico"* / *"preço de planilha"* / *"preços individuais"*).
  Suficiente para uso normal — testado contra os 5 PDFs reais.
- **Com chave de API**: defina `OPENAI_API_KEY` no ambiente e o app passa o
  texto pelo `gpt-4o-mini` (configurável via `OPENAI_MODEL`) para extração mais
  flexível. O parser local continua atuando como fallback.

```bash
# opcional
export OPENAI_API_KEY="sk-..."
python3 app.py
```

## Uso pelo CLI

### 1) Comparar os 2 levantamentos sem gerar arquivo

```bash
python3 gerador.py exemplos/exemplo_galli.yaml --comparar
```

Saída:

```
📐 Cliente: GALLI  |  Ref: SAID AIACH  |  A/C: DANIEL PUCCI
📦 Imagens: 9 externas + 5 internas + 4 plantas = 18 total

=== LEVANTAMENTO 1 — PREÇO DE PLANILHA ===
  ...
  TOTAL FINAL: R$33.660,00

=== LEVANTAMENTO 2 — HISTÓRICO DO CLIENTE (GALLI) ===
  ...
  TOTAL FINAL: R$33.660,00

🔎 Diferença: planilha está R$0,00 igual ao que histórico.
```

### 2) Gerar o DOCX

```bash
# automaticamente: histórico se existir, senão planilha
python3 gerador.py exemplos/exemplo_galli.yaml

# forçar uma estratégia
python3 gerador.py exemplos/exemplo_galli.yaml --estrategia planilha
python3 gerador.py exemplos/exemplo_galli.yaml --estrategia historico

# com coluna de preço por item (estilo BRNPAR)
python3 gerador.py exemplos/exemplo_brnpar.yaml --mostrar-precos-individuais
```

O arquivo aparece em `saida/Proposta_Flying_<EMPRESA>_<REF>_<estrategia>.docx`.

## Como descrever um projeto (arquivo YAML)

Você manda apenas a **lista de imagens** que o projeto vai ter — separadas em externas,
internas e plantas. O sistema cuida do resto:

```yaml
cliente:
  empresa: GALLI
  ref: SAID AIACH
  contato: DANIEL PUCCI

desconto_pct: 12
desconto_label: "12% de Desconto de Parceria"

externas:
  - Fachada vista da calçada
  - Jardim
  - Piscina
  - Playground
  - Fachada Bird's View      # detectado como Fachada/Voo -> R$3.000

internas:
  - Bicicletário
  - Academia
  - Salão de Festas

plantas:
  - Implantação Térreo       # detectado como Implantação -> R$3.000
  - Implantação rooftop      # idem
  - Apartamento Tipo         # detectado como Tipo -> R$1.200
```

Você pode escrever o nome do ambiente como quiser — o classificador interno reconhece
palavras-chave (`fachada`, `bird's view`, `fotomontagem`, `implantação`, `térreo`,
`rooftop`, `mezanino`, `lazer`, `subsolo`, `mosca`, etc.) e aplica o preço certo.
Itens que não casam com nenhum padrão usam o preço default da categoria
(externa = R$1.900 / interna = R$1.750 / planta = R$1.200).

## Como o levantamento por histórico funciona

1. Procura o cliente em `data/historico_clientes.json`.
2. Pega a proposta mais recente desse cliente.
3. Para cada imagem que você listou no projeto novo, tenta:
   - **Match exato** pelo nome — se o cliente já tinha "Perspectiva Fachada", reusa o preço.
   - **Match parcial** — substring/contém. Ex: você escreve "Fachada" e o cliente tinha
     "Perspectiva Fachada Bird's View" → reusa.
   - **Média da categoria** — se nada bater, usa a média de externas/internas/plantas
     do último projeto desse cliente.
   - **Fallback de planilha** — se não houver histórico nessa categoria.

Cada item no console mostra a fonte (`historico:CLIENTE:item_exato`,
`historico:CLIENTE:item_similar`, `historico:CLIENTE:media_categoria`,
`fallback_planilha:...`), então você sabe de onde veio cada preço.

## Histórico atual (extraído dos 5 PDFs)

| Cliente   | Ref                | Externas (média) | Internas | Plantas | Total bruto | Desc. |
|-----------|--------------------|------------------|----------|---------|-------------|-------|
| GALLI     | Said Aiach         | R$2.144 (9 imgs) | R$1.750  | R$2.550 | R$38.250    | 12%   |
| CASA VIVA | Prestes Maia       | R$1.975 (8 imgs) | R$1.750  | R$1.660 | R$38.100    | 22%   |
| HABRAS    | Itaquá Japonês     | R$2.312 (8 imgs) | R$1.750  | R$1.425 | R$50.900    | 10%   |
| BRNPAR    | NC Avaré           | R$2.600 (5 imgs) | R$1.800  | R$1.800 | R$29.200    | 8%    |
| OXE       | Jd. São Paulo      | (anexo III — só tecnologias / tour virtual)                  |

> BRNPAR é o único cliente que normalmente **paga "premium"** em relação à planilha
> (Internas R$1.800 vs R$1.750 da planilha; Externa comum R$2.000 vs R$1.900). O
> levantamento de histórico já reflete esse padrão automaticamente.

## Adicionando um cliente novo ao histórico

Quando você fechar uma proposta nova, edite `data/historico_clientes.json` adicionando
uma entrada em `clientes.<EMPRESA>.propostas` com:

```json
{
  "ref": "...",
  "data": "2026-06-01",
  "desconto_pct": 10,
  "forma_pagamento": [...],
  "prazos": {...},
  "externas": {"qtd": 8, "total": 17000, "itens": [{"desc": "Perspectiva ...", "preco": 1900}, ...]},
  "internas": {...},
  "plantas":  {...}
}
```

A próxima proposta para esse cliente já vai usar essa base.

## Ajustando preços de planilha

Edite `data/precos_planilha.json`. Cada categoria tem:
- `_default`: preço padrão.
- `tabela`: regras especiais (regex em `padroes`) que casam variantes específicas.

## Limitações atuais (próximas iterações)

- **Filmes / tour virtual / drone** estão na planilha mas não são gerados automaticamente
  na proposta (aparecem em `data/precos_planilha.json` para consulta). Hoje o foco é
  **externas + internas + plantas**, conforme combinado.
- A redação dos itens é prefixada de forma genérica ("Perspectiva " + nome). Para
  variações de daypart (Diurna/Entardecer) você passa direto no YAML e o texto vai
  intacto: ex. `- Fachada (Entardecer)` → `Perspectiva Fachada (Entardecer)`.
- Datas em "São Paulo, X de mês de YYYY" usam a data do dia. Para travar uma data
  específica, coloque `data: 2026-05-19` no YAML.
