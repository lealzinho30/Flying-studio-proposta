# Analisador automático de PDF (plantas do projeto)

Fluxo: o usuário envia o **PDF do projeto** → o navegador gera imagens das páginas → a **Netlify Function** chama IA (visão) → a listagem preenche o campo de descrição.

> Observação: para listar imagens a partir de plantas, é necessário **algum provedor de visão** (Anthropic/Gemini). Sem isso não dá para ser automático 100% no site.

## Configuração no Netlify (obrigatória)

Em **Site settings → Environment variables**:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | Sim | Chave da Anthropic (Claude) |
| `ANTHROPIC_MODEL` | Não | Ex.: `claude-sonnet-4-20250514` |
| `PLANTAS_IA_PROVIDER` | Não | `anthropic` (padrão) ou `gemini` |
| `GEMINI_API_KEY` | Só se `PLANTAS_IA_PROVIDER=gemini` | Chave no Google AI Studio |
| `GEMINI_MODEL` | Não | Ex.: `gemini-2.0-flash` |

Depois de salvar as variáveis, faça **Redeploy** do site.

## Custo

- **Claude (Anthropic)**: pago por uso — qualidade alta para leitura de pranchas.
- **Gemini (opcional)**: pode funcionar com free tier dependendo do seu plano, mas não é garantido que fique grátis.

## Limites

- Até **12 páginas** por PDF (as primeiras folhas).
- Timeout da função: **26 s** (Netlify).
- Sempre **revisar** a lista antes de gerar a proposta.

## Teste local

Com [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
netlify dev
```

Abra o site local, use o botão **Analisar PDF do projeto (IA)**.
