// StoreSignatureButton.tsx
import { Button } from '@mui/material';
import React from 'react';

interface StoreSignatureButtonProps {
    govActionID: string;
    voterKeyHash: string;
    signature: string; // cborHex
    apiBaseUrl?: string; // optional, e.g. "http://localhost:3001"
}

async function storeSignature(
    govActionID: string,
    voterKeyHash: string,
    signature: string,
    apiBaseUrl?: string
) {
    const payload = {
        type: "TxWitness ConwayEra",
        description: "Key Witness ShelleyEra",
        govActionID,
        voterKeyHash,
        cborHex: signature,
    };

    const voterPrefix = voterKeyHash.substring(0, 5);
    const govPrefix = govActionID.substring(0, 15);
    const filename = `${govPrefix}-vote-from-${voterPrefix}.witness`;

    const url = `${(apiBaseUrl ?? "")}/api/gov-actions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, govActionID, data: payload }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Failed to store signature (status ${res.status})`);
    }
    return res.json();
}

export default function StoreSignatureButton({
    govActionID,
    voterKeyHash,
    signature,
    apiBaseUrl,
}: StoreSignatureButtonProps) {
    const onClick = async () => {
        try {
            const result = await storeSignature(govActionID, voterKeyHash, signature, apiBaseUrl);
            console.info('Stored on server:', result);
            // TODO: show success Snackbar/Toast if you like
        } catch (err) {
            console.error(err);
            // TODO: show error Snackbar/Toast if you like
        }
    };

    return (
        <Button
            variant="contained"
            color="success"
            sx={{ whiteSpace: 'nowrap', px: 3 }}
            onClick={onClick}
        >
            Store Signature
        </Button>
    );
}
