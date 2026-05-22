# Flying Studio - Automacao de Propostas

Este repositorio contem uma automacao para gerar propostas de imagens
no mesmo padrao textual dos modelos atuais da Flying Studio.

Escopo desta versao:
- Ilustracoes externas
- Ilustracoes internas
- Plantas

## O que a automacao faz

1. Recebe os dados do projeto via JSON (cliente, referencia, itens, desconto).
2. Calcula os valores automaticamente.
3. Gera proposta em texto e tambem em Word (.docx).
4. Suporta dois modos de precificacao:
   - `planilha`: usa a tabela padrao (`data/precos_planilha.json`)
   - `cliente`: usa o ultimo projeto do mesmo cliente; se nao achar cliente,
     usa media historica global

## Arquivos principais

- `proposal_automation.py`: CLI principal da automacao
- `brief_ai_parser.py`: interpretador de texto livre (assistente IA)
- `web_app.py`: interface web para escrever o briefing e gerar proposta
- `data/precos_planilha.json`: custos padrao por categoria
- `data/historico_propostas.json`: historico base para precificacao por cliente
- `examples/entrada_projeto.json`: exemplo de input
- `requirements.txt`: dependencias da aplicacao web

## Como usar

### 1) Analisar historico

```bash
python3 proposal_automation.py analisar
```

Mostra media ponderada por categoria e clientes cadastrados no historico.

### 2) Gerar proposta com preco de planilha

```bash
python3 proposal_automation.py gerar \
  --entrada examples/entrada_projeto.json \
  --modo planilha \
  --saida out/proposta_planilha.txt \
  --saida-docx out/proposta_planilha.docx \
  --saida-resumo out/resumo_planilha.json \
  --comparar
```

### 3) Gerar proposta com preco do ultimo projeto do cliente

```bash
python3 proposal_automation.py gerar \
  --entrada examples/entrada_projeto.json \
  --modo cliente \
  --saida out/proposta_cliente.txt \
  --saida-docx out/proposta_cliente.docx \
  --saida-resumo out/resumo_cliente.json \
  --comparar
```

## Interface "IA integrada" (texto livre)

### Instalar dependencias

```bash
python3 -m pip install -r requirements.txt
```

### Subir a interface web

```bash
python3 web_app.py
```

Abra no navegador:

```text
http://localhost:8080
```

Nessa tela, voce descreve em texto livre:
- cliente / empresa / contato / referencia
- lista de imagens
- regra de preco (`planilha` ou `cliente`)
- desconto (opcional)

A aplicacao interpreta o texto, classifica as imagens por categoria,
calcula os valores e gera os arquivos:
- `.txt`
- `.docx`
- `.json` (resumo dos calculos)

## Formato do JSON de entrada

```json
{
  "empresa": "CLIENTE EXEMPLO",
  "cliente": "CLIENTE EXEMPLO",
  "referencia": "RESIDENCIAL EXEMPLO",
  "a_c": "NOME DO CONTATO",
  "cidade_data": "Sao Paulo, 22 de Maio de 2026.",
  "desconto_percentual": 10,
  "itens": {
    "externas": ["Fachada", "Portaria"],
    "internas": ["Lobby", "Academia"],
    "plantas": ["Implantacao terreo", "Tipo A"]
  }
}
```

Observacoes:
- Em cada categoria, voce pode enviar lista de nomes (recomendado) ou um numero inteiro.
- Se enviar numero inteiro, o script gera nomes padrao automaticamente.

## Como manter a base de precos

### Atualizar custo padrao (planilha)
Edite `data/precos_planilha.json`.

### Atualizar historico dos clientes
Edite `data/historico_propostas.json` adicionando novos projetos com:
- cliente
- referencia
- data (`YYYY-MM-DD`)
- quantidade e total por categoria

Com isso, o modo `cliente` sempre pega o projeto mais recente para aquele cliente.
