import fsp from "node:fs/promises";
import { dirname, join } from "node:path";

export async function exists(p: string) {
    try {
        await fsp.access(p);
        return true;
    } catch {
        return false;
    }
}

export async function ensureDir(dir: string) {
    await fsp.mkdir(dir, { recursive: true });
}

export async function writeJsonPretty(file: string, data: unknown) {
    await ensureDir(dirname(file));
    await fsp.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function copyDir(src: string, dest: string) {
    // Node 18+: fsp.cp vorhanden
    // @ts-ignore
    if (typeof (fsp as any).cp === "function") {
        // @ts-ignore
        await (fsp as any).cp(src, dest, { recursive: true });
        return;
    }
    await ensureDir(dest);
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const e of entries) {
        const s = join(src, e.name);
        const d = join(dest, e.name);
        if (e.isDirectory()) await copyDir(s, d);
        else await fsp.copyFile(s, d);
    }
}
