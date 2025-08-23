"use client";

import { useEffect, useState } from "react";
import "../globals.css"; // Import the CSS file
import "@meshsdk/react/styles.css"
import { useWallet } from "@meshsdk/react";
import { BrowserWallet, deserializeAddress } from "@meshsdk/core";
import { Container, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import Image from 'next/image';

// Define the props interface for the Wallet component
interface WalletProps {
    onConnectionChange: (data: { address: string | null; stakeCredential: string | null }) => void;
}

// Update the component to accept the onConnectionChange prop
const Wallet = ({ onConnectionChange }: WalletProps) => {
    const [WalletComponent, setWalletComponent] = useState<any | null>(null);
    // This local state is still needed for displaying the info within this component
    const [stakeCred, setStakeCred] = useState<string | null>(null);
    const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
    const [walletIcon, setWalletIcon] = useState<string>('');

    useEffect(() => {
        const run = async () => {
            try {
                const { CardanoWallet } = await import("@meshsdk/react");
                setWalletComponent(() => CardanoWallet);
            } catch (error) {
                console.error("Error importing CardanoWallet:", error);
            }
        };
        run();
    }, []);

    const WalletWrapper = () => {
        const { wallet, connected, name } = useWallet();

        useEffect(() => {
            const handleWalletConnection = async () => {
                if (connected) {
                    const changeAddress = await wallet.getChangeAddress();
                    const networkId = await wallet.getNetworkId();
                    const iconSvg = (await BrowserWallet.getAvailableWallets()).find(w => w.id.toLowerCase() === name?.toLowerCase())?.icon || "";

                    // Deserialize the address to get the hash
                    const deserialized = deserializeAddress(changeAddress);
                    const stakeCredentialHash = deserialized.stakeCredentialHash;

                    // Update local state for display within this component
                    setStakeCred(stakeCredentialHash);
                    setWalletNetwork(networkId === 0 ? "Testnet" : networkId === 1 ? "Mainnet" : "unknown");
                    setWalletIcon(iconSvg);

                    // Call the onConnectionChange prop to notify the parent (page.tsx)
                    onConnectionChange({
                        address: changeAddress,
                        stakeCredential: stakeCredentialHash,
                    });

                } else {
                    // Clear local state when disconnected
                    setStakeCred(null);
                    setWalletNetwork(null);
                    setWalletIcon("");

                    // Notify the parent that the wallet has disconnected
                    onConnectionChange({
                        address: null,
                        stakeCredential: null,
                    });
                }
            };

            handleWalletConnection();
            // The dependency array should include onConnectionChange to avoid stale closures
        }, [wallet, connected, name, onConnectionChange]);

        return <WalletComponent />;
    };

    if (WalletComponent === null) {
        return <div className="wallet-container">Loading...</div>;
    }

    return (
        <Container maxWidth="md" data-testid="wallet">
            <div className="wallet-container" style={{ display: "flex", alignItems: "center", justifyContent: "center " }} >
                <WalletWrapper />
            </div>
            {/* Credentials Table */}
            <TableContainer sx={{ mb: 3 }}>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell sx={{ fontWeight: "bold" }}>Voter Key Hash</TableCell>
                            <TableCell>{stakeCred || "Not Available"}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: "bold" }}>Wallet Network</TableCell>
                            <TableCell>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    {walletNetwork || "Not Available"}
                                    {walletIcon &&
                                        <Image src={walletIcon} alt="Wallet Icon" className="wallet-icon" width={25} height={25} style={{ marginLeft: "15px" }} />}
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};

export default Wallet;
