#!/usr/bin/env bash
# Copia o papel timbrado oficial para o projeto.
# Uso (Linux/macOS com unidade montada):
#   ./scripts/importar_timbrado.sh /mnt/o/PAPEL_TIMBRADO/TIMBRADO_FLYINGSTUDIO.doc
# No Windows (PowerShell), salve como .docx e copie para web/assets/.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-}"

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Uso: $0 <caminho/TIMBRADO_FLYINGSTUDIO.doc|.docx>" >&2
  exit 1
fi

DEST_DOCX="$ROOT/web/assets/TIMBRADO_FLYINGSTUDIO.docx"
DEST_PY="$ROOT/flying/papel_timbrado/TIMBRADO_FLYINGSTUDIO.docx"
mkdir -p "$(dirname "$DEST_DOCX")" "$(dirname "$DEST_PY")"

if [[ "${SRC,,}" == *.doc ]]; then
  TMP="$(mktemp -d)"
  DOCX_OUT="$TMP/$(basename "${SRC%.*}").docx"
  if command -v libreoffice >/dev/null 2>&1 || command -v soffice >/dev/null 2>&1; then
    LO="$(command -v libreoffice || command -v soffice)"
    "$LO" --headless --convert-to docx --outdir "$TMP" "$SRC"
  else
    python3 - "$SRC" "$DOCX_OUT" <<'PY'
import sys
from spire.doc import Document, FileFormat
src, out = sys.argv[1], sys.argv[2]
d = Document()
d.LoadFromFile(src)
d.SaveToFile(out, FileFormat.Docx2016)
d.Close()
PY
  fi
  SRC="$DOCX_OUT"
fi

cp -f "$SRC" "$DEST_DOCX"
cp -f "$SRC" "$DEST_PY"
echo "Timbrado importado para:"
echo "  $DEST_DOCX"
echo "  $DEST_PY"
