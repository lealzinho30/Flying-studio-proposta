# Flying Studio Propostas

Automacao inicial para montar propostas de imagens da Flying Studio a partir de
uma lista simples de itens. O foco desta primeira versao esta em:

- ilustracoes externas;
- ilustracoes internas;
- plantas humanizadas / plantas baixas.

A ferramenta gera dois arquivos revisaveis:

- `.md`, para conferir rapidamente o texto e os calculos;
- `.docx`, para abrir no Word/LibreOffice e finalizar a proposta.

## Como funciona

Voce informa cliente, referencia, A/C, desconto e a lista de imagens em um JSON.
A automacao escreve os itens no mesmo estilo dos PDFs analisados:

```text
2.1 ILUSTRACOES EXTERNAS
2.1.1 Perspectiva Fachada
2.1.2 Perspectiva Piscina
...
8 Valor Total R$...
```

Depois calcula os totais por grupo, subtotal, desconto e investimento final.

## Estrategias de preco

Existem dois levantamentos possiveis:

1. `planilha`: usa a tabela padrao de custos.
2. `cliente`: usa o preco medio do ultimo projeto conhecido do mesmo cliente.
   Se nao houver historico, usa a planilha como fallback.

Use `comparar_precos: true` no JSON, ou `--comparar` na CLI, para incluir os
dois levantamentos na proposta.

### Precos da planilha usados nesta versao

| Tipo | Valor |
| --- | ---: |
| Fotomontagem com FotoDrone por conta da Flying | R$4.500,00 |
| Fachada / Fotomontagem / Voo | R$3.000,00 |
| Externa diversa | R$1.900,00 |
| Interna diversa | R$1.750,00 |
| Planta de pavimento / implantacao / terreo / rooftop / subsolo | R$3.000,00 |
| Planta tipo | R$1.200,00 |
| Planta isometrica / 3D | R$1.900,00 |

### Historico extraido dos PDFs

| Cliente | Projeto | Externas | Internas | Plantas |
| --- | --- | ---: | ---: | ---: |
| GALLI | SAID AIACH | 9 / R$19.300,00 | 5 / R$8.750,00 | 4 / R$10.200,00 |
| HABRAS | ITAQUA JAPONES | 8 / R$18.500,00 | 12 / R$21.000,00 | 8 / R$11.400,00 |
| BRNPAR | NC AVARE | 5 / R$13.000,00 | 6 / R$10.800,00 | 3 / R$5.400,00 |
| CASA VIVA | PRESTES MAIA | 8 / R$15.800,00 | 8 / R$14.000,00 | 5 / R$8.300,00 |

## Uso

Execute com Python 3, sem instalar dependencias:

```bash
python3 -m proposal_automation examples/proposta_exemplo.json --saida output --formato both --comparar
```

Saidas esperadas:

```text
output/galli-said-aiach-nova-etapa.md
output/galli-said-aiach-nova-etapa.docx
```

Para forcar uma estrategia:

```bash
python3 -m proposal_automation examples/proposta_exemplo.json --estrategia planilha
python3 -m proposal_automation examples/proposta_exemplo.json --estrategia cliente
```

## Interface com assistente

Para usar uma tela com um espaco de briefing em texto livre:

```bash
python3 -m proposal_automation.web_app
```

Depois abra:

```text
http://127.0.0.1:8787
```

Na tela, escreva algo neste formato:

```text
Cliente: GALLI
Referencia: SAID AIACH - NOVA ETAPA
A/C: DANIEL PUCCI
Preco: seguir ultimo projeto do cliente
Desconto: 12%

Externas:
- Fachada vista da calcada
- Jardim
- Piscina
- Gourmet/churrasqueira

Internas:
- Bicicletario
- Academia
- Salao de Festas

Plantas:
- Implantacao terreo
- Implantacao rooftop
- Apartamento Tipo
```

Ao clicar em **Gerar proposta atualizada**, o assistente:

1. interpreta cliente, referencia, contato, desconto e criterio de preco;
2. separa as imagens entre externas, internas e plantas;
3. calcula a proposta com preco de `planilha` ou `cliente`;
4. mostra os dados entendidos para revisao;
5. gera os arquivos `.docx` e `.md` para download.

O assistente e local e deterministico: nao precisa de chave de API. Ele funciona
como uma camada de IA baseada nas regras comerciais e no historico ja extraido
dos PDFs.

## Modelo de entrada

```json
{
  "cliente": "GALLI",
  "referencia": "SAID AIACH - NOVA ETAPA",
  "aos_cuidados": "DANIEL PUCCI",
  "estrategia_preco": "cliente",
  "comparar_precos": true,
  "desconto_percentual": 12,
  "itens": {
    "externas": ["Fachada", "Piscina", "Gourmet/churrasqueira"],
    "internas": ["Academia", "Salao de Festas"],
    "plantas": ["Implantacao terreo", "Apartamento Tipo"]
  }
}
```

Tambem e possivel informar o tipo de preco manualmente quando a classificacao
automatica nao for suficiente:

```json
{
  "descricao": "Fotomontagem com drone da Flying",
  "tipo": "fotomontagem_drone_flying"
}
```

Ou travar um valor unitario:

```json
{
  "descricao": "Imagem especial",
  "valor_unitario": "2500,00"
}
```

## Tipos aceitos

- `fotomontagem_drone_flying`
- `fachada_fotomontagem_voo`
- `externa_diversa`
- `interna_diversa`
- `planta_pavimento`
- `planta_tipo`
- `planta_isometrica_3d`

## Validacao

```bash
python3 -m unittest discover -s tests
```
