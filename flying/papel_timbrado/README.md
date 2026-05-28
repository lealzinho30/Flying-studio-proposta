# Papel timbrado Flying Studio

A proposta é gerada **dentro** do modelo `TIMBRADO_FLYINGSTUDIO.docx` (cabeçalho/rodapé do timbrado; corpo substituído pelo texto da proposta).

## Arquivo oficial

Origem usual no Windows:

`O:\PAPEL_TIMBRADO\TIMBRADO_FLYINGSTUDIO.doc`

1. Abra no Word e **Salvar como → Word (.docx)** se ainda for `.doc`.
2. Copie para:
   - `web/assets/TIMBRADO_FLYINGSTUDIO.docx` (site Netlify)
   - `flying/papel_timbrado/TIMBRADO_FLYINGSTUDIO.docx` (CLI Python)

Ou use:

```bash
./scripts/importar_timbrado.sh "/caminho/TIMBRADO_FLYINGSTUDIO.docx"
```

Variável de ambiente (CLI): `FLYING_TIMBRADO=/caminho/arquivo.docx`
