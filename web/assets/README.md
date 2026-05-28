# Assets da marca

| Arquivo | Uso |
|---------|-----|
| `flying_logo_source.png` | Export original (sem margem extra). **Não editar** — base do script `scripts/preparar_logos.py`. |
| `flying_logo_hi.png` | Logo com margem de segurança (Word / timbrado). |
| `flying_logo.png` | Versão reduzida (`flying/docx_writer.py`). |
| `TIMBRADO_FLYINGSTUDIO.docx` | Papel timbrado oficial (convertido do `.doc` enviado no GitHub). |
| `flying/papel_timbrado/TIMBRADO_FLYINGSTUDIO.doc` | Cópia do original `.doc` (referência). |

Se a logo no repositório parecer recortada de novo, rode na raiz do projeto:

```bash
python3 scripts/preparar_logos.py
python3 scripts/gerar_template_timbrado.py
```
