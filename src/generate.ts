import fsp from "node:fs/promises";
import { join, posix } from "node:path";
import { exists, writeJsonPretty } from "./utils/fs.js";

export type RemoteModuleRef = {
    name: string;
    version: string;
    baseUrl?: string;
    entry?: string;
    styles?: string[];
    entryDev?: string;
    spec?: string;
    prefer?: "dev" | "url" | "spec";
};

export type GenerateOptions = {
    hostDir: string;
    modulesDir?: string;
    write?: boolean;
    devEntries?: Record<string, string>;
    specEntries?: Record<string, string>;
};

export async function generateIndex(opts: GenerateOptions) {
    const hostDir = opts.hostDir;
    const modulesDir = opts.modulesDir ?? "public/modules";
    const absModules = join(hostDir, modulesDir);
    const refs: RemoteModuleRef[] = [];

    // 1) Drop-ins scannen
    if (await exists(absModules)) {
        const moduleNames = await fsp.readdir(absModules).catch(() => []);
        for (const name of moduleNames) {
            const base = join(absModules, name);
            const versions = await fsp.readdir(base).catch(() => []);
            for (const version of versions) {
                const verDir = join(base, version);
                const indexPath = join(verDir, "index.js");
                try {
                    await fsp.access(indexPath);
                } catch {
                    continue;
                }

                let styles: string[] = [];
                try {
                    await fsp.access(join(verDir, "style.css"));
                    styles.push("style.css");
                } catch {}

                try {
                    const mf = JSON.parse(
                        await fsp.readFile(
                            join(verDir, "manifest.json"),
                            "utf8"
                        )
                    );
                    if (Array.isArray(mf.styles)) styles = mf.styles;
                } catch {}

                refs.push({
                    name,
                    version,
                    baseUrl: posix.join(
                        "/",
                        modulesDir.replace(/\\/g, "/"),
                        name,
                        version,
                        "/"
                    ),
                    entry: "index.js",
                    styles,
                });
            }
        }
    }

    // 2) Dev
    for (const [name, entryDev] of Object.entries(opts.devEntries ?? {})) {
        refs.push({ name, version: "dev", entryDev, prefer: "dev" });
    }

    // 3) Spec
    for (const [name, spec] of Object.entries(opts.specEntries ?? {})) {
        const m = /@([^@]+)@(.+)$/.exec(spec);
        const version = m ? m[2] : "latest";
        refs.push({ name, version, spec, prefer: "spec" });
    }

    const indexFile = join(absModules, "index.json");
    if (opts.write !== false) await writeJsonPretty(indexFile, refs);

    return { refs, indexFile };
}
