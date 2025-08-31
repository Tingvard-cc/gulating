"use client";

import React from "react";
import {
    Box,
    Button,
    IconButton,
    MenuItem,
    TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

interface Votes {
    yes: number;
    no: number;
    abstain: number;
    didNotVote: number;
    againstVoting: number;
}

type ReferenceType = "RelevantArticles" | "GovernanceMetadata" | "Other";

interface Reference {
    type: ReferenceType;
    label: string;
    url: string;
}

const CreateRationale: React.FC = () => {
    const [authorName, setAuthorName] = React.useState("Tingvard");
    const [govActionId, setGovActionId] = React.useState("");

    const [summary, setSummary] = React.useState("");
    const [statement, setStatement] = React.useState("");
    const [discussion, setDiscussion] = React.useState("");
    const [counterarguments, setCounterarguments] = React.useState("");
    const [conclusion, setConclusion] = React.useState("");

    const [votes, setVotes] = React.useState<Votes>({
        yes: 0,
        no: 0,
        abstain: 0,
        didNotVote: 0,
        againstVoting: 0,
    });

    const [references, setReferences] = React.useState<Reference[]>([
        { type: "RelevantArticles", label: "", url: "" },
    ]);

    const addReference = () =>
        setReferences((prev) => [
            ...prev,
            { type: "RelevantArticles", label: "", url: "" },
        ]);

    const updateReference = <K extends keyof Reference,>(
        index: number,
        field: K,
        value: Reference[K]
    ) =>
        setReferences((prev) =>
            prev.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref))
        );

    const removeReference = (index: number) =>
        setReferences((prev) => prev.filter((_, i) => i !== index));

    const clean = (s: string) => s.trim();
    const toNum = (v: string) => {
        const t = v.trim();
        if (t === "") return 0;
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
    };

    const handleGenerateJson = () => {
        const cleanedReferences = references
            .map((r) => ({ ...r, label: clean(r.label), url: clean(r.url) }))
            .filter((r) => r.label && r.url);

        const jsonData = {
            "@context": {
                "@language": "en-us",
                CIP100:
                    "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
                CIP136:
                    "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0136/README.md#",
                hashAlgorithm: "CIP100:hashAlgorithm",
                body: {
                    "@id": "CIP136:body",
                    "@context": {
                        references: {
                            "@id": "CIP100:references",
                            "@container": "@set",
                            "@context": {
                                GovernanceMetadata: "CIP100:GovernanceMetadataReference",
                                Other: "CIP100:OtherReference",
                                label: "CIP100:reference-label",
                                uri: "CIP100:reference-uri",
                                RelevantArticles: "CIP136:RelevantArticles",
                            },
                        },
                        summary: "CIP136:summary",
                        rationaleStatement: "CIP136:rationaleStatement",
                        precedentDiscussion: "CIP136:precedentDiscussion",
                        counterargumentDiscussion: "CIP136:counterargumentDiscussion",
                        conclusion: "CIP136:conclusion",
                        internalVote: {
                            "@id": "CIP136:internalVote",
                            "@container": "@set",
                            "@context": {
                                constitutional: "CIP136:constitutional",
                                unconstitutional: "CIP136:unconstitutional",
                                abstain: "CIP136:abstain",
                                didNotVote: "CIP136:didNotVote",
                                againstVote: "CIP136:againstVote",
                            },
                        },
                    },
                },
                authors: {
                    "@id": "CIP100:authors",
                    "@container": "@set",
                    "@context": {
                        did: "@id",
                        name: "http://xmlns.com/foaf/0.1/name",
                        witness: {
                            "@id": "CIP100:witness",
                            "@context": {
                                witnessAlgorithm: "CIP100:witnessAlgorithm",
                                publicKey: "CIP100:publicKey",
                                signature: "CIP100:signature",
                            },
                        },
                    },
                },
            },
            hashAlgorithm: "blake2b-256",
            body: {
                govActionId: clean(govActionId),
                summary: clean(summary),
                rationaleStatement: clean(statement),
                precedentDiscussion: clean(discussion),
                counterargumentDiscussion: clean(counterarguments),
                conclusion: clean(conclusion),
                internalVote: {
                    constitutional: votes.yes,
                    unconstitutional: votes.no,
                    abstain: votes.abstain,
                    didNotVote: votes.didNotVote,
                    againstVote: votes.againstVoting,
                },
                references: cleanedReferences.map((ref) => ({
                    "@type": ref.type,
                    label: ref.label,
                    uri: ref.url,
                })),
            },
            authors: [{ name: clean(authorName) }],
        };

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(jsonData, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = "rationale.json";
        link.click();
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
            {/* Meta */}
            <TextField
                label="Governance Action ID (govActionId)"
                fullWidth
                value={govActionId}
                onChange={(e) => setGovActionId(e.target.value)}
            />
            <TextField
                label="Author Name"
                fullWidth
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
            />

            {/* Text sections */}
            <TextField
                label="Summary"
                fullWidth
                multiline
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
            />
            <TextField
                label="Rationale Statement"
                fullWidth
                multiline
                rows={4}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
            />
            <TextField
                label="Precedent Discussion"
                fullWidth
                multiline
                rows={3}
                value={discussion}
                onChange={(e) => setDiscussion(e.target.value)}
            />
            <TextField
                label="Counterargument Discussion"
                fullWidth
                multiline
                rows={3}
                value={counterarguments}
                onChange={(e) => setCounterarguments(e.target.value)}
            />
            <TextField
                label="Conclusion"
                fullWidth
                multiline
                rows={3}
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
            />

            {/* Votes */}
            <Box sx={{ display: "flex", flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
                <TextField
                    type="number"
                    label="Yes (Constitutional)"
                    value={votes.yes}
                    onChange={(e) =>
                        setVotes({ ...votes, yes: toNum((e.target as HTMLInputElement).value) })
                    }
                />
                <TextField
                    type="number"
                    label="No (Unconstitutional)"
                    value={votes.no}
                    onChange={(e) =>
                        setVotes({ ...votes, no: toNum((e.target as HTMLInputElement).value) })
                    }
                />
                <TextField
                    type="number"
                    label="Abstain"
                    value={votes.abstain}
                    onChange={(e) =>
                        setVotes({
                            ...votes,
                            abstain: toNum((e.target as HTMLInputElement).value),
                        })
                    }
                />
                <TextField
                    type="number"
                    label="Did Not Vote"
                    value={votes.didNotVote}
                    onChange={(e) =>
                        setVotes({
                            ...votes,
                            didNotVote: toNum((e.target as HTMLInputElement).value),
                        })
                    }
                />
                <TextField
                    type="number"
                    label="Against Vote"
                    value={votes.againstVoting}
                    onChange={(e) =>
                        setVotes({
                            ...votes,
                            againstVoting: toNum((e.target as HTMLInputElement).value),
                        })
                    }
                />
            </Box>

            {/* References */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {references.map((ref, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 1,
                            alignItems: "center",
                            flexWrap: "wrap",
                        }}
                    >
                        <TextField
                            select
                            label="Reference Type"
                            value={ref.type}
                            onChange={(e) =>
                                updateReference(index, "type", e.target.value as ReferenceType)
                            }
                            sx={{ minWidth: 220 }}
                        >
                            <MenuItem value="RelevantArticles">RelevantArticles</MenuItem>
                            <MenuItem value="GovernanceMetadata">GovernanceMetadata</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                        </TextField>

                        <TextField
                            label="Reference Label"
                            fullWidth
                            value={ref.label}
                            onChange={(e) => updateReference(index, "label", e.target.value)}
                        />
                        <TextField
                            label="Reference URI"
                            fullWidth
                            value={ref.url}
                            onChange={(e) => updateReference(index, "url", e.target.value)}
                        />
                        <Box sx={{ display: "flex" }}>
                            {index === references.length - 1 && (
                                <IconButton color="primary" onClick={addReference}>
                                    <AddIcon />
                                </IconButton>
                            )}
                            {references.length > 1 && (
                                <IconButton color="error" onClick={() => removeReference(index)}>
                                    <RemoveIcon />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            <Button variant="contained" color="primary" onClick={handleGenerateJson} sx={{ mt: 2 }}>
                Generate JSON
            </Button>
        </Box>
    );
};

export default CreateRationale;
