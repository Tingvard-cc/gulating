import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type Entry = {
    name: string;
    path: string; // relative to root
    isDir: boolean;
    size: number | null;
    mtime: string;
};

function getBaseDir(): string {
    const base = process.env.FILES_BASE_DIR;
    if (!base) throw new Error("FILES_BASE_DIR is not set");
    return base;
}

function safeJoin(base: string, rel: string) {
    const resolved = path.resolve(base, rel || ".");
    if (!resolved.startsWith(path.resolve(base))) {
        throw new Error("Path traversal detected");
    }
    return resolved;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rel = searchParams.get("path") ?? "";
        const base = getBaseDir();
        const target = safeJoin(base, rel);

        const stat = await fs.stat(target);
        if (!stat.isDirectory()) {
            return NextResponse.json(
                { error: "Not a directory" },
                { status: 400 }
            );
        }

        const names = await fs.readdir(target);
        const entries: Entry[] = [];

        for (const name of names) {
            try {
                const abs = path.join(target, name);
                const s = await fs.stat(abs);
                const isDir = s.isDirectory();
                entries.push({
                    name,
                    path: path.posix.join(rel.replaceAll("\\", "/"), name),
                    isDir,
                    size: isDir ? null : s.size,
                    mtime: s.mtime.toISOString(),
                });
            } catch {
                // ignore unreadable entries
            }
        }

        // Folders first, then files, then alphabetical
        entries.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });

        return NextResponse.json({ entries, cwd: rel });
    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
    }
}
