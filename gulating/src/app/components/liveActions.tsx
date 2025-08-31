"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import {
    Box,
    Typography,
    CircularProgress,
    Paper,
    Link,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";

export interface Proposal {
    proposal_id: string;
    tx_hash: string;
    creation_time: number;
    submitted_epoch: number;
    expiration: number;
    metadata_url?: string;
    title: string;
}

interface LiveActionsProps {
    onUpdate: (proposals: Proposal[]) => void;
}

/* ---------------- Epoch helpers ---------------- */
const GENESIS_DATE = new Date("2017-09-23T21:44:51Z"); // Cardano mainnet epoch 0
const MS_PER_EPOCH = 5 * 24 * 60 * 60 * 1000;

function computeEpochInfo(nowMs: number) {
    const elapsed = nowMs - GENESIS_DATE.getTime();
    const epoch = Math.floor(elapsed / MS_PER_EPOCH);
    const start = new Date(GENESIS_DATE.getTime() + epoch * MS_PER_EPOCH);
    const end = new Date(start.getTime() + MS_PER_EPOCH);
    return { epoch, start, end };
}

/* --------------- IPFS helpers ------------------ */
const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
];

function toGatewayUrl(ipfsUrl: string, gatewayRoot = IPFS_GATEWAYS[0]) {
    const path = ipfsUrl.replace(/^ipfs:\/\//i, "");
    return `${gatewayRoot}${path}`;
}

function resolveIpfsUrl(url?: string, gatewayRoot = IPFS_GATEWAYS[0]) {
    if (!url) return "";
    return url.startsWith("ipfs://") ? toGatewayUrl(url, gatewayRoot) : url;
}

async function fetchJsonWithIpfsFallback(url: string) {
    if (!url.startsWith("ipfs://")) {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to load: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""
                }`
            );
        }
        return res.json();
    }

    let lastErr: unknown = null;
    for (const gw of IPFS_GATEWAYS) {
        try {
            const resolved = toGatewayUrl(url, gw);
            const res = await fetch(resolved, { cache: "no-store" });
            if (!res.ok)
                throw new Error(`Gateway error: ${res.status} ${res.statusText}`);
            return res.json();
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error("Failed to fetch from IPFS gateways");
}

/* --------- Plain-text renderer for metadata ----- */
function isPrimitive(val: unknown) {
    return (
        typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean" ||
        val === null
    );
}

function MetadataBlock({
    value,
    level = 0,
    label,
}: {
    value: any;
    level?: number;
    label?: string;
}) {
    const indentSx = { ml: level * 2 };
    if (isPrimitive(value)) {
        return (
            <Typography
                variant="body2"
                sx={{ ...indentSx, mb: 0.5, whiteSpace: "pre-wrap" }}
            >
                {label ? <strong>{label}: </strong> : null}
                {String(value)}
            </Typography>
        );
    }

    if (Array.isArray(value)) {
        return (
            <Box sx={{ ...indentSx, mb: 0.5 }}>
                {label ? (
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>{label}:</strong>
                    </Typography>
                ) : null}
                {value.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 2 }}
                    >
                        (empty array)
                    </Typography>
                ) : (
                    value.map((item, idx) => (
                        <Fragment key={idx}>
                            <MetadataBlock
                                value={item}
                                level={level + 1}
                                label={`[${idx}]`}
                            />
                        </Fragment>
                    ))
                )}
            </Box>
        );
    }

    const entries = Object.entries(value ?? {});
    return (
        <Box sx={{ ...indentSx, mb: 0.5 }}>
            {label ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>{label}:</strong>
                </Typography>
            ) : null}
            {entries.length === 0 ? (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 2 }}
                >
                    (empty object)
                </Typography>
            ) : (
                entries.map(([k, v]) => (
                    <MetadataBlock key={k} value={v} level={level + 1} label={k} />
                ))
            )}
        </Box>
    );
}

/* ---------------- Component ---------------- */
export const LiveActions = ({ onUpdate }: LiveActionsProps) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
        null
    );
    const [metadata, setMetadata] = useState<any>(null);
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [metadataError, setMetadataError] = useState<string | null>(null);

    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    const { epoch: currentEpoch, start: epochStart, end: epochEnd } = useMemo(
        () => computeEpochInfo(nowMs),
        [nowMs]
    );

    const onUpdateRef = useRef(onUpdate);
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);

    // Poll Koios once on mount + every 5 minutes
    useEffect(() => {
        let alive = true;
        let inFlight = false;

        const fetchGovProposals = async () => {
            if (inFlight) return;
            inFlight = true;
            if (proposals.length === 0) setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/gov-actions", { cache: "no-store" });
                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    throw new Error(
                        `Failed to fetch governance proposals. ${response.status} ${response.statusText}${text ? ` — ${text}` : ""
                        }`
                    );
                }
                const data: Proposal[] = await response.json();
                if (!alive) return;
                setProposals(data);
            } catch (err: any) {
                if (!alive) return;
                setError(err?.message ?? "Unknown error");
                console.error(err);
            } finally {
                if (!alive) return;
                setIsLoading(false);
                inFlight = false;
            }
        };

        fetchGovProposals();
        const intervalId = setInterval(fetchGovProposals, 300000);
        return () => {
            alive = false;
            clearInterval(intervalId);
        };
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Call onUpdate when proposals change
    useEffect(() => {
        onUpdateRef.current?.(proposals);
    }, [proposals]);

    const handleOpenProposal = async (proposal: Proposal) => {
        setSelectedProposal(proposal);
        setMetadata(null);
        setMetadataError(null);

        if (proposal.metadata_url) {
            setMetadataLoading(true);
            try {
                const json = await fetchJsonWithIpfsFallback(proposal.metadata_url);
                setMetadata(json);
            } catch (err: any) {
                setMetadataError(err?.message ?? "Failed to load metadata");
            } finally {
                setMetadataLoading(false);
            }
        }
    };

    const handleCloseProposal = () => {
        setSelectedProposal(null);
        setMetadata(null);
        setMetadataError(null);
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color="error" textAlign="center">
                Error: {error}
            </Typography>
        );
    }

    return (
        <Box>
            {/* Current epoch header */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Network Epoch
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Current Epoch:</strong> {currentEpoch}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Started:</strong> {epochStart.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                    <strong>Expires:</strong> {epochEnd.toLocaleString()}
                </Typography>
            </Paper>

            <Typography variant="h6" gutterBottom>
                Live Governance Actions
            </Typography>

            {proposals.length === 0 && !isLoading && (
                <Typography textAlign="center" color="text.secondary">
                    No live proposals found.
                </Typography>
            )}

            {proposals.map((proposal) => {
                const resolvedMetadataHref = resolveIpfsUrl(proposal.metadata_url);
                return (
                    <Paper
                        key={proposal.proposal_id}
                        sx={{ p: 2, mb: 2 }}
                        variant="outlined"
                    >
                        <Typography variant="h6" component="h3" gutterBottom>
                            {proposal.title}
                        </Typography>

                        <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                            <strong>Proposal ID:</strong>{" "}
                            <Link
                                href={`https://cardanoscan.io/govAction/${proposal.proposal_id}`}
                                target="_blank"
                                rel="noopener"
                            >
                                {proposal.proposal_id}
                            </Link>
                        </Typography>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ wordBreak: "break-all" }}
                        >
                            <strong>Transaction Hash:</strong>{" "}
                            <Link
                                href={`https://cardanoscan.io/transaction/${proposal.tx_hash}`}
                                target="_blank"
                                rel="noopener"
                            >
                                {proposal.tx_hash}
                            </Link>
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            <strong>Created:</strong>{" "}
                            {new Date(proposal.creation_time * 1000).toLocaleString()}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            <strong>Submission Epoch:</strong> {proposal.submitted_epoch}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            <strong>Expiration Epoch:</strong> {proposal.expiration}
                        </Typography>

                        {proposal.metadata_url && (
                            <Box sx={{ mt: 1 }}>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ wordBreak: "break-all" }}
                                >
                                    <strong>Metadata:</strong>{" "}
                                    <Link
                                        href={resolvedMetadataHref}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        {resolvedMetadataHref}
                                    </Link>
                                </Typography>

                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ mt: 1 }}
                                    onClick={() => handleOpenProposal(proposal)}
                                >
                                    Read Proposal
                                </Button>
                            </Box>
                        )}
                    </Paper>
                );
            })}

            {/* Metadata Dialog */}
            <Dialog
                open={!!selectedProposal}
                onClose={handleCloseProposal}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>{selectedProposal?.title || "Proposal"}</DialogTitle>
                <DialogContent dividers>
                    {metadataLoading && (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {metadataError && (
                        <Typography color="error">Error: {metadataError}</Typography>
                    )}

                    {!metadataLoading && !metadataError && metadata?.body && (
                        <MetadataBlock value={metadata.body} />
                    )}

                    {!metadataLoading && !metadataError && !metadata?.body && (
                        <Typography color="text.secondary">
                            No body section available for this proposal.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseProposal}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
