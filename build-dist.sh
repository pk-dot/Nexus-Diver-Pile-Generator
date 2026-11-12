#!/usr/bin/env bash
# Erstellt den Ordner dist/ mit allen Dateien, die auf den Server gehören.
# Aufruf: ./build-dist.sh
set -euo pipefail

cd "$(dirname "$0")"

DIST_DIR="dist"
FILES=(index.html app.js styles.css changelog.html roadmap.html)

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/img"

cp "${FILES[@]}" "$DIST_DIR/"
cp img/*.svg "$DIST_DIR/img/"

echo "dist/ erstellt:"
find "$DIST_DIR" -type f | sort
