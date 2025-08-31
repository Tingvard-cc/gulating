// src/app/api/gov-actions/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";

/* ---------------- Votes helpers ---------------- */
type VotesFile = {
    [proposalId: string]: {
        [memberHash: string]: "yes" | "no" | "abstain" | "not-voted";
    };
};

const votesFilePath = path.join(process.cwd(), "data", "votes.json");

async function ensureVotesFile(): Promise<VotesFile> {
    try {
        await fs.mkdir(path.dirname(votesFilePath), { recursive: true });
        const fileContent = await fs.readFile(votesFilePath, "utf-8");
        return fileContent ? (JSON.parse(fileContent) as VotesFile) : {};
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            await fs.writeFile(votesFilePath, JSON.stringify({}));
            return {};
        }
        console.error("Error reading or creating votes.json:", error);
        return {};
    }
}

/* ---------------- Signature helpers ---------------- */
const BASE_DIR =
    process.env.SIGNATURES_DIR ||
    path.join(process.cwd(), "storage", "signatures");

const safeSegment = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_");

const SignaturePayloadSchema = z.object({
    type: z.string(),
    description: z.string(),
    govActionID: z.string().min(1),
    voterKeyHash: z.string().min(1),
    cborHex: z.string().min(1),
});

const SignatureEnvelopeSchema = z.object({
    filename: z.string().min(1),
    govActionID: z.string().min(1),
    data: SignaturePayloadSchema,
});

const VotesEnvelopeSchema = z.object({
    proposalId: z.string().min(1),
    votes: z.record(
        z.string(),
        z.enum(["yes", "no", "abstain", "not-voted"])
    ),
});

async function storeSignatureOnDisk(
    envelope: z.infer<typeof SignatureEnvelopeSchema>
) {
    const { filename, govActionID, data } = envelope;

    if (data.govActionID !== govActionID) {
        throw new Error("govActionID mismatch between payload and envelope");
    }

    const safeGov = safeSegment(govActionID);
    const safeFile = safeSegment(filename);

    const folder = path.join(BASE_DIR, safeGov);
    await fs.mkdir(folder, { recursive: true });

    const jsonString = JSON.stringify(data, null, 2);
    let filePath = path.join(folder, safeFile);

    try {
        await fs.writeFile(filePath, jsonString, { flag: "wx" });
    } catch (e: any) {
        if (e?.code === "EEXIST") {
            const extIndex = safeFile.lastIndexOf(".");
            const ts = Date.now();
            const uniqueName =
                extIndex > 0
                    ? `${safeFile.slice(0, extIndex)}-${ts}${safeFile.slice(extIndex)}`
                    : `${safeFile}-${ts}`;
            filePath = path.join(folder, uniqueName);
            await fs.writeFile(filePath, jsonString, { flag: "wx" });
        } else {
            throw e;
        }
    }

    return filePath;
}

/* ---------------- Koios fetch helper ---------------- */
async function koiosRequest(
    url: string,
    {
        attempts = 4,
        timeoutMs = 12_000,
        baseDelayMs = 400,
        headers = {},
    }: {
        attempts?: number;
        timeoutMs?: number;
        baseDelayMs?: number;
        headers?: Record<string, string>;
    } = {}
) {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                headers: { Accept: "application/json", ...headers },
                cache: "no-store",
                signal: controller.signal,
            });
            const text = await res.text();

            if (!res.ok) {
                const status = res.status;
                const retryAfter = Number(res.headers.get("retry-after")) || 0;
                lastErr = { status, statusText: res.statusText, text };
                clearTimeout(t);
                if (status >= 500 || status === 429 || status === 408) {
                    if (i < attempts - 1) {
                        const jitter = Math.random() * 200;
                        const delay =
                            (retryAfter ? retryAfter * 1000 : baseDelayMs * 2 ** i) + jitter;
                        await new Promise((r) => setTimeout(r, delay));
                        continue;
                    }
                }
                return { ok: false, status, bodyText: text };
            }

            let json: any = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                lastErr = { parseError: true, text };
                clearTimeout(t);
                if (i < attempts - 1) continue;
                return {
                    ok: false,
                    status: 502,
                    bodyText: "Invalid JSON from upstream",
                };
            }
            clearTimeout(t);
            return { ok: true, json };
        } catch (e: any) {
            lastErr = e;
            clearTimeout(t);
            if (i < attempts - 1) {
                const jitter = Math.random() * 200;
                const delay = baseDelayMs * 2 ** i + jitter;
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
        }
    }
    return {
        ok: false,
        status: 502,
        bodyText:
            typeof lastErr === "object"
                ? JSON.stringify(lastErr).slice(0, 500)
                : String(lastErr),
    };
}

/* ---------------- API Handlers ---------------- */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    // (A) download stored .witness file
    if (searchParams.get("download") === "1") {
        const govActionID = searchParams.get("govActionID") || "";
        const filename = searchParams.get("filename") || "";
        if (!govActionID || !filename) {
            return NextResponse.json(
                { message: "govActionID and filename are required for download." },
                { status: 400 }
            );
        }
        try {
            const safeGov = safeSegment(govActionID);
            const safeFile = safeSegment(filename);
            const filePath = path.join(BASE_DIR, safeGov, safeFile);
            const buf = await fs.readFile(filePath);
            return new Response(buf, {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": `attachment; filename="${safeFile}"`,
                    "Cache-Control": "no-store",
                },
            });
        } catch (e: any) {
            const code = e?.code === "ENOENT" ? 404 : 500;
            return NextResponse.json(
                { message: code === 404 ? "File not found" : "Failed to read file" },
                { status: code }
            );
        }
    }

    // (B) get votes for a proposal
    const proposalId = searchParams.get("proposalId");
    if (proposalId) {
        const allVotes = await ensureVotesFile();
        const proposalVotes = allVotes[proposalId] || {};
        return NextResponse.json(proposalVotes, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        });
    }

    // (C) fetch proposals from Koios with retries/backoff
    try {
        const KOIOS =
            process.env.KOIOS_API_URL?.replace(/\/+$/, "") ||
            "https://api.koios.rest/api/v1";
        const extraHeaders: Record<string, string> = {};
        if (process.env.KOIOS_API_TOKEN) {
            extraHeaders.Authorization = `Bearer ${process.env.KOIOS_API_TOKEN}`;
        }

        const tipRes = await koiosRequest(`${KOIOS}/tip`, {
            headers: extraHeaders,
        });
        if (!tipRes.ok) {
            return NextResponse.json(
                {
                    error: "Koios /tip failed",
                    status: tipRes.status,
                    bodySnippet: tipRes.bodyText?.slice(0, 500),
                },
                { status: 502 }
            );
        }
        const currentEpoch = Number(tipRes.json?.[0]?.epoch_no);
        if (!Number.isFinite(currentEpoch)) {
            return NextResponse.json(
                { error: "Could not determine current epoch", tipJson: tipRes.json },
                { status: 502 }
            );
        }

        const propRes = await koiosRequest(`${KOIOS}/proposal_list`, {
            headers: extraHeaders,
        });
        if (!propRes.ok) {
            const status = propRes.status || 502;
            return NextResponse.json(
                {
                    error: "Upstream Koios error (/proposal_list)",
                    status,
                    bodySnippet: propRes.bodyText?.slice(0, 500),
                },
                { status: status === 429 ? 429 : 502 }
            );
        }

        const raw = Array.isArray(propRes.json) ? propRes.json : [];
        const proposals = raw
            .filter(
                (p: any) =>
                    p &&
                    p.dropped_epoch == null &&
                    p.ratified_epoch == null &&
                    p.enacted_epoch == null &&
                    (p.expired_epoch == null || Number(p.expired_epoch) > currentEpoch)
            )
            .map((p: any) => ({
                title: p.meta_json?.body?.title ?? null,
                proposal_id: p.proposal_id,
                tx_hash: p.proposal_tx_hash,
                creation_time: p.block_time,
                submitted_epoch: p.proposed_epoch,
                expiration: p.expiration,
                metadata_url: p.meta_url ?? null,
            }));

        return NextResponse.json(proposals, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            },
        });
    } catch (err: any) {
        console.error("Koios branch error:", err);
        return NextResponse.json(
            { error: "Internal fetch error" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // (A) signature storage
        const sigParse = SignatureEnvelopeSchema.safeParse(body);
        if (sigParse.success) {
            try {
                const storedPath = await storeSignatureOnDisk(sigParse.data);
                return NextResponse.json(
                    { message: "Signature stored.", storedAt: storedPath },
                    { status: 201, headers: { "Cache-Control": "no-store" } }
                );
            } catch (e: any) {
                console.error("Signature storage failed:", e);
                return NextResponse.json(
                    { message: e?.message || "Failed to store signature." },
                    { status: 500, headers: { "Cache-Control": "no-store" } }
                );
            }
        }

        // (B) votes save
        const votesParse = VotesEnvelopeSchema.safeParse(body);
        if (votesParse.success) {
            const { proposalId, votes } = votesParse.data;
            const allVotes = await ensureVotesFile();
            allVotes[proposalId] = votes;
            await fs.writeFile(votesFilePath, JSON.stringify(allVotes, null, 2));
            return NextResponse.json(
                { message: "Votes saved successfully." },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            {
                message:
                    "Invalid POST body. Expected either { filename, govActionID, data:{...} } for signature storage, or { proposalId, votes } for saving votes.",
            },
            { status: 400, headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Failed to process POST request:", error);
        return NextResponse.json(
            { message: "Failed to process request." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
