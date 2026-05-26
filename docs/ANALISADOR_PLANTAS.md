# Analisador automático de PDF (plantas do projeto)

Fluxo: o usuário envia o **PDF do projeto** → o navegador gera imagens das páginas → a **Netlify Function** chama IA com visão → a listagem preenche o campo de descrição.

## Configuração no Netlify

Em **Site settings → Environment variables**:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | Sim* | Chave em [Google AI Studio](https://aistudio.google.com/apikey). Modelo padrão: `gemini-2.0-flash`. |
| `PLANTAS_IA_PROVIDER` | Não | `gemini` (padrão) ou `anthropic` |
| `ANTHROPIC_API_KEY` | Se Claude | Para usar Claude em vez do Gemini |
| `ANTHROPIC_MODEL` | Não | Ex.: `claude-sonnet-4-20250514` |
| `GEMINI_MODEL` | Não | Ex.: `gemini-2.0-flash` |

\* Ou `ANTHROPIC_API_KEY` se `PLANTAS_IA_PROVIDER=anthropic`.

Após salvar as variáveis, faça **Redeploy** do site.

## Custo

- **Gemini**: tier gratuito com limite mensal (adequado para uso interno); depois passa a cobrar por token.
- **Claude (Anthropic)**: pago por uso — qualidade alta, sem tier gratuito permanente.

Não há como visão em plantas ser **100% automática na nuvem** sem algum provedor de IA (ou servidor próprio com GPU).

## Limites

- Até **12 páginas** por PDF (as primeiras folhas). Projetos maiores: enviar PDF só com pranchas principais ou dividir.
- Timeout da função: **26 s** (Netlify).
- Sempre **revisar** a lista antes de gerar a proposta.

## Teste local

Com [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
netlify dev
```

Abra o site local, use o botão **Analisar PDF do projeto (IA)**.
