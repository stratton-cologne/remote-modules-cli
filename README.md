# @stratton-cologne/remote-modules-cli

[![npm version](https://img.shields.io/npm/v/@stratton-cologne/remote-modules-cli.svg)](https://www.npmjs.com/package/@stratton-cologne/remote-modules-cli)
[![npm downloads (total)](https://img.shields.io/npm/dt/%40stratton-cologne%2Fremote-modules-cli)](https://www.npmjs.com/package/@stratton-cologne/remote-modules-cli)
[![npm downloads (week)](https://img.shields.io/npm/dw/%40stratton-cologne%2Fremote-modules-cli)](https://www.npmjs.com/package/@stratton-cologne/remote-modules-cli)
![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![typescript](https://img.shields.io/badge/TypeScript-ready-blue)
![license: MIT](https://img.shields.io/badge/license-MIT-lightgrey)


CLI zum **Generieren**, **Veröffentlichen** _und_ **Scaffolden** von Remote‑Modulen/Manifesten (`/public/modules/index.json`) – kompatibel zu `@stratton-cologne/remote-modules`.

> **Neu in v1.1.0**: `scaffold` zum Erzeugen eines Modul‑Grundgerüsts (in‑Host oder als eigenes Package).

---

## Installation

```bash
npm i -D @stratton-cologne/remote-modules-cli
# oder
pnpm add -D @stratton-cologne/remote-modules-cli
```

> **Node**: Version **≥ 18** erforderlich (Nutzung von `fs/promises`, optional `fs.cp`).

---

## Übersicht der Kommandos

-   `srm generate` – scannt `/public/modules/**` und schreibt/aktualisiert `index.json`
    (optional: **Dev‑Einträge** und **Package‑Specs** hinzufügen)
-   `srm publish` – spiegelt gebaute Artefakte installierter Pakete (mit `remoteModule`‑Feld) nach `/public/modules` **und** aktualisiert `index.json`
-   `srm scaffold` – erzeugt ein **Modul‑Grundgerüst** (Vue 3 + Vite) wahlweise **in‑Host** oder als **eigenes Package**; kann `index.json` direkt um einen **Dev‑Eintrag** erweitern

---

## Quick Start

**A) In‑Host entwickeln (ohne Build)**

```bash
# Gerüst unter src/modules/<name> erzeugen und Manifest sofort ergänzen
npx @stratton-cologne/remote-modules-cli scaffold admin --manifest
```

Ergebnis:

-   `src/modules/admin/src/**` (mit `public-entry.ts`, Layout, View, Locales)
-   `public/modules/index.json` enthält `{"name":"admin","version":"dev","entryDev":"/src/modules/admin/src/public-entry.ts"}`

**B) Paket bauen & als Drop‑in deployen**

```bash
# Eigenes Package-Gerüst
npx @stratton-cologne/remote-modules-cli scaffold admin --as-package --pkg-name @org/module-admin
# im Modulordner: builden → dist/ deployen nach /public/modules/admin/<version>/
# danach index.json aktualisieren:
npx @stratton-cologne/remote-modules-cli publish --packages @org/module-admin
```

---

## `generate` – Manifest erstellen/erweitern

```bash
# scannt /public/modules und schreibt index.json
npx @stratton-cologne/remote-modules-cli generate --host . --modules-dir public/modules

# Dev-Quelle hinzufügen (im selben Projekt reicht /src/...)
npx @stratton-cologne/remote-modules-cli generate \
  --dev admin=/src/modules/admin-module/src/public-entry.ts

# Dev-Quelle außerhalb des Projekt-Roots (absolut, via Vite /@fs)
npx @stratton-cologne/remote-modules-cli generate \
  --dev admin=/@fs/ABS/PFAD/admin-module/src/public-entry.ts

# Package-Spec (Import-Map/CDN) hinzufügen
npx @stratton-cologne/remote-modules-cli generate --spec admin=@org/module-admin@1.2.3
npx @stratton-cologne/remote-modules-cli generate --spec admin=https://esm.sh/@org/module-admin@1.2.3

# Nur ausgeben, nicht schreiben
npx @stratton-cologne/remote-modules-cli generate --dry
```

**Ergebnis (Beispiel):**

```json
[
    {
        "name": "admin",
        "version": "dev",
        "entryDev": "/src/modules/admin/src/public-entry.ts",
        "prefer": "dev"
    },
    {
        "name": "users",
        "version": "1.2.3",
        "baseUrl": "/modules/users/1.2.3/",
        "entry": "index.js",
        "styles": ["style.css"]
    }
]
```

---

## `publish` – installierte Pakete spiegeln

Dein Modul‑Package (Auszug `package.json`):

```json
{
    "name": "@org/module-admin",
    "version": "1.2.3",
    "remoteModule": {
        "name": "admin",
        "entry": "dist/index.js",
        "styles": ["dist/style.css"],
        "assets": "dist/assets"
    }
}
```

Befehle:

```bash
# explizite Pakete spiegeln + Manifest aktualisieren
npx @stratton-cologne/remote-modules-cli publish --packages @org/module-admin

# alle Pakete mit "remoteModule"-Feld erkennen (langsamer)
npx @stratton-cologne/remote-modules-cli publish --all
```

**Ergebnis:**

```json
[
    {
        "name": "admin",
        "version": "1.2.3",
        "baseUrl": "/modules/admin/1.2.3/",
        "entry": "index.js",
        "styles": ["style.css"]
    }
]
```

---

## `scaffold` – Modul‑Grundgerüst erzeugen

```bash
# In-Host (unter src/modules/<name>) und Manifest sofort ergänzen
npx @stratton-cologne/remote-modules-cli scaffold admin --manifest

# Als eigenes Package (mit package.json, vite.config.ts, tsconfig.json, README)
npx @stratton-cologne/remote-modules-cli scaffold admin \
  --as-package --pkg-name @org/module-admin

# Optionen
# --target <dir>       Zielpfad (default: src/modules/<name> bzw. modules/<name>)
# --route </pfad>      Basisroute (default: /<name>)
# --namespace <ns>     i18n-Namespace (default: <name>)
# --title <Titel>      Titel im Default-Layout
# --manifest           index.json nach Scaffold um Dev-Entry erweitern (nur In-Host)
# --force              vorhandene Dateien überschreiben
```

**Gerüst (In‑Host):**

```
src/modules/<name>/src/
├─ public-entry.ts       # export default ModuleBundle
├─ layouts/
│  └─ <name>.layout.vue
├─ views/
│  └─ index.view.vue
├─ locales/
│  ├─ de.json
│  └─ en.json
└─ style.css
```

**Gerüst (Package):** zusätzlich `package.json`, `vite.config.ts`, `tsconfig.json`, `README.md`.

---

## Typische Workflows

**A) Ein Kommando für Dev:**

```bash
npx @stratton-cologne/remote-modules-cli scaffold admin --manifest
```

**B) Manuell splitten:**

```bash
npx @stratton-cologne/remote-modules-cli scaffold admin
npx @stratton-cologne/remote-modules-cli generate --dev admin=/src/modules/admin/src/public-entry.ts
```

**C) CI/CD für Drop‑ins:**

```bash
# Build im Modul-Repo → dist/ deployen → auf dem Host spiegeln
npx @stratton-cologne/remote-modules-cli publish --packages @org/module-admin
npx @stratton-cologne/remote-modules-cli generate
```

---

## Troubleshooting

-   **Manifest lädt HTML statt JSON** (`Unexpected token '<'`):

    -   Existiert `public/modules/index.json`? Der Dev‑Server gibt sonst `index.html` zurück (SPA‑Fallback).
    -   In der App `manifestUrl: \`\${import.meta.env.BASE_URL}modules/index.json\`\` setzen (Sub‑Pfad‑Deploys).
    -   Statisches Serving von `/modules/` im Webserver ohne SPA‑Fallback konfigurieren.

-   **`npx srm` startet falsches Tool**:

    -   Immer den **vollen Paketnamen** verwenden: `npx @stratton-cologne/remote-modules-cli …`

-   **Dev‑Quelle außerhalb des Host‑Roots**:

    -   Vite erlauben: `vite.config.ts → server.fs.allow = ['..', '/ABS/PFAD/zu/modul']`
    -   Manifest‑Eintrag mit `/@fs/ABS/PFAD/.../public-entry.ts` verwenden.

---

## Versionierung

Diese Version führt **neue Features** (Scaffold) **ohne Breaking Changes** ein → **empfohlen: `v1.1.0`** (Minor‑Bump).
Ein **Major** (`v2.0.0`) wäre nur nötig, wenn sich bestehende Flags, Default‑Pfade, Bin‑Name (`srm`) oder die `generate/publish`‑Semantik **inkompatibel** ändern.

---

## Lizenz

MIT
