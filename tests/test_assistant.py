from decimal import Decimal
from pathlib import Path
import tempfile
import unittest

from proposal_automation.assistant import parse_brief
from proposal_automation.web_app import generate_from_brief


BRIEF = """Cliente: GALLI
Referencia: SAID AIACH - NOVA ETAPA
A/C: DANIEL PUCCI
Preco: seguir ultimo projeto do cliente
Desconto: 12%

Externas:
- Fachada vista da calcada
- Jardim
- Piscina

Internas: Academia, Salao de Festas

Plantas:
1. Implantacao terreo
2. Apartamento Tipo
"""


class AssistantTest(unittest.TestCase):
    def test_parse_brief_extracts_core_fields_and_items(self):
        parsed = parse_brief(BRIEF)

        self.assertEqual(parsed.proposal["cliente"], "GALLI")
        self.assertEqual(parsed.proposal["referencia"], "SAID AIACH - NOVA ETAPA")
        self.assertEqual(parsed.proposal["aos_cuidados"], "DANIEL PUCCI")
        self.assertEqual(parsed.proposal["estrategia_preco"], "cliente")
        self.assertEqual(parsed.proposal["desconto_percentual"], Decimal("12"))
        self.assertEqual(parsed.proposal["itens"]["externas"], ["Fachada vista da calcada", "Jardim", "Piscina"])
        self.assertEqual(parsed.proposal["itens"]["internas"], ["Academia", "Salao de Festas"])
        self.assertEqual(parsed.proposal["itens"]["plantas"], ["Implantacao terreo", "Apartamento Tipo"])

    def test_generate_from_brief_writes_markdown_and_docx(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result = generate_from_brief(BRIEF, Path(temp_dir))

            self.assertIn("Total final", result.summary)
            self.assertEqual(len(result.files), 2)
            self.assertTrue((Path(temp_dir) / "galli-said-aiach-nova-etapa.md").exists())
            self.assertTrue((Path(temp_dir) / "galli-said-aiach-nova-etapa.docx").exists())
            self.assertIn("PROPOSTA DE IMAGENS", result.markdown)


if __name__ == "__main__":
    unittest.main()
