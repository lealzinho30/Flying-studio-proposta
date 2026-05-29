# Chat com interpretação por IA

Por padrão o site usa **modo local** (`FLYING_MODO_LOCAL = true` em `index.html`) — sem custo de API. Veja **`docs/PARSER_LOCAL.md`** para todas as frases que o parser entende.

Camadas:

1. **Parser local** (sempre ativo) — escopo (imagens), cliente/projeto/A/C, PDF.
2. **IA** (opcional, Netlify) — **Claude**, **ChatGPT** ou **Gemini**, se você desativar o modo local e configurar chaves.

## Provedores suportados

| Provedor | Variável de chave | Variável de modelo | `PLANTAS_IA_PROVIDER` |
|----------|-------------------|--------------------|------------------------|
| **Claude** (recomendado se você tem plano Anthropic) | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (ex. `claude-sonnet-4-20250514`) | `anthropic` |
| **ChatGPT** | `OPENAI_API_KEY` | `OPENAI_MODEL` (ex. `gpt-4o` ou `gpt-4o-mini`) | `openai` |
| **Gemini** | `GEMINI_API_KEY` | `GEMINI_MODEL` (ex. `gemini-2.5-flash`) | `gemini` |

Funções: `interpretar-briefing` (chat) e `analisar-planta` (PDF de plantas).

**Importante:** plano pago do site claude.ai, chatgpt.com ou gemini.google.com **não é** a mesma coisa que API. Você precisa da **chave de API** do console de cada provedor.

## Configuração rápida no Netlify (Claude pago)

1. [console.anthropic.com](https://console.anthropic.com/) → **API Keys** → criar chave.
2. Netlify → site → **Environment variables**:

   | Nome | Valor |
   |------|--------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` |
   | `PLANTAS_IA_PROVIDER` | `anthropic` |

3. **Deploy site** → Deploy project (obrigatório após mudar variáveis).
4. No site: Ctrl+F5 e teste o chat.

## ChatGPT (OpenAI)

1. [platform.openai.com](https://platform.openai.com/) → API keys (conta com créditos).
2. Netlify:

   | Nome | Valor |
   |------|--------|
   | `OPENAI_API_KEY` | `sk-...` |
   | `OPENAI_MODEL` | `gpt-4o-mini` (barato) ou `gpt-4o` (melhor visão em plantas) |
   | `PLANTAS_IA_PROVIDER` | `openai` |

3. Deploy site.

## Gemini (plano pago Google)

1. [aistudio.google.com](https://aistudio.google.com/) → billing ativo → API key.
2. Netlify:

   | Nome | Valor |
   |------|--------|
   | `GEMINI_API_KEY` | sua chave |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `PLANTAS_IA_PROVIDER` | `gemini` |

3. Deploy site.

## Ordem automática (se não definir `PLANTAS_IA_PROVIDER`)

1. Anthropic (se `ANTHROPIC_API_KEY` existir)  
2. OpenAI (se `OPENAI_API_KEY` existir)  
3. Gemini (se `GEMINI_API_KEY` existir)

## Sem IA

O parser local + PDF continuam funcionando. Mensagens só de **imagens/escopo** não precisam de IA.
