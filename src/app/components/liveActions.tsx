"use client";

import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Paper, Link, Button, Collapse } from '@mui/material';
import axios from 'axios';

// **FIX 1: Updated the Proposal interface to match your API response**
// The 'title' is now a direct property.
export interface Proposal {
    proposal_id: string;
    tx_hash: string;
    creation_time: number;
    submitted_epoch: number;
    expires_epoch: number;
    metadata_url?: string;
    title: string; // Title is a direct property of the object
}

interface LiveActionsProps {
    onUpdate: (proposals: Proposal[]) => void;
}

export const LiveActions = ({ onUpdate }: LiveActionsProps) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
    const [metadataContent, setMetadataContent] = useState<any | null>(null);
    const [isMetadataLoading, setIsMetadataLoading] = useState(false);

    useEffect(() => {
        const fetchGovProposals = async () => {
            if (proposals.length === 0) setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/gov-actions');
                if (!response.ok) {
                    throw new Error('Failed to fetch governance proposals.');
                }
                const data: Proposal[] = await response.json();
                setProposals(data);
                onUpdate(data);
            } catch (err: any) {
                setError(err.message);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGovProposals();
        const intervalId = setInterval(fetchGovProposals, 300000);
        return () => clearInterval(intervalId);
    }, [onUpdate]);

    const handleToggleDetails = async (proposalId: string, metadataUrl?: string) => {
        if (expandedProposal === proposalId) {
            setExpandedProposal(null);
            setMetadataContent(null);
        } else {
            setExpandedProposal(proposalId);
            if (metadataUrl) {
                setIsMetadataLoading(true);
                setMetadataContent(null);
                try {
                    const response = await axios.get(metadataUrl);
                    setMetadataContent(response.data);
                } catch (e) {
                    console.error("Failed to fetch metadata", e);
                    setMetadataContent({ error: "Failed to fetch metadata." });
                } finally {
                    setIsMetadataLoading(false);
                }
            }
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Typography color="error" textAlign="center">Error: {error}</Typography>;
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Live Governance Actions
            </Typography>
            {proposals.length === 0 && !isLoading && (
                <Typography textAlign="center" color="text.secondary">No live proposals found.</Typography>
            )}
            {proposals.map((proposal) => (
                <Paper key={proposal.proposal_id} sx={{ p: 2, mb: 2 }} variant="outlined">
                    {/* **FIX 2: Display the title directly from proposal.title** */}
                    <Typography variant="h6" component="h3" gutterBottom>
                        {proposal.title}
                    </Typography>

                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                        <strong>Proposal ID:</strong>{" "}
                        <Link
                            href={`https://cardanoscan.io/govAction/${proposal.proposal_id}`}
                            target="_blank"
                            rel="noopener"
                        >
                            {proposal.proposal_id}
                        </Link>
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        <strong>Transaction Hash:</strong>{" "}
                        <Link
                            href={`https://cardanoscan.io/transaction/${proposal.tx_hash}`}
                            target="_blank"
                            rel="noopener"
                            sx={{ wordBreak: 'break-all' }}
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
                        <strong>Expiration Epoch:</strong> {proposal.expires_epoch}
                    </Typography>

                    {proposal.metadata_url && (
                        <Box mt={1}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleToggleDetails(proposal.proposal_id, proposal.metadata_url)}
                            >
                                {expandedProposal === proposal.proposal_id ? 'Hide Details' : 'View Details'}
                            </Button>
                        </Box>
                    )}
                    <Collapse in={expandedProposal === proposal.proposal_id}>
                        <Box sx={{ p: 2, mt: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#f9f9f9' }}>
                            {isMetadataLoading ? (
                                <CircularProgress size={24} />
                            ) : (
                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {JSON.stringify(metadataContent, null, 2)}
                                </pre>
                            )}
                        </Box>
                    </Collapse>
                </Paper>
            ))}
        </Box>
    );
}
