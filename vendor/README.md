# Vendored dependencies

Tarballs in this directory are installed via `file:` references in
`package.json` so that `npm ci` needs **no host besides the npm registry**
(corporate proxies frequently block third-party CDNs).

Their integrity is pinned in `package-lock.json` and checked by
`scripts/verify-vendored.mjs`, which runs as `preinstall` — npm itself does
not verify `integrity` for `file:` tarballs.

## sheetjs/xlsx-0.20.3.tgz

SheetJS Community Edition, Apache-2.0. Used by the hazard importer
(`src/features/hazards/services/importer/xlsx-ods-importer.ts`) for
.xlsx/.xls/.ods.

SheetJS no longer publishes to the npm registry — `xlsx@0.18.5` on npm is
frozen and affected by GHSA-4r6h-8v6p-xvw6 (prototype pollution) and
GHSA-5pgg-2g8v-p4x9 (ReDoS). The official distribution is
`https://cdn.sheetjs.com`; SheetJS documents vendoring as the supported
offline route.

Source:  https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
sha512 (hex):
a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024

Verify manually: `sha512sum vendor/sheetjs/xlsx-0.20.3.tgz`

To upgrade: download the new tarball from the CDN, place it here, update the
`file:` reference in `package.json`, run `npm install` (regenerates the
lockfile integrity), update this file.
