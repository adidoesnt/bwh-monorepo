#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS_DIR="$(cd "$ROOT/.." && pwd)"
NAME="$(node -pe "JSON.parse(require('fs').readFileSync('$ROOT/.claude-plugin/plugin.json','utf8')).name")"
OUTPUT="$PLUGINS_DIR/${NAME}.plugin"
DIR_NAME="$(basename "$ROOT")"

cd "$PLUGINS_DIR"
rm -f "$OUTPUT"
zip -r "$OUTPUT" "$DIR_NAME" \
  -x "$DIR_NAME/*.plugin" \
  -x "$DIR_NAME/**/.DS_Store" \
  -x "$DIR_NAME/**/__MACOSX/*"

echo "Created $OUTPUT"
echo "Test with: claude --plugin-dir $OUTPUT"
