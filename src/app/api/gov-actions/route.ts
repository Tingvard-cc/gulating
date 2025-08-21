import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
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
