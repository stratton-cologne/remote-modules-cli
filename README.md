# @stratton-cologne/remote-modules-cli

CLI zum **Generieren** & **Veröffentlichen** des Manifests `/public/modules/index.json` – kompatibel zu `@stratton-cologne/remote-modules`.

## Installation

```bash
npm i -D @stratton-cologne/remote-modules-cli
```

## Usage

### 1) Manifest generieren

```bash
# scannt /public/modules und schreibt index.json
npx srm generate --host . --modules-dir public/modules

# Dev-Quelle hinzufügen (Vite /@fs/...)
npx srm generate --dev admin=/@fs/ABS/PFAD/admin-module/src/public-entry.ts

# Package-Spec (Import-Map/CDN) hinzufügen
npx srm generate --spec admin=@org/module-admin@1.2.3
npx srm generate --spec admin=https://esm.sh/@org/module-admin@1.2.3

# Nur ausgeben, nicht schreiben
npx srm generate --dry
```

### 2) Installierte Module veröffentlichen

Dein Modul-Package deklariert in `package.json`:

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

Dann:

```bash
# explizit Pakete spiegeln + Manifest aktualisieren
npx srm publish --packages @org/module-admin

# alle Pakete mit "remoteModule"-Feld erkennen
npx srm publish --all
```

Ergebnis:

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

## Tipps

-   **Dev + Runtime**: Du kannst `generate` mit `--dev` nutzen, um ungebaute Module einzubinden (Vite transformiert die Dateien).
-   **Import-Map**: Für Bare Specifier (`--spec admin=@org/module-admin`) in der Host-App eine Import-Map setzen oder via `@stratton-cologne/remote-modules` `resolveSpecifier` nutzen.
-   **CI**: Kombiniere `publish` mit einem Deploy-Step (z. B. Copy/rsync auf den Server) und führe danach `generate` auf dem Server aus.

## Lizenz

MIT
