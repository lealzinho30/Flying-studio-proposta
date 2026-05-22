"""Interface web local para o assistente de propostas."""

from __future__ import annotations

from dataclasses import dataclass
import argparse
from html import escape
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .assistant import example_brief, parse_brief
from .cli import write_outputs
from .pricing import calculate_proposal, money, slugify
from .render import render_proposal


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787


@dataclass(frozen=True)
class GeneratedProposal:
    proposal: dict[str, object]
    markdown: str
    files: list[Path]
    summary: str
    warnings: list[str]


def _page(title: str, body: str) -> bytes:
    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f4f1ec;
      --card: #fffdf8;
      --ink: #222;
      --muted: #6b625a;
      --accent: #111827;
      --line: #ded7ce;
      --success: #0f766e;
      --warning: #92400e;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 16px/1.5 Arial, Helvetica, sans-serif;
    }}
    main {{
      width: min(1120px, calc(100vw - 32px));
      margin: 32px auto;
    }}
    .hero, .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 14px 40px rgba(27, 24, 20, .08);
      padding: 24px;
    }}
    h1, h2, h3 {{ line-height: 1.15; margin: 0 0 12px; }}
    p {{ color: var(--muted); margin: 0 0 16px; }}
    textarea {{
      width: 100%;
      min-height: 360px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      font: 15px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #fff;
      color: var(--ink);
    }}
    button, .button {{
      display: inline-block;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      padding: 12px 18px;
      text-decoration: none;
      font-weight: 700;
      cursor: pointer;
    }}
    .button.secondary {{
      background: #fff;
      color: var(--accent);
      border: 1px solid var(--accent);
    }}
    .grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 18px;
    }}
    .actions {{ display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }}
    .notice {{
      border-radius: 12px;
      padding: 12px 14px;
      margin: 12px 0;
      background: #ecfdf5;
      color: var(--success);
      border: 1px solid #99f6e4;
    }}
    .warning {{
      background: #fffbeb;
      color: var(--warning);
      border-color: #fde68a;
    }}
    pre {{
      overflow: auto;
      background: #111827;
      color: #f9fafb;
      padding: 16px;
      border-radius: 14px;
      max-height: 520px;
      white-space: pre-wrap;
    }}
    code {{
      background: #eee7dd;
      padding: 2px 5px;
      border-radius: 6px;
    }}
    ul {{ margin-top: 8px; }}
    @media (max-width: 820px) {{
      .grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>{body}</main>
</body>
</html>
"""
    return html.encode("utf-8")


def _render_home(brief: str | None = None, result: GeneratedProposal | None = None, error: str = "") -> bytes:
    current_brief = brief if brief is not None else example_brief()
    result_html = ""
    if error:
        result_html = f'<div class="notice warning"><strong>Erro:</strong> {escape(error)}</div>'
    elif result:
        links = "\n".join(
            f'<a class="button" href="/download?file={escape(path.name)}">{escape(path.name)}</a>'
            for path in result.files
        )
        warnings = ""
        if result.warnings:
            warning_items = "".join(f"<li>{escape(item)}</li>" for item in result.warnings)
            warnings = f'<div class="notice warning"><strong>Avisos do assistente:</strong><ul>{warning_items}</ul></div>'
        result_html = f"""
        <div class="notice"><strong>Proposta gerada.</strong> {escape(result.summary)}</div>
        {warnings}
        <div class="actions">{links}</div>
        <div class="grid">
          <section class="card">
            <h2>Dados entendidos pela IA</h2>
            <pre>{escape(json.dumps(result.proposal, ensure_ascii=False, indent=2, default=str))}</pre>
          </section>
          <section class="card">
            <h2>Previa da proposta</h2>
            <pre>{escape(result.markdown[:8000])}</pre>
          </section>
        </div>
        """

    body = f"""
    <section class="hero">
      <h1>Assistente de Propostas Flying Studio</h1>
      <p>Descreva o cliente, referencia, criterio de preco e as imagens. O assistente interpreta o briefing, calcula com a regra escolhida e gera a proposta atualizada em Word.</p>
      <p>Use <code>Preco: planilha</code> ou <code>Preco: seguir ultimo projeto do cliente</code>. Separe as imagens em blocos <code>Externas</code>, <code>Internas</code> e <code>Plantas</code>.</p>
      <form method="post" action="/generate">
        <textarea name="brief" aria-label="Briefing da proposta">{escape(current_brief)}</textarea>
        <div class="actions">
          <button type="submit">Gerar proposta atualizada</button>
          <a class="button secondary" href="/">Limpar / exemplo</a>
        </div>
      </form>
    </section>
    {result_html}
    """
    return _page("Assistente de Propostas Flying Studio", body)


def generate_from_brief(brief: str, output_dir: Path) -> GeneratedProposal:
    parsed = parse_brief(brief)
    calculation = calculate_proposal(parsed.proposal)
    markdown = render_proposal(
        parsed.proposal,
        calculation,
        include_comparison=bool(parsed.proposal.get("comparar_precos")),
    )
    file_base = slugify(
        "-".join(
            part
            for part in [
                str(parsed.proposal.get("cliente", "")),
                str(parsed.proposal.get("referencia", "")),
            ]
            if part
        )
    )
    files = write_outputs(parsed.proposal, markdown, output_dir, file_base, "both")
    summary = (
        f"Estrategia: {calculation['strategy']} | "
        f"Subtotal: {money(calculation['subtotal'])} | "
        f"Total final: {money(calculation['grand_total'])}"
    )
    warnings = [*parsed.warnings, *calculation["warnings"]]
    return GeneratedProposal(
        proposal=parsed.proposal,
        markdown=markdown,
        files=files,
        summary=summary,
        warnings=warnings,
    )


class ProposalRequestHandler(BaseHTTPRequestHandler):
    output_dir: Path = Path("output/web")

    def _send_html(self, content: bytes, status: HTTPStatus = HTTPStatus.OK) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:  # noqa: N802 - API do BaseHTTPRequestHandler
        parsed_url = urlparse(self.path)
        if parsed_url.path == "/":
            self._send_html(_render_home())
            return
        if parsed_url.path == "/download":
            query = parse_qs(parsed_url.query)
            filename = Path(unquote(query.get("file", [""])[0])).name
            target = (self.output_dir / filename).resolve()
            output_root = self.output_dir.resolve()
            if not filename or output_root not in target.parents:
                self.send_error(HTTPStatus.NOT_FOUND, "Arquivo nao encontrado.")
                return
            if not target.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "Arquivo nao encontrado.")
                return
            content_type = (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if target.suffix == ".docx"
                else "text/markdown; charset=utf-8"
            )
            data = target.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f'attachment; filename="{target.name}"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Pagina nao encontrada.")

    def do_POST(self) -> None:  # noqa: N802 - API do BaseHTTPRequestHandler
        parsed_url = urlparse(self.path)
        if parsed_url.path != "/generate":
            self.send_error(HTTPStatus.NOT_FOUND, "Pagina nao encontrada.")
            return
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length).decode("utf-8")
        form = parse_qs(raw_body)
        brief = form.get("brief", [""])[0]
        try:
            result = generate_from_brief(brief, self.output_dir)
            self._send_html(_render_home(brief=brief, result=result))
        except Exception as exc:  # noqa: BLE001 - erro deve voltar para a tela
            self._send_html(_render_home(brief=brief, error=str(exc)), HTTPStatus.BAD_REQUEST)


def run(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, output_dir: str | Path = "output/web") -> None:
    ProposalRequestHandler.output_dir = Path(output_dir)
    ProposalRequestHandler.output_dir.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((host, port), ProposalRequestHandler)
    print(f"Assistente de propostas: http://{host}:{port}")
    print("Pressione Ctrl+C para parar.")
    server.serve_forever()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Abre a interface web do assistente de propostas.")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Host. Padrao: {DEFAULT_HOST}")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Porta. Padrao: {DEFAULT_PORT}")
    parser.add_argument("--saida", default="output/web", help="Diretorio dos arquivos gerados.")
    args = parser.parse_args(argv)
    run(host=args.host, port=args.port, output_dir=args.saida)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
