import { NextResponse } from "next/server";
import fs from "fs/promises";
import fscb from "fs";
import path from "path";

export const dynamic = "force-dynamic";

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
        const abs = safeJoin(base, rel);

        const stat = await fs.stat(abs);
        if (!stat.isFile()) {
            return NextResponse.json({ error: "Not a file" }, { status: 400 });
        }

        const stream = fscb.createReadStream(abs);
        const fileName = path.basename(abs);

        return new Response(stream as unknown as ReadableStream, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
    }
}
