#!/bin/sh
# taraflow-reporter/packaging/build-deb.sh
# Baut tara-report_<version>_amd64.deb OHNE zusätzliches Packaging-Tool —
# nur mit dpkg-deb, das auf jedem Debian/Ubuntu-System bereits vorhanden ist.
#
# Voraussetzung: npm run build:cli wurde bereits ausgeführt
#   (dist-cli/taraflow-report.js UND dist-cli/node_modules/@resvg existieren).
#
# Verwendung (vom Repo-Root aus):
#   ./taraflow-reporter/packaging/build-deb.sh
set -e

VERSION="0.6.0-alpha"
PKGROOT="/tmp/tara-report-pkgroot"
OUTDIR="./release"

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT/DEBIAN"
mkdir -p "$PKGROOT/usr/lib/tara-report"
mkdir -p "$PKGROOT/usr/bin"
mkdir -p "$OUTDIR"

# --- Control file (Paket-Metadaten) ---
cat > "$PKGROOT/DEBIAN/control" <<EOF
Package: tara-report
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Depends: nodejs
Maintainer: Juergen M. <1004272+messi1@users.noreply.github.com>
Description: TARAflow headless report generator (CLI)
 Generates threat/risk documentation from .tara.json project files
 without the TARAflow desktop app.
EOF

# --- Inhalte ---
cp dist-cli/taraflow-report.js "$PKGROOT/usr/lib/tara-report/taraflow-report.js"
chmod 644 "$PKGROOT/usr/lib/tara-report/taraflow-report.js"

# @resvg/resvg-js ist eine native Bibliothek (kompilierte .node-Datei) —
# esbuild kann sie nicht ins Bundle einbetten (siehe build:cli-Script:
# --external:@resvg/resvg-js + Kopier-Schritt nach dist-cli/node_modules).
# Node löst require("@resvg/resvg-js") automatisch auf, weil dieser Ordner
# direkt neben taraflow-report.js liegt — kein NODE_PATH nötig.
cp -r dist-cli/node_modules "$PKGROOT/usr/lib/tara-report/node_modules"

cp taraflow-reporter/packaging/tara-report-wrapper.sh "$PKGROOT/usr/bin/taraflow-report"
chmod 755 "$PKGROOT/usr/bin/taraflow-report"

# --- Bauen ---
dpkg-deb --build --root-owner-group "$PKGROOT" "$OUTDIR/tara-report_${VERSION}_amd64.deb"

echo "Built: $OUTDIR/tara-report_${VERSION}_amd64.deb"