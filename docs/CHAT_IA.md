# Chat com interpretação por IA

O campo de chat usa duas camadas:

1. **Parser local** (sempre ativo) — entende frases como *«10 perspectivas internas a definir, empresa Tarraf, projeto Vila Mariana, A/C Larissa»* e textos *Cliente X Projeto Y A/C Z*.
2. **IA** (Netlify) — quando configurada, refina a mensagem com Gemini ou Claude.

## Variáveis no Netlify

As mesmas do analisador de plantas:

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Recomendado (padrão `PLANTAS_IA_PROVIDER=gemini`) |
| `ANTHROPIC_API_KEY` | Alternativa |
| `PLANTAS_IA_PROVIDER` | `gemini` ou `anthropic` |

Função: `/.netlify/functions/interpretar-briefing`

Sem chave de IA, só o parser local funciona (mensagens simples e textos estruturados).

## Dica de uso

- **Uma proposta por vez**: se mudar de cliente, envie numa mensagem nova (o sistema troca o briefing).
- Mensagens longas com listas `Externas:` / `Internas:` continuam válidas.
- Valores em R$ e condições de pagamento no texto são ignorados na listagem de imagens.
