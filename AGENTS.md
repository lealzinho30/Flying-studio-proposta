# AGENTS.md

## Cursor Cloud specific instructions

Projeto Python 3 (Flask) que gera propostas comerciais Flying Studio em `.docx`. Não há banco de dados, cache ou fila — os dados ficam em arquivos JSON em `data/`. O `README.md` documenta uso, exemplos e estrutura.

### Dependências
- Instaladas via `pip install -r requirements.txt`. O ambiente é "externally-managed" (PEP 668), então a instalação usa `--break-system-packages` (já tratado pelo update script). Não é necessário ativar venv; rode tudo com `python3` diretamente.

### Serviços / como rodar
- **Servidor web Flask** (variante principal com Python): `python3 app.py` → `http://localhost:5000`. Use `FLASK_DEBUG=1` para reload e `PORT=` para trocar a porta. Faça POST em `/gerar` com o campo de formulário `descricao` (texto livre) para gerar a proposta; o link de download aparece como `/download/<token>`.
- **CLI**: `python3 gerador.py exemplos/<arquivo>.yaml` gera o `.docx` em `saida/`. Use `--comparar` para só imprimir os dois levantamentos, e `--estrategia planilha|historico|auto`.
- **App web estático** (`web/index.html`): 100% client-side, sem Python. Carrega bibliotecas via CDN (docx.js, jszip, pdf.js, etc.), portanto **precisa de internet** para funcionar. Os recursos de IA (`netlify/functions/*.mjs`) só rodam quando publicado no Netlify e são opcionais.

### IA opcional
- O parser usa regex local por padrão (funciona offline). Definir `OPENAI_API_KEY` ativa parsing via OpenAI (`OPENAI_MODEL`, default `gpt-4o-mini`), com fallback para o regex local. Nenhuma chave é necessária para o fluxo normal.

### Lint / testes
- Não há configuração de lint (sem ruff/flake8) nem suíte de testes Python no repositório. Para uma checagem de sintaxe rápida: `python3 -m py_compile app.py gerador.py flying/*.py`.
- `scripts/test-parser-casos.js` é um teste de parser em Node (opcional, requer Node).
