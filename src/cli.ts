#!/usr/bin/env node
import { resolve, join } from "node:path";
import { generateIndex } from "./generate.js";
import { publish } from "./publish.js";
import { scaffoldModule } from "./scaffold.js";

function parseArgs(argv: string[]) {
    const args = {
        _: [] as string[],
        flags: new Map<string, string | boolean>(),
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const [k, v] = a.slice(2).split("=");
            if (v !== undefined) args.flags.set(k, v);
            else if (i + 1 < argv.length && !argv[i + 1].startsWith("-"))
                args.flags.set(k, argv[++i]);
            else args.flags.set(k, true);
        } else if (a.startsWith("-")) {
            args.flags.set(a.replace(/^-+/, ""), true);
        } else {
            args._.push(a);
        }
    }
    return args;
}

function help() {
    console.log(`
Usage: srm <command> [options]

Commands:
  generate          Scannt /public/modules und erzeugt index.json (plus optional Dev/Spec)
  publish           Spiegelt installierte Pakete mit remoteModule-Metadaten und aktualisiert index.json
  scaffold [name]   Erstellt ein Modul-Grundgerüst (in-host oder als eigenes Package)

Global Options:
  --host <path>              Wurzel des Host-Projekts (default: .)
  --modules-dir <path>       Ordner für Module relativ zu --host (default: public/modules)

generate Options:
  --dev name=entryDev        Dev-Eintrag hinzufügen (kann mehrfach)
  --spec name=specifier      Spec/CDN-Eintrag hinzufügen (kann mehrfach)
  --dry                      Nur ausgeben, nicht schreiben

publish Options:
  --packages <list>          Kommagetrennte Liste von Paketnamen
  --all                      Alle Pakete in node_modules prüfen (langsamer)

scaffold Options:
  --name <modulname>         Name, falls nicht als Positional angegeben
  --as-package               Als eigenständiges npm-Package scaffolden
  --target <dir>             Zielpfad (default: src/modules/<name> bzw. modules/<name>)
  --route </pfad>            Basisroute (default: /<name>)
  --namespace <ns>           i18n Namespace (default: <name>)
  --title <Titel>            Titel im Layout (default: PascalCase(Name))
  --pkg-name <name>          package.json name (nur mit --as-package)
  --manifest                 /public/modules/index.json nach Scaffold aktualisieren (Dev-Entry)
  --force                    Vorhandene Dateien überschreiben
`);
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || ["-h", "--help", "help"].includes(argv[0]))
        return help();
    const { _, flags } = parseArgs(argv);
    const cmd = _[0];

    const hostDir = resolve(
        process.cwd(),
        (flags.get("host") as string) || "."
    );
    const modulesDir = (flags.get("modules-dir") as string) || "public/modules";

    if (cmd === "generate") {
        const devEntries: Record<string, string> = {};
        const specs: Record<string, string> = {};
        for (const [k, v] of flags.entries()) {
            if (k === "dev") {
                const [name, entryDev] = String(v).split("=");
                if (name && entryDev) devEntries[name] = entryDev;
            } else if (k === "spec") {
                const [name, spec] = String(v).split("=");
                if (name && spec) specs[name] = spec;
            }
        }
        const write = !flags.has("dry");
        const { refs, indexFile } = await generateIndex({
            hostDir,
            modulesDir,
            devEntries,
            specEntries: specs,
            write,
        });
        console.log(
            JSON.stringify({ indexFile, count: refs.length, refs }, null, 2)
        );
        return;
    }

    if (cmd === "publish") {
        const pkgs = (flags.get("packages") as string | undefined)
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const all = flags.has("all");
        const { published } = await publish({
            hostDir,
            modulesDir,
            packages: pkgs,
            all,
        });
        console.log(JSON.stringify({ published }, null, 2));
        return;
    }

    if (cmd === "scaffold") {
        const name = (_[1] as string) || (flags.get("name") as string);
        if (!name) {
            console.error(
                "Fehlender Modulname. Nutze: srm scaffold <name> [--as-package] [...]"
            );
            process.exit(1);
        }
        const res = await scaffoldModule({
            hostDir,
            name,
            target: flags.get("target") as string | undefined,
            asPackage: !!flags.get("as-package"),
            route: flags.get("route") as string | undefined,
            namespace: flags.get("namespace") as string | undefined,
            title: flags.get("title") as string | undefined,
            pkgName: flags.get("pkg-name") as string | undefined,
            manifest: !!flags.get("manifest"),
            modulesDir,
            force: !!flags.get("force"),
        });
        console.log(JSON.stringify(res, null, 2));
        return;
    }

    return help();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
