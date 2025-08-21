import fsp from "node:fs/promises";
import { join, dirname, posix } from "node:path";
import { exists, ensureDir, writeJsonPretty } from "./utils/fs.js";
import { generateIndex } from "./generate.js";

export type ScaffoldOptions = {
  hostDir: string;
  name: string; // modulname (z. B. "admin")
  target?: string; // Zielpfad; default siehe unten
  asPackage?: boolean; // eigenes npm-Package?
  route?: string; // Basisroute, default: /<name>
  namespace?: string; // i18n Namespace, default: <name>
  title?: string; // sichtbarer Titel, default: Pascal(Name)
  pkgName?: string; // package.json name (bei --as-package)
  manifest?: boolean; // nach dem Scaffold index.json aktualisieren (Dev entry)
  force?: boolean; // vorhandene Dateien überschreiben
  modulesDir?: string; // host public/modules (für manifest update)
};

function toKebab(s: string) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
function toPascal(s: string) {
  return s.replace(/(^\\w|[-_\\s]+\\w)/g, (m) =>
    m.replace(/[-_\\s]/g, "").toUpperCase()
  );
}
const safeWrite = async (
  file: string,
  content: string,
  force = false
): Promise<boolean> => {
  const ok = force || !(await exists(file));
  if (!ok) return false;
  await ensureDir(dirname(file));
  await fsp.writeFile(file, content, "utf8");
  return true;
};

// ---------------- Templates ----------------
function tplPublicEntry(ns: string, route: string, layoutName: string) {
  return `import type { ModuleBundle } from '@stratton-cologne/remote-modules'
import de from './locales/de.json'
import en from './locales/en.json'
import './style.css'

const bundle: ModuleBundle = {
  name: '${ns}',
  version: '0.1.0',
  routes: [
    {
      path: '${route}',
      component: () => import('./layouts/${layoutName}.layout.vue'),
      meta: { title: '${toPascal(ns)}', roles: ['admin'] },
      children: [
        { path: '', name: '${toKebab(
          ns
        )}-index', component: () => import('./views/index.view.vue') }
      ]
    }
  ],
  locales: { de, en },
  install({ app }) {
    // Platz für Modul-spezifische Plugins/Components
  },
}
export default bundle
`;
}

function tplLayout(title: string) {
  return `<template>
  <div class="p-6">
    <header class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">${title}</h1>
      <nav class="text-sm opacity-70">
        <RouterLink to="/">Home</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
// Layout-spezifische Logik hier
</script>
`;
}

function tplView(ns: string) {
  return `<template>
  <section class="space-y-3">
    <p class="text-gray-600">Hello from <strong>${ns}</strong> module 👋</p>
    <p class="text-sm opacity-75">Edit <code>src/modules/${ns}/src/views/index.view.vue</code></p>
  </section>
</template>

<script setup lang="ts">
</script>
`;
}

const tplDe = (ns: string) =>
  JSON.stringify(
    { [ns]: { title: toPascal(ns), index: "Übersicht" } },
    null,
    2
  ) + "\n";
const tplEn = (ns: string) =>
  JSON.stringify(
    { [ns]: { title: toPascal(ns), index: "Overview" } },
    null,
    2
  ) + "\n";

const tplStyle = `/* Modul-Styles (werden bei Library-Build extrahiert) */
:root { --${Date.now().toString(36)}: 1 }
`;

function tplPkgJson(pkgName: string, ns: string) {
  return `{
  "name": "${pkgName}",
  "version": "0.1.0",
  "type": "module",
  "private": false,
  "license": "MIT",
  "scripts": {
    "build": "vite build"
  },
  "peerDependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.7",
    "vue-i18n": "^9.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.5.0"
  },
  "remoteModule": {
    "name": "${ns}",
    "entry": "dist/index.js",
    "styles": ["dist/style.css"],
    "assets": "dist/assets"
  }
}
`;
}

const tplTsconfig = `{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM"],
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
`;

const tplViteConfig = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/public-entry.ts',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['vue', 'vue-router', 'pinia', 'vue-i18n'],
      output: { assetFileNames: 'assets/[name]-[hash][extname]' }
    },
    cssCodeSplit: true
  }
})
`;

const tplReadme = (ns: string, route: string) => `# ${ns} (Remote Module)

- Route: \`${route}\`
- i18n Namespace: \`${ns}\`

## Build
\`\`\`bash
pnpm build
\`\`\`

## Deploy
Kopiere \`dist/\` nach \`/public/modules/${ns}/<version>/\` und ergänze \`/public/modules/index.json\`.
`;

// ---------------------------------------

export async function scaffoldModule(opts: ScaffoldOptions) {
  const name = toKebab(opts.name);
  const ns = opts.namespace || name;
  const route = opts.route || `/${name}`;
  const title = opts.title || toPascal(name);
  const asPackage = !!opts.asPackage;
  const modulesDir = opts.modulesDir ?? "public/modules";

  // Zielpfad (default)
  const target = opts.target
    ? opts.target
    : asPackage
    ? join(opts.hostDir, "modules", name) // eigenes Paket im Repo (flexibel)
    : join(opts.hostDir, "src", "modules", name); // in-host Entwicklung

  // Basisordner
  const srcDir = join(target, "src");
  const layoutsDir = join(srcDir, "layouts");
  const viewsDir = join(srcDir, "views");
  const localesDir = join(srcDir, "locales");

  await ensureDir(srcDir);
  await ensureDir(layoutsDir);
  await ensureDir(viewsDir);
  await ensureDir(localesDir);

  // Dateien schreiben
  const layoutName = name;
  const writes = await Promise.all([
    safeWrite(
      join(srcDir, "public-entry.ts"),
      tplPublicEntry(ns, route, layoutName),
      opts.force
    ),
    safeWrite(
      join(layoutsDir, `${layoutName}.layout.vue`),
      tplLayout(title),
      opts.force
    ),
    safeWrite(join(viewsDir, "index.view.vue"), tplView(ns), opts.force),
    safeWrite(join(localesDir, "de.json"), tplDe(ns), opts.force),
    safeWrite(join(localesDir, "en.json"), tplEn(ns), opts.force),
    safeWrite(join(srcDir, "style.css"), tplStyle, opts.force),
  ]);

  // Als eigenes Package: zusätzliche Projektdateien
  if (asPackage) {
    const pkgName = opts.pkgName || name;
    await Promise.all([
      safeWrite(
        join(target, "package.json"),
        tplPkgJson(pkgName, ns),
        opts.force
      ),
      safeWrite(join(target, "tsconfig.json"), tplTsconfig, opts.force),
      safeWrite(join(target, "vite.config.ts"), tplViteConfig, opts.force),
      safeWrite(join(target, "README.md"), tplReadme(ns, route), opts.force),
      ensureDir(join(target, "dist")), // für IDE Ruhe
    ]);
  }

  // Optional: Manifest im Host ergänzen (Dev-Entry)
  if (opts.manifest && !asPackage) {
    const devEntry = posix
      .join("/src/modules", name, "src/public-entry.ts")
      .replace(/\\/g, "/");
    await generateIndex({
      hostDir: opts.hostDir,
      modulesDir,
      write: true,
      devEntries: { [ns]: devEntry },
    });
  }

  return {
    target,
    created: writes.filter(Boolean).length,
    devEntry: !asPackage ? `/src/modules/${name}/src/public-entry.ts` : null,
  };
}
