import { NextResponse } from 'next/server';
import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

// --- Types and helpers for handling votes.json ---
type VotesFile = {
    [proposalId: string]: {
        [memberHash: string]: 'yes' | 'no' | 'abstain' | 'not-voted';
    };
};

const votesFilePath = path.join(process.cwd(), 'data', 'votes.json');

async function ensureVotesFile(): Promise<VotesFile> {
    try {
        await fs.mkdir(path.dirname(votesFilePath), { recursive: true });
        const fileContent = await fs.readFile(votesFilePath, 'utf-8');
        return fileContent ? (JSON.parse(fileContent) as VotesFile) : {};
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            await fs.writeFile(votesFilePath, JSON.stringify({}));
            return {};
        }
        console.error("Error reading or creating votes.json:", error);
        return {};
    }
}

// --- GET Handler: Fetches proposals OR votes based on query params ---
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const proposalId = searchParams.get('proposalId');

    if (proposalId) {
        // --- If a proposalId is provided, handle fetching votes ---
        const allVotes = await ensureVotesFile();
        const proposalVotes = allVotes[proposalId] || {};
        return NextResponse.json(proposalVotes, { status: 200 });

    } else {
        // --- Otherwise, handle fetching proposals (your original code) ---
        try {
            const response = await axios.get(
                'https://api.koios.rest/api/v1/proposal_list',
                {
                    headers: { 'Accept': 'application/json' },
                }
            );

            const proposals = response.data
                .filter((p: any) =>
                    p.dropped_epoch === null &&
                    p.ratified_epoch === null &&
                    p.enacted_epoch === null &&
                    (p.expired_epoch === null || p.expired_epoch > 577) // use current epoch
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

            return NextResponse.json(proposals);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(
                    'Axios Error:',
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error('API Route Error:', error);
            }
            return new NextResponse('Error fetching data from Koios', { status: 500 });
        }
    }
}

// --- POST Handler: Saves votes to votes.json ---
export async function POST(req: Request) {
    try {
        const { proposalId, votes } = await req.json();

        if (!proposalId || !votes) {
            return NextResponse.json({ message: 'Proposal ID and votes are required.' }, { status: 400 });
        }

        const allVotes = await ensureVotesFile();
        allVotes[proposalId] = votes;

        await fs.writeFile(votesFilePath, JSON.stringify(allVotes, null, 2));
        return NextResponse.json({ message: 'Votes saved successfully.' }, { status: 200 });
    } catch (error) {
        console.error("Failed to process POST request:", error);
        return NextResponse.json({ message: 'Failed to save votes.' }, { status: 500 });
    }
}
