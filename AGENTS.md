# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Flying Studio Proposta is a Python/Flask web application for automating commercial proposal generation for a 3D architectural visualization company. The main development branch is `cursor/automacao-propostas-flying-2314` (the `main` branch only contains a README).

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Flask web app | `FLASK_DEBUG=1 python3 app.py` | 5000 | Main web interface for proposal generation |
| CLI generator | `python3 gerador.py exemplos/exemplo_galli.yaml --comparar` | N/A | Command-line tool for generating proposals |

### Important caveats

- **Branch structure**: All code lives in the feature branch `cursor/automacao-propostas-flying-2314`. You must `git checkout cursor/automacao-propostas-flying-2314` before running any commands.
- **No database**: Data is stored in flat JSON files under `data/` (pricing table + client history).
- **OpenAI is optional**: The AI parser (`flying/ai_parser.py`) falls back to a local regex parser when `OPENAI_API_KEY` is not set. The app works fully without it.
- **Linting**: Run `flake8 --max-line-length=120 --exclude=.git,__pycache__,.venv,venv .` from the project root. Pre-existing lint issues exist (mostly line-length warnings).
- **No automated test suite**: The branch does not include unit tests.
- **Generated DOCX files** go into `saida/` and are git-ignored.
- **Dependencies**: `pip install -r requirements.txt` installs `python-docx`, `PyYAML`, `Flask`, and `openai`.
- **Python path**: User-installed binaries go to `~/.local/bin`; ensure this is on `PATH` (`export PATH="$HOME/.local/bin:$PATH"`).
