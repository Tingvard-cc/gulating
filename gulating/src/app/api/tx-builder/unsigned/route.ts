export const runtime = "nodejs";

import { NextResponse } from "next/server";

/** Load CSL (the browser WASM build works fine in Next.js node runtime) */
async function loadCSL() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await import("@emurgo/cardano-serialization-lib-browser");
}

const hexToBytes = (hex: string) =>
    Uint8Array.from(Buffer.from(hex.replace(/^0x/i, ""), "hex"));
const bytesToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

type UTxOIn = {
    txHash: string;       // 64-hex
    outputIndex: number;  // integer
    amount: string;       // lovelace (string)
    address?: string;     // bech32 (preferred — used to derive payment key hash)
};

type BodyIn = {
    govActionId: string;                // hash, hash#index, gov_action1..., URL, etc.
    vote: "yes" | "no" | "abstain";
    voterKeyHash: string;               // 56-hex CC hot-key hash (ed25519 key hash)
    changeAddress?: string;             // bech32 (fallback for inputs missing address)
    utxos: UTxOIn[];
    anchor?: {
        url: string;          // ipfs://CID (points to your JSON rationale)
        dataHashHex: string;  // 64-hex Blake2b-256 of EXACT JSON bytes stored at that IPFS URL
    };
};

/** Resolve any govActionId string to {hash,index} */
async function resolveGovActionStringToHashIndex(raw: string): Promise<{ hash: string; index: number; resolvedFrom: string }> {
    const s = (raw || "").trim();

    // 1) Exact "<64-hex>#<n>" or "<64-hex>"
    let m = s.match(/^([0-9a-fA-F]{64})(?:#(\d+))?$/);
    if (m) {
        const [, h, idxStr] = m;
        return { hash: h.toLowerCase(), index: idxStr ? Number(idxStr) : 0, resolvedFrom: "direct-hex" };
    }

    // 2) Bech32 governance action id (gov_action1...)
    if (/^gov_action1[0-9a-z]+$/.test(s)) {
        const r = await fetch("https://api.koios.rest/api/v1/proposal_list", {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });
        if (!r.ok) {
            const t = await r.text().catch(() => "");
            throw new Error(`Koios proposal_list failed: ${r.status} ${r.statusText}${t ? ` — ${t}` : ""}`);
        }
        const list = (await r.json()) as any[];
        const entry = list.find((p) => p?.proposal_id === s);
        if (!entry) throw new Error(`Proposal not found for ${s} on Koios proposal_list`);

        const hash =
            entry.proposal_tx_hash ||
            entry.gov_action_tx_hash ||
            entry.tx_hash ||
            entry.proposal_txs?.[0] ||
            null;

        const index =
            entry.gov_action_ix ??
            entry.governance_action_index ??
            entry.action_index ??
            entry.proposed_index ??
            0;

        if (!hash || !/^[0-9a-fA-F]{64}$/.test(String(hash))) {
            throw new Error(`Could not resolve tx hash from Koios for ${s}`);
        }
        return { hash: String(hash).toLowerCase(), index: Number(index) || 0, resolvedFrom: "koios:proposal_list" };
    }

    // 3) Any text/URL containing a 64-hex (first match) with optional "#<n>"
    const hexMatch = s.match(/([0-9a-fA-F]{64})/);
    if (hexMatch) {
        const hash = hexMatch[1];
        const after = s.slice(s.indexOf(hash) + hash.length);
        const idxMatch = after.match(/#(\d+)/);
        const index = idxMatch ? Number(idxMatch[1]) : 0;
        return { hash: hash.toLowerCase(), index, resolvedFrom: "loose-string" };
    }

    throw new Error(
        `Could not find a 64-hex tx id anywhere in govActionId. Received: ${raw.substring(0, 200)}`
    );
}

/** Extract payment key hash from bech32 address (base / enterprise / pointer) */
function paymentKeyHashFromBech32(CSL: any, bech32: string): any | undefined {
    const addr = CSL.Address.from_bech32(bech32);
    const base = CSL.BaseAddress.from_address(addr);
    if (base) return base.payment_cred().to_keyhash() ?? undefined;
    const ent = CSL.EnterpriseAddress.from_address(addr);
    if (ent) return ent.payment_cred().to_keyhash() ?? undefined;
    const ptr = CSL.PointerAddress.from_address(addr);
    if (ptr) return ptr.payment_cred().to_keyhash() ?? undefined;
    return undefined;
}

/**
 * Construct a VotingProcedure, trying MANY API shapes across CSL versions:
 * - With a Vote object (functions OR plain properties)
 * - With specialized VotingProcedure.new_yes/new_yes_with_anchor, etc.
 * - With signatures that accept (vote) or (vote, anchor)
 */
function makeVotingProcedure(CSL: any, choice: "yes" | "no" | "abstain", anchor?: { url: string; hashHex: string }) {
    const VP = CSL.VotingProcedure;
    const Vote = CSL.Vote;

    // Build optional anchor
    const mkAnchor = () => {
        if (!anchor) return null;
        const url = CSL.URL.new(anchor.url);
        const aHash = CSL.AnchorDataHash.from_bytes(hexToBytes(anchor.hashHex));
        return CSL.Anchor.new(url, aHash);
    };
    const anc = mkAnchor();

    // 1) Try via Vote object (function or property)
    if (Vote) {
        // Grab candidate vote values:
        const getVoteValue = (k: "yes" | "no" | "abstain") => {
            const candidates = [
                () => typeof Vote[k] === "function" ? Vote[k]() : undefined,    // e.g., Vote.yes()
                () => (Vote[`new_${k}`] && typeof Vote[`new_${k}`] === "function") ? Vote[`new_${k}`]() : undefined, // Vote.new_yes()
                () => (Vote[k] && typeof Vote[k] !== "function") ? Vote[k] : undefined, // Vote.yes (value/enum)
            ];
            for (const fn of candidates) {
                try {
                    const v = fn();
                    if (v) return v;
                } catch {/* ignore */ }
            }
            return undefined;
        };

        const voteVal = getVoteValue(choice);
        if (voteVal) {
            // Try VotingProcedure constructors that accept a Vote object
            const combos = [
                () => (anc && typeof VP?.new_with_anchor === "function") ? VP.new_with_anchor(voteVal, anc) : undefined,
                () => (typeof VP?.new === "function" && anc) ? VP.new(voteVal, anc as any) : undefined, // some builds accept (vote, anchor)
                () => (typeof VP?.new === "function" && !anc) ? VP.new(voteVal) : undefined,
            ];
            for (const build of combos) {
                try {
                    const vp = build();
                    if (vp) return vp;
                } catch {/* try next */ }
            }
        }
    }

    // 2) Fallback: specialized VotingProcedure static constructors (with/without anchor)
    const name = choice; // "yes" | "no" | "abstain"
    const withAnchorName = `new_${name}_with_anchor`;
    const plainName = `new_${name}`;

    if (anc && typeof VP?.[withAnchorName] === "function") {
        return VP[withAnchorName](anc);
    }
    if (!anc && typeof VP?.[plainName] === "function") {
        return VP[plainName]();
    }

    // 3) Last-resort: maybe there are non "new_" variants like yes_with_anchor / yes
    const legacyWithAnchor = `${name}_with_anchor`;
    const legacyPlain = name;

    if (anc && typeof VP?.[legacyWithAnchor] === "function") {
        return VP[legacyWithAnchor](anc);
    }
    if (!anc && typeof VP?.[legacyPlain] === "function") {
        return VP[legacyPlain]();
    }

    // If we’re here, this CSL build is too old for voting OR exported under unexpected names.
    const debug = {
        Vote_keys: Vote ? Object.keys(Vote) : "missing",
        VotingProcedure_keys: VP ? Object.keys(VP) : "missing",
    };
    throw new Error(`Could not construct VotingProcedure with this CSL version. Debug: ${JSON.stringify(debug)}`);
}

export async function POST(req: Request) {
    try {
        const body: BodyIn = await req.json();

        // ---- Basic validation ----
        if (!body.govActionId) {
            return NextResponse.json({ error: "Missing govActionId" }, { status: 400 });
        }
        if (!/^(yes|no|abstain)$/.test(body.vote)) {
            return NextResponse.json({ error: "vote must be 'yes' | 'no' | 'abstain'" }, { status: 400 });
        }
        if (!/^[0-9a-fA-F]{56}$/.test(body.voterKeyHash)) {
            return NextResponse.json(
                { error: "voterKeyHash must be a 28-byte ed25519 key hash (56 hex chars)" },
                { status: 400 }
            );
        }
        if (!Array.isArray(body.utxos) || body.utxos.length === 0) {
            return NextResponse.json({ error: "Missing utxos" }, { status: 400 });
        }

        // Optional anchor (IPFS JSON with precomputed hash)
        let anchorArg: { url: string; hashHex: string } | undefined;
        if (body.anchor) {
            const { url, dataHashHex } = body.anchor;
            if (!/^ipfs:\/\//i.test(url)) {
                return NextResponse.json({ error: "anchor.url must start with ipfs://" }, { status: 400 });
            }
            if (!/^[0-9a-fA-F]{64}$/.test(dataHashHex)) {
                return NextResponse.json(
                    { error: "anchor.dataHashHex must be a 32-byte (64-hex) Blake2b-256 of the EXACT JSON bytes at the URL" },
                    { status: 400 }
                );
            }
            anchorArg = { url, hashHex: dataHashHex.toLowerCase() };
        }

        const CSL = await loadCSL();

        // ---- Resolve gov action: allow bech32 gov_action1... via Koios ----
        const resolved = await resolveGovActionStringToHashIndex(body.govActionId);
        const txId = CSL.TransactionHash.from_bytes(hexToBytes(resolved.hash));
        const actionId = CSL.GovernanceActionId.new(txId, resolved.index);

        // ---- Protocol params (tune as desired for your net) ----
        const linearFee = CSL.LinearFee.new(
            CSL.BigNum.from_str("44"),      // fee_a
            CSL.BigNum.from_str("155381")   // fee_b
        );
        const coinsPerUtxoByte = CSL.BigNum.from_str("4310");
        const keyDeposit = CSL.BigNum.from_str("2000000");
        const poolDeposit = CSL.BigNum.from_str("500000000");
        const maxTxSize = 16384;
        const maxValueSize = 5000;

        const builderCfg = CSL.TransactionBuilderConfigBuilder.new()
            .fee_algo(linearFee)
            .coins_per_utxo_byte(coinsPerUtxoByte)
            .key_deposit(keyDeposit)
            .pool_deposit(poolDeposit)
            .max_tx_size(maxTxSize)
            .max_value_size(maxValueSize)
            .build();

        const txBuilder = CSL.TransactionBuilder.new(builderCfg);

        // ---- Add inputs (new API: add_key_input) ----
        let totalIn = 0n;
        for (const u of body.utxos) {
            if (!/^[0-9a-fA-F]{64}$/.test(u.txHash)) {
                return NextResponse.json({ error: "Invalid utxo txHash", detail: u }, { status: 400 });
            }
            const bech = u.address || body.changeAddress;
            if (!bech) {
                return NextResponse.json(
                    { error: "Each input needs an address or provide changeAddress" },
                    { status: 400 }
                );
            }
            const payKeyHash = paymentKeyHashFromBech32(CSL, bech);
            if (!payKeyHash) {
                return NextResponse.json(
                    { error: "Unable to derive payment key hash from address", detail: { address: bech } },
                    { status: 400 }
                );
            }

            const inHash = CSL.TransactionHash.from_bytes(hexToBytes(u.txHash));
            const input = CSL.TransactionInput.new(inHash, Number(u.outputIndex));
            const value = CSL.Value.new(CSL.BigNum.from_str(String(u.amount)));
            txBuilder.add_key_input(payKeyHash, input, value);
            totalIn += BigInt(u.amount);
        }

        if (totalIn === 0n) {
            return NextResponse.json(
                { error: "Insufficient input in transaction", detail: "No ADA in provided utxos" },
                { status: 400 }
            );
        }

        // ---- Required signers: CC hot key + (optionally) change payment key ----
        const ccHot = CSL.Ed25519KeyHash.from_bytes(hexToBytes(body.voterKeyHash));
        txBuilder.add_required_signer(ccHot);

        const changeAddrBech = body.changeAddress || body.utxos[0].address || "";
        if (!changeAddrBech) {
            return NextResponse.json(
                { error: "Missing changeAddress (and inputs lacked addresses)" },
                { status: 400 }
            );
        }
        const changeAddr = CSL.Address.from_bech32(changeAddrBech);

        const maybePayKeyHash = paymentKeyHashFromBech32(CSL, changeAddrBech);
        if (maybePayKeyHash) txBuilder.add_required_signer(maybePayKeyHash);

        // Let builder compute fee & add change
        txBuilder.add_change_if_needed(changeAddr);

        // ---- Build body ----
        const bodyBuilt = txBuilder.build();

        // ---- Voting (constitutional committee hot key + optional IPFS anchor) ----
        const vp = makeVotingProcedure(CSL, body.vote, anchorArg);

        const perAction = CSL.VotingProceduresEntry.new();
        perAction.insert(actionId, vp);

        let voter: any;
        if (typeof CSL.Voter?.constitutional_committee_hot_key === "function") {
            voter = CSL.Voter.constitutional_committee_hot_key(ccHot);
        } else if (typeof CSL.Voter?.new_constitutional_committee_hot_key === "function") {
            voter = CSL.Voter.new_constitutional_committee_hot_key(ccHot);
        } else {
            return NextResponse.json(
                { error: "CSL Voter.cc hot key constructor not found; upgrade CSL." },
                { status: 500 }
            );
        }

        const votingProcedures = CSL.VotingProcedures.new();
        votingProcedures.insert(voter, perAction);

        if (typeof bodyBuilt.set_voting_procedures === "function") {
            bodyBuilt.set_voting_procedures(votingProcedures);
        } else {
            return NextResponse.json(
                { error: "TxBody#set_voting_procedures not available; upgrade CSL." },
                { status: 500 }
            );
        }

        // ---- Final unsigned tx ----
        const emptyWits = CSL.TransactionWitnessSet.new();
        const tx = CSL.Transaction.new(bodyBuilt, emptyWits, undefined);

        const unsignedHex = bytesToHex(tx.to_bytes());
        const short = `${resolved.hash.slice(0, 8)}#${resolved.index}`;
        const filename = `vote-cc-${short}.unsigned`;

        return NextResponse.json(
            { unsignedCborHex: unsignedHex, filename, resolved },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err: any) {
        console.error("Unsigned build failed:", err);
        return NextResponse.json(
            { error: "Failed to build unsigned transaction", detail: err?.message || String(err) },
            { status: 500 }
        );
    }
}
