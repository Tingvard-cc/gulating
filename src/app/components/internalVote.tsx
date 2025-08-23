"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Proposal } from './liveActions'; // Import the Proposal type

// --- Configuration: Council member wallet hashes ---
const COUNCIL_MEMBERS = [
    '79e6a02beb8e9ee802eda0a2348c484d9e6c3fcdbee5b9fbbdb6c1bd',
    'f0a3c1e8b9d2a7c6b5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6',
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    '3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    '9c8b7a6d5f4e3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8b7c6d5e4f3a2b',
    'd2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5',
];

// --- Type Definitions ---
type VoteOption = 'yes' | 'no' | 'abstain';
type VoteStatus = VoteOption | 'not-voted';
type Votes = Record<string, VoteStatus>;
type Outcome = 'Passed' | 'Failed' | 'Tied' | 'Pending...';

// --- Props Interface ---
interface InternalVoteProps {
    connectedWalletAddress: string | null;
    proposals: Proposal[]; 
}

// --- Reusable Badge Component ---
const VoteStatusBadge = ({ status }: { status: VoteStatus }) => {
    const baseClasses = "px-3 py-1 text-sm font-medium rounded-full text-white flex-shrink-0";
    const statusStyles: Record<VoteStatus, string> = {
        'yes': 'bg-green-500',
        'no': 'bg-red-500',
        'abstain': 'bg-gray-500',
        'not-voted': 'bg-yellow-400 text-gray-800'
    };
    return (
        <span className={`${baseClasses} ${statusStyles[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
        </span>
    );
};

// --- The Main Voting Component ---
export const InternalVote = ({ connectedWalletAddress, proposals }: InternalVoteProps) => {
    const [selectedProposalId, setSelectedProposalId] = useState<string>('');
    const [votes, setVotes] = useState<Votes>({});
    const [outcome, setOutcome] = useState<Outcome>('Pending...');

    // Effect to set the initial proposal when the component loads
    useEffect(() => {
        if (proposals && proposals.length > 0 && !selectedProposalId) {
            setSelectedProposalId(proposals[0].proposal_id);
        }
    }, [proposals, selectedProposalId]);

    // Helper to create a default voting state
    const getInitialVotes = () => {
        const initialVotes: Votes = {};
        COUNCIL_MEMBERS.forEach(member => {
            initialVotes[member] = 'not-voted';
        });
        return initialVotes;
    };

    // Effect to fetch votes from the API when the selected proposal changes
    useEffect(() => {
        const fetchVotes = async () => {
            if (!selectedProposalId) return;

            try {
                // Use the gov-actions API to fetch votes for the current proposal
                const response = await fetch(`/api/gov-actions?proposalId=${selectedProposalId}`);
                if (!response.ok) throw new Error('Failed to fetch votes');
                
                const data = await response.json();
                setVotes(Object.keys(data).length > 0 ? data : getInitialVotes());
            } catch (error) {
                console.error(error);
                setVotes(getInitialVotes());
            }
        };

        fetchVotes();
        const intervalId = setInterval(fetchVotes, 30000); // Poll for updates
        return () => clearInterval(intervalId);

    }, [selectedProposalId]);

    const isCurrentUserCouncilMember = useMemo(() =>
        !!connectedWalletAddress && COUNCIL_MEMBERS.includes(connectedWalletAddress),
        [connectedWalletAddress]
    );

    // Function to save a new vote to the API
    const handleVote = async (vote: VoteOption) => {
        if (!isCurrentUserCouncilMember || !connectedWalletAddress || !selectedProposalId) return;

        const newVotes = { ...votes, [connectedWalletAddress]: vote };
        setVotes(newVotes); // Optimistic UI update

        try {
            await fetch('/api/gov-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proposalId: selectedProposalId,
                    votes: newVotes,
                }),
            });
        } catch (error) {
            console.error("Failed to save vote:", error);
            // Optionally revert the optimistic update on failure
        }
    };

    // Effect to calculate the outcome whenever votes change
    useEffect(() => {
        const voteCounts = { yes: 0, no: 0, abstain: 0 };
        Object.values(votes).forEach(v => {
            if (v === 'yes' || v === 'no' || v === 'abstain') voteCounts[v]++;
        });

        if (voteCounts.yes === 0 && voteCounts.no === 0 && voteCounts.abstain === 0) {
             setOutcome('Pending...');
             return;
        }
        if (voteCounts.yes > voteCounts.no) setOutcome('Passed');
        else if (voteCounts.no > voteCounts.yes) setOutcome('Failed');
        else setOutcome('Tied');
    }, [votes]);

    const voteCounts = useMemo(() => {
        const counts = { yes: 0, no: 0, abstain: 0, 'not-voted': 0 };
        if (votes) {
           Object.values(votes).forEach(v => {
                if(counts[v] !== undefined) counts[v]++;
           });
        }
        return counts;
    }, [votes]);

    const outcomeStyles: Record<Outcome, string> = {
        'Passed': 'text-green-500',
        'Failed': 'text-red-500',
        'Tied': 'text-gray-500',
        'Pending...': 'text-yellow-500'
    };

    const truncateHash = (hash: string, start = 6, end = 6) => {
        if (!hash) return '';
        return `${hash.substring(0, start)}...${hash.substring(hash.length - end)}`;
    }

    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center mb-2">Internal Poll 🗳️</h2>
            <p className="text-center text-gray-500 mb-6">Real-time voting for council members.</p>

            <div className="mb-6">
                <label htmlFor="proposal-select" className="block text-sm font-bold text-gray-700 mb-2">Proposal:</label>
                <select
                    id="proposal-select"
                    value={selectedProposalId}
                    onChange={(e) => setSelectedProposalId(e.target.value)}
                    disabled={proposals.length === 0}
                    className="w-full px-4 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:bg-gray-200 disabled:cursor-not-allowed"
                >
                    {proposals.length > 0 ? (
                        proposals.map((p) => (
                            <option key={p.proposal_id} value={p.proposal_id}>{p.title}</option>
                        ))
                    ) : (
                        <option value="" disabled>No proposals available from Live Actions</option>
                    )}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg text-gray-800 mb-3">Live Results</h3>
                    <div className="mb-4">
                        <span className="font-semibold text-gray-600">Outcome: </span>
                        <span className={`font-bold text-lg ${outcomeStyles[outcome]}`}>{outcome}</span>
                    </div>
                    <div className="flex justify-around items-center text-center">
                        <div><p className="text-2xl font-bold text-green-500">{voteCounts.yes}</p><p className="text-sm text-gray-500">Yes</p></div>
                        <div><p className="text-2xl font-bold text-red-500">{voteCounts.no}</p><p className="text-sm text-gray-500">No</p></div>
                        <div><p className="text-2xl font-bold text-gray-500">{voteCounts.abstain}</p><p className="text-sm text-gray-500">Abstain</p></div>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg text-gray-800 mb-3">Your Vote</h3>
                    {isCurrentUserCouncilMember ? (
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => handleVote('yes')} className="w-full py-2 px-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 transition transform hover:scale-105">Yes</button>
                            <button onClick={() => handleVote('no')} className="w-full py-2 px-4 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition transform hover:scale-105">No</button>
                            <button onClick={() => handleVote('abstain')} className="w-full py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition transform hover:scale-105">Abstain</button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-yellow-100 text-yellow-800 p-3 rounded-lg">
                            <p className="text-center font-medium">Please connect a valid council member wallet to vote.</p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <h3 className="font-bold text-lg text-gray-800 mb-3">Member Votes</h3>
                <ul className="space-y-2">
                    {COUNCIL_MEMBERS.map(member => (
                        <li key={member} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 gap-4">
                            <span className="font-mono text-sm text-gray-600 truncate" title={member}>
                                {truncateHash(member)}
                                {member === connectedWalletAddress && <span className="font-sans font-bold text-blue-600"> (You)</span>}
                            </span>
                            <VoteStatusBadge status={votes[member] || 'not-voted'} />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
