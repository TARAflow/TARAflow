#!/bin/sh
# taraflow-verifier/packaging/build-deb.sh
# Baut tara-verify_<version>_amd64.deb OHNE zusätzliches Packaging-Tool —
# nur mit dpkg-deb, das auf jedem Debian/Ubuntu-System bereits vorhanden ist.
#
# Voraussetzung: npm run build:cli:verify wurde bereits ausgeführt
#   (dist-cli/taraflow-verify.js existiert). Anders als tara-report braucht der
#   Verifier KEIN dist-cli/node_modules — er hat keine Runtime-npm-Deps.
#
# Verwendung (vom Repo-Root aus):
#   ./taraflow-verifier/packaging/build-deb.sh
set -e

VERSION="0.1.0-alpha"
PKGROOT="/tmp/tara-verify-pkgroot"
OUTDIR="./release"

rm -rf "$PKGROOT"
mkdir -p "$PKGROOT/DEBIAN"
mkdir -p "$PKGROOT/usr/lib/tara-verify"
mkdir -p "$PKGROOT/usr/bin"
mkdir -p "$OUTDIR"

# --- Control file (Paket-Metadaten) ---
# `git` ist eine harte Laufzeit-Dependency (rev-parse, log, cat-file,
# verify-commit); `nodejs` führt das Bundle aus.
cat > "$PKGROOT/DEBIAN/control" <<EOF
Package: tara-verify
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Depends: nodejs, git
Maintainer: Juergen M. <1004272+messi1@users.noreply.github.com>
Description: TARAflow headless audit-trail verifier (CLI)
 Reconstructs the signing authority from a repository's committed history
 and reports findings, without the TARAflow desktop app.
 Exit codes: 0 pass, 1 findings, 2 usage, 3 engine.
EOF

# --- Inhalte ---
cp dist-cli/taraflow-verify.js "$PKGROOT/usr/lib/tara-verify/taraflow-verify.js"
chmod 644 "$PKGROOT/usr/lib/tara-verify/taraflow-verify.js"

# Kein node_modules: der Verifier hat keine Runtime-npm-Deps (nur Node-Builtins
# + externes git). Das Bundle ist self-contained.

cp taraflow-verifier/packaging/tara-verify-wrapper.sh "$PKGROOT/usr/bin/taraflow-verify"
chmod 755 "$PKGROOT/usr/bin/taraflow-verify"

# --- Bauen ---
dpkg-deb --build --root-owner-group "$PKGROOT" "$OUTDIR/tara-verify_${VERSION}_amd64.deb"

echo "Built: $OUTDIR/tara-verify_${VERSION}_amd64.deb"
