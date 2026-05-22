from decimal import Decimal
import unittest

from proposal_automation.pricing import calculate_proposal, compare_pricing, infer_price_type, money


class PricingTest(unittest.TestCase):
    def test_infers_sheet_price_types(self):
        self.assertEqual(infer_price_type("Fachada principal", "externas"), "fachada_fotomontagem_voo")
        self.assertEqual(infer_price_type("Piscina", "externas"), "externa_diversa")
        self.assertEqual(infer_price_type("Salao de Festas", "internas"), "interna_diversa")
        self.assertEqual(infer_price_type("Implantacao terreo", "plantas"), "planta_pavimento")
        self.assertEqual(infer_price_type("Apartamento Tipo", "plantas"), "planta_tipo")

    def test_planilha_strategy_uses_standard_table(self):
        proposal = {
            "cliente": "NOVO CLIENTE",
            "estrategia_preco": "planilha",
            "itens": {
                "externas": ["Fachada", "Piscina"],
                "internas": ["Lobby"],
                "plantas": ["Implantacao terreo", "Apartamento Tipo"],
            },
        }

        calculation = calculate_proposal(proposal)

        self.assertEqual(calculation["groups"]["externas"]["total"], Decimal("4900.00"))
        self.assertEqual(calculation["groups"]["internas"]["total"], Decimal("1750.00"))
        self.assertEqual(calculation["groups"]["plantas"]["total"], Decimal("4200.00"))
        self.assertEqual(calculation["grand_total"], Decimal("10850.00"))

    def test_client_strategy_uses_last_project_average(self):
        proposal = {
            "cliente": "CASA VIVA",
            "estrategia_preco": "cliente",
            "itens": {
                "externas": ["Fachada", "Piscina"],
                "internas": ["Lobby"],
                "plantas": ["Apartamento Tipo"],
            },
        }

        calculation = calculate_proposal(proposal)

        self.assertEqual(calculation["groups"]["externas"]["total"], Decimal("3950.00"))
        self.assertEqual(calculation["groups"]["internas"]["total"], Decimal("1750.00"))
        self.assertEqual(calculation["groups"]["plantas"]["total"], Decimal("1660.00"))
        self.assertEqual(calculation["grand_total"], Decimal("7360.00"))

    def test_compare_pricing_returns_both_levantamentos(self):
        proposal = {
            "cliente": "GALLI",
            "desconto_percentual": 10,
            "itens": {
                "externas": ["Fachada", "Piscina"],
                "internas": ["Academia"],
                "plantas": ["Apartamento Tipo"],
            },
        }

        comparison = compare_pricing(proposal)

        self.assertIn("planilha", comparison)
        self.assertIn("cliente", comparison)
        self.assertEqual(comparison["planilha"]["grand_total"], Decimal("7065.00"))
        self.assertEqual(money(comparison["planilha"]["grand_total"]), "R$7.065,00")


if __name__ == "__main__":
    unittest.main()
