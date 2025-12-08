#!/usr/bin/env bash
set -euo pipefail

# Export the dynamic Django home page to a static GitHub Pages-friendly copy in docs/.

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC_HTML="$ROOT/tool/templates/tool/home.html"
DEST_DIR="$ROOT/docs"
DEST_HTML="$DEST_DIR/index.html"
CSS_SRC="$ROOT/tool/static/tool/home.css"
JS_SRC="$ROOT/tool/static/tool/home.js"
IMG_SRC="$ROOT/tool/static/tool/img"

mkdir -p "$DEST_DIR/img"

# Rewrite the template with relative asset paths and a literal year.
python3 - <<'PY' "$SRC_HTML" "$DEST_HTML"
import datetime
import pathlib
import re
import sys

src = pathlib.Path(sys.argv[1])
dest = pathlib.Path(sys.argv[2])

html = src.read_text()

# Drop Django static tag
html = re.sub(r'{%\s*load static\s*%}\s*', '', html)
# Point assets at the docs/ copies
html = html.replace("{% static 'tool/home.css' %}", "home.css")
html = html.replace("{% static 'tool/home.js' %}", "home.js")
# Replace image static references entirely
html = re.sub(r"{%\s*static\s+'tool/img/([^']+)'\s*%}", r"img/\1", html)
# Replace dynamic year with a literal
html = re.sub(r'{{\s*now\|date:"Y"\s*}}', str(datetime.date.today().year), html)

dest.write_text(html)
print(f"Wrote {dest}")
PY

cp "$CSS_SRC" "$DEST_DIR/home.css"
cp "$JS_SRC" "$DEST_DIR/home.js"
cp -R "$IMG_SRC/." "$DEST_DIR/img/"

echo "Static assets copied to $DEST_DIR"
