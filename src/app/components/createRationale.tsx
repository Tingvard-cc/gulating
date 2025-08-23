import { Box, Button, IconButton, TextField } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import React from "react";

interface Votes {
    yes: number;
    no: number;
    abstain: number;
    didNotVote: number;
    againstVoting: number;
}

interface Reference {
    label: string;
    url: string;
}

export const CreateRationale = () => {
    const [summary, setSummary] = React.useState<string>("");
    const [statement, setStatement] = React.useState<string>("");
    const [discussion, setDiscussion] = React.useState<string>("");
    const [counterarguments, setCounterarguments] = React.useState<string>("");
    const [conclusion, setConclusion] = React.useState<string>("");
    const [votes, setVotes] = React.useState<Votes>({ yes: 0, no: 0, abstain: 0, didNotVote: 0, againstVoting: 0 });
    const [references, setReferences] = React.useState<Reference[]>([{ label: "", url: "" }]);

    const addReference = () => {
        setReferences((prev) => [...prev, { label: "", url: "" }]);
    };

    const updateReference = (
        index: number,
        field: keyof Reference,
        value: string
    ) => {
        setReferences((prev) =>
            prev.map((ref, i) =>
                i === index ? { ...ref, [field]: value } : ref
            )
        );
    };

    const removeReference = (index: number) => {
        setReferences((prev) => prev.filter((_, i) => i !== index));
    };

    // --- FUNCTION TO GENERATE JSON ---
    const handleGenerateJson = () => {
        const jsonData = {
            "@context": {
                "@language": "en-us",
                "CIP100": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
                "CIP136": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0136/README.md#",
                "hashAlgorithm": "CIP100:hashAlgorithm",
                "body": {
                    "@id": "CIP136:body",
                    "@context": {
                        "references": {
                            "@id": "CIP100:references",
                            "@container": "@set",
                            "@context": {
                                "GovernanceMetadata": "CIP100:GovernanceMetadataReference",
                                "Other": "CIP100:OtherReference",
                                "label": "CIP100:reference-label",
                                "uri": "CIP100:reference-uri",
                                "RelevantArticles": "CIP136:RelevantArticles"
                            }
                        },
                        "summary": "CIP136:summary",
                        "rationaleStatement": "CIP136:rationaleStatement",
                        "precedentDiscussion": "CIP136:precedentDiscussion",
                        "counterargumentDiscussion": "CIP136:counterargumentDiscussion",
                        "conclusion": "CIP136:conclusion",
                        "internalVote": {
                            "@id": "CIP136:internalVote",
                            "@container": "@set",
                            "@context": {
                                "constitutional": "CIP136:constitutional",
                                "unconstitutional": "CIP136:unconstitutional",
                                "abstain": "CIP136:abstain",
                                "didNotVote": "CIP136:didNotVote",
                                "againstVote": "CIP136:againstVote"
                            }
                        }
                    }
                },
                "authors": {
                    "@id": "CIP100:authors",
                    "@container": "@set",
                    "@context": {
                        "did": "@id",
                        "name": "http://xmlns.com/foaf/0.1/name",
                        "witness": {
                            "@id": "CIP100:witness",
                            "@context": {
                                "witnessAlgorithm": "CIP100:witnessAlgorithm",
                                "publicKey": "CIP100:publicKey",
                                "signature": "CIP100:signature"
                            }
                        }
                    }
                }
            },
            "hashAlgorithm": "blake2b-256",
            "body": {
                "summary": summary,
                "rationaleStatement": statement,
                "precedentDiscussion": discussion,
                "counterargumentDiscussion": counterarguments,
                "conclusion": conclusion,
                "internalVote": {
                    "constitutional": votes.yes,
                    "unconstitutional": votes.no,
                    "abstain": votes.abstain,
                    "didNotVote": votes.didNotVote,
                    "againstVote": votes.againstVoting
                },
                "references": references.map(ref => ({
                    "@type": "Other",
                    "label": ref.label,
                    "uri": ref.url
                }))
            },
            "authors": [
                {
                    "name": "Intersect Constitutional Council"
                }
            ]
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, padding: 2 }}>
            <TextField
                type="string"
                label="Statement"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={statement}
                onChange={(e) => {
                    setStatement(e.target.value);
                }}
            />
            <TextField
                type="string"
                label="Summary"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={summary}
                onChange={(e) => {
                    setSummary(e.target.value);
                }}
            />
            <TextField
                type="string"
                label="Discussion (Precedent)"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={discussion}
                onChange={(e) => {
                    setDiscussion(e.target.value);
                }}
            />
            <TextField
                type="string"
                label="Counter Arguments"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={counterarguments}
                onChange={(e) => {
                    setCounterarguments(e.target.value);
                }}
            />
            <TextField
                type="string"
                label="Conclusion"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={conclusion}
                onChange={(e) => {
                    setConclusion(e.target.value);
                }}
            />
            <Box sx={{ display: "flex", flexDirection: "row", gap: 2 }}>
                <TextField
                    type="number"
                    label="Yes (Constitutional)"
                    variant="outlined"
                    fullWidth
                    value={votes.yes}
                    onChange={(e) => {
                        setVotes({ ...votes, yes: Number(e.target.value) });
                    }}
                />
                <TextField
                    type="number"
                    label="No (Unconstitutional)"
                    variant="outlined"
                    fullWidth
                    value={votes.no}
                    onChange={(e) => {
                        setVotes({ ...votes, no: Number(e.target.value) });
                    }}
                />
                <TextField
                    type="number"
                    label="Abstain"
                    variant="outlined"
                    fullWidth
                    value={votes.abstain}
                    onChange={(e) => {
                        setVotes({ ...votes, abstain: Number(e.target.value) });
                    }}
                />
                <TextField
                    type="number"
                    label="Did not vote"
                    variant="outlined"
                    fullWidth
                    value={votes.didNotVote}
                    onChange={(e) => {
                        setVotes({ ...votes, didNotVote: Number(e.target.value) });
                    }}
                />
                <TextField
                    type="number"
                    label="Against Voting"
                    variant="outlined"
                    fullWidth
                    value={votes.againstVoting}
                    onChange={(e) => {
                        setVotes({ ...votes, againstVoting: Number(e.target.value) });
                    }}
                />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {references.map((ref, index) => (
                    <Box
                        key={index}
                        sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: 'center' }}
                    >
                        <TextField
                            type="string"
                            label="Reference Label"
                            variant="outlined"
                            fullWidth
                            value={ref.label}
                            onChange={(e) =>
                                updateReference(index, "label", e.target.value)
                            }
                        />
                        <TextField
                            type="url"
                            label="Reference URI"
                            variant="outlined"
                            fullWidth
                            value={ref.url}
                            onChange={(e) =>
                                updateReference(index, "url", e.target.value)
                            }
                        />
                        <Box sx={{ display: 'flex' }}>
                            {index === references.length - 1 && (
                                <IconButton color="primary" onClick={addReference}>
                                    <AddIcon />
                                </IconButton>
                            )}
                            {references.length > 1 && (
                                <IconButton
                                    color="error"
                                    onClick={() => removeReference(index)}
                                >
                                    <RemoveIcon />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* --- BUTTON THAT DOWNLOADS THE JSON --- */}
            <Button
                variant="contained"
                color="primary"
                onClick={handleGenerateJson}
                sx={{ mt: 2 }}
            >
                Generate JSON
            </Button>
        </Box>
    );
};
