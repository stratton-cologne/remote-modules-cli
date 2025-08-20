import fsp from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { copyDir, ensureDir, writeJsonPretty, exists } from "./utils/fs.js";
import { generateIndex } from "./generate.js";

export type PublishOptions = {
    hostDir: string;
    modulesDir?: string;
    packages?: string[];
    all?: boolean;
};

type RemoteMeta = {
    name: string;
    entry: string;
    styles?: string[];
    assets?: string;
};

export async function publish(opts: PublishOptions) {
    const hostDir = opts.hostDir;
    const modulesDir = opts.modulesDir ?? "public/modules";
    const absModules = join(hostDir, modulesDir);
    await ensureDir(absModules);

    const nodeModules = join(hostDir, "node_modules");
    const selected = new Set<string>(opts.packages ?? []);

    if (opts.all) {
        const top = await fsp.readdir(nodeModules).catch(() => []);
        for (const entry of top) {
            if (entry.startsWith(".")) continue;
            if (entry.startsWith("@")) {
                const scopeDir = join(nodeModules, entry);
                const scoped = await fsp.readdir(scopeDir).catch(() => []);
                for (const p of scoped) selected.add(`${entry}/${p}`);
            } else {
                selected.add(entry);
            }
        }
    }

    const published: Array<{ name: string; version: string }> = [];

    for (const pkgName of selected) {
        const pkgJsonPath = join(nodeModules, pkgName, "package.json");
        let pkg: any;
        try {
            pkg = JSON.parse(await fsp.readFile(pkgJsonPath, "utf8"));
        } catch {
            continue;
        }
        if (!pkg?.remoteModule) continue;

        const version: string = pkg.version;
        const meta: RemoteMeta = pkg.remoteModule;
        const name = meta.name;

        const pkgRoot = dirname(pkgJsonPath);
        const distIndexSrc = join(pkgRoot, meta.entry);
        if (!(await exists(distIndexSrc))) continue;

        const targetDir = join(absModules, name, version);
        await ensureDir(targetDir);

        await fsp.copyFile(distIndexSrc, join(targetDir, "index.js"));

        const styles: string[] = [];
        for (const s of meta.styles ?? []) {
            const from = join(pkgRoot, s);
            if (!(await exists(from))) continue;
            const fileName = basename(s);
            await fsp.copyFile(from, join(targetDir, fileName));
            styles.push(fileName);
        }

        if (meta.assets) {
            const assetsSrc = join(pkgRoot, meta.assets);
            if (await exists(assetsSrc)) {
                await copyDir(assetsSrc, join(targetDir, "assets"));
            }
        }

        const manifest = { name, version, entry: "index.js", styles };
        await writeJsonPretty(join(targetDir, "manifest.json"), manifest);

        published.push({ name, version });
    }

    await generateIndex({ hostDir, modulesDir, write: true });
    return { published };
}
