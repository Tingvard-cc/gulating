import * as CSL from "@emurgo/cardano-serialization-lib-browser";
import { deserializeAddress } from "@meshsdk/core";
import dotevn from "dotenv";
import * as blake from 'blakejs';

dotevn.config();

// Gets your IPFS gateways from the .env file and splits them into an array.
const NEXT_PUBLIC_REST_IPFS_GATEWAY = (process.env.NEXT_PUBLIC_REST_IPFS_GATEWAY ?? "").split(",");

/**
 * Normalize a gateway string so it always ends with /ipfs/
 */
const normalizeGateway = (gateway: string): string => {
    let g = gateway.trim();

    // remove any protocol
    g = g.replace(/^https?:\/\//, "");

    // ensure single /ipfs/ at the end
    if (!g.endsWith("/ipfs/")) {
        if (g.endsWith("/ipfs")) {
            g = g + "/";
        } else {
            g = g + "/ipfs/";
        }
    }
    return g;
};

/**
 * Decodes a transaction from a hex string into a CSL Transaction object.
 */
export const decodeHexToTx = (unsignedTransactionHex: string) => {
    try {
        return CSL.Transaction.from_hex(unsignedTransactionHex);
    } catch (error) {
        console.error("Error decoding transaction:", error);
        return null;
    }
};

/**
 * Converts a Governance Action ID to its Bech32 format (CIP-129).
 */
export const convertGAToBech = (gaTxHash: string, gaTxIndex: number) => {
    const bech32 = require('bech32-buffer');
    const indexHex = gaTxIndex.toString(16).padStart(2, '0');
    return bech32.encode("gov_action", Buffer.from(gaTxHash + indexHex, 'hex')).toString();
};

/**
 * Gets the correct CardanoScan URL for an address or Governance Action ID.
 */
export const getCardanoScanURL = (bech32String: string, networkID: number): string => {
    const baseURL = networkID === 0 ? "https://preprod.cardanoscan.io/" : "https://cardanoscan.io/";
    if (bech32String.startsWith("addr")) {
        return `${baseURL}address/${bech32String}`;
    }
    if (bech32String.startsWith("gov_action")) {
        return `${baseURL}govAction/${bech32String}`;
    }
    return "";
};

/**
 * Opens a URL in a new tab, correctly formatting IPFS links.
 */
export const openInNewTab = (url: string) => {
    let fullUrl = url;

    if (url.startsWith("ipfs://")) {
        const cid = url.slice(7);
        const gatewayHost = normalizeGateway(NEXT_PUBLIC_REST_IPFS_GATEWAY[0] || "ipfs.io/ipfs/");
        fullUrl = `https://${gatewayHost}${cid}`;
    } else if (url.startsWith("bafk") || url.startsWith("Qm")) {
        const gatewayHost = normalizeGateway(NEXT_PUBLIC_REST_IPFS_GATEWAY[0] || "ipfs.io/ipfs/");
        fullUrl = `https://${gatewayHost}${url}`;
    } else if (!url.startsWith("http")) {
        fullUrl = `https://${url}`;
    }

    window.open(fullUrl, "_blank", "noopener,noreferrer");
};

/**
 * Fetches content from a URL (especially IPFS) and returns its Blake2b hash.
 */
export const getDataHashFromURI = async (anchorURL: string) => {
    let fetchURL = anchorURL;

    // Detect raw CIDs or ipfs://
    let cid = "";
    if (anchorURL.startsWith("ipfs://")) {
        cid = anchorURL.slice(7);
    } else if (anchorURL.startsWith("bafk") || anchorURL.startsWith("Qm")) {
        cid = anchorURL;
    }

    // If it's an IPFS link, build proper URL
    if (cid) {
        const gatewayHost = normalizeGateway(NEXT_PUBLIC_REST_IPFS_GATEWAY[0] || "ipfs.io/ipfs/");
        fetchURL = `https://${gatewayHost}${cid}`;
    }

    try {
        const res = await fetch(fetchURL);
        if (!res.ok) {
            throw new Error(`Failed to fetch from ${fetchURL}, status: ${res.status}`);
        }

        const text = await res.text();
        const hash = blake.blake2bHex(text, undefined, 32);
        return hash;
    } catch (error) {
        console.error("Error fetching or hashing data:", error);
        return null;
    }
};

/**
 * Signs a transaction using the connected wallet.
 */
export const signTransaction = async (wallet: any, unsignedTransactionHex: string) => {
    const signedTx = await wallet.signTx(unsignedTransactionHex, true);
    if (!signedTx) {
        throw new Error("Error signing transaction.");
    }
    const signedTransactionObj = decodeHexToTx(signedTx);
    const witnessHex = signedTransactionObj?.witness_set().vkeys()?.get(0)?.to_hex() || "";

    return { signedTransactionObj, witnessHex };
};

/**
 * Validates the transaction witness to ensure the signature is correct.
 */
export const validateWitness = async (signedTransactionObj: any, wallet: any, unsignedTransactionHex: string) => {
    const signature = signedTransactionObj?.witness_set().vkeys()?.get(0).signature().to_hex() || "";
    let providedVkey = signedTransactionObj?.witness_set().vkeys()?.get(0).vkey().to_hex() || "";

    // Remove the CBOR header from the VKey.
    providedVkey = providedVkey.substring(4);
    const providedVKeyObj = CSL.PublicKey.from_hex(providedVkey);

    const expectedVKeyHash = deserializeAddress(await wallet.getChangeAddress()).stakeCredentialHash;
    const providedVKeyHash = providedVKeyObj.hash().to_hex();

    if (providedVKeyHash !== expectedVKeyHash) {
        throw new Error("Wallet returned unexpected VKey.");
    }

    const txHash = CSL.FixedTransaction.from_hex(unsignedTransactionHex).transaction_hash().to_bytes();
    const validSignature = providedVKeyObj.verify(txHash, CSL.Ed25519Signature.from_hex(signature));

    if (!validSignature) {
        throw new Error("Wallet created an invalid signature.");
    }

    console.log("Signature is valid.");
};
