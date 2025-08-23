"use client";

import Wallet from "./components/wallet";
import { TransactionButton } from "./components/transaction";
import {
    Container,
    Typography,
    Box,
    Tabs,
    Tab,
    Paper,
    Tooltip,
    Fade,
    Skeleton,
    useMediaQuery,
    useTheme
} from "@mui/material";
import Image from "next/image";
import { useState, useEffect } from "react";
// --- ICONS ---
import Description from "@mui/icons-material/Description";
import Stream from "@mui/icons-material/Stream";
import Create from "@mui/icons-material/Create";
import HelpOutline from "@mui/icons-material/HelpOutline";
import HowToVote from '@mui/icons-material/HowToVote';
// --- COMPONENTS ---
import { LiveActions, Proposal } from "./components/liveActions";
import { CreateRationale } from "./components/createRationale";
import { InternalVote } from "./components/InternalVote";


interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
            style={{ width: '100%' }}
        >
            {value === index && (
                <Fade in={true} timeout={500}>
                    <Box sx={{ p: 3 }}>{children}</Box>
                </Fade>
            )}
        </div>
    );
}

export default function Home() {
    const [tabValue, setTabValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [stakeCredential, setStakeCredential] = useState<string | null>(null);
    const [proposals, setProposals] = useState<Proposal[]>([]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleWalletConnectionChange = (data: { address: string | null; stakeCredential: string | null }) => {
        setStakeCredential(data.stakeCredential);
    };

    const handleProposalsUpdate = (fetchedProposals: Proposal[]) => {
        setProposals(fetchedProposals);
    };

    return (
        <Box className="background-container">
            <Container maxWidth="lg" sx={{
                display: "flex",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                minHeight: "100vh",
                padding: 2,
                borderRadius: { xs: 0, sm: 2 },
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                my: { xs: 0, sm: 4 }
            }}>
                {/* Header */}
                <Box sx={{ width: "100%", marginTop: { xs: 0, sm: "20px" }, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: { xs: "0", sm: "8px 8px 0 0" } }}>
                    <Image src="/images/logo.svg" alt="Logo" width={150} height={150} />
                </Box>

                {/* Wallet Section */}
                <Paper elevation={2} sx={{ width: "100%", mt: 3, p: 3, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ color: "text.secondary" }}>Connect Wallet</Typography>
                        <Tooltip title="Connect your wallet to interact with governance actions" arrow>
                            <HelpOutline sx={{ ml: 1, color: 'text.secondary', cursor: 'pointer' }} />
                        </Tooltip>
                    </Box>
                    {isLoading ? (
                        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} data-testid="loading-skeleton" />
                    ) : (
                        <Wallet onConnectionChange={handleWalletConnectionChange} />
                    )}
                </Paper>

                {/* Tabs Section */}
                <Paper elevation={3} sx={{ width: '100%', mt: 3, borderRadius: 2 }}>
                    <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: { xs: '0.8rem', sm: '1rem' }, minHeight: { xs: '48px', sm: '64px' } } }}>
                        <Tab label={isMobile ? "Inspector" : "Transaction Inspector"} icon={<Description />} iconPosition="start" />
                        <Tab label={isMobile ? "Live" : "Live Actions"} icon={<Stream />} iconPosition="start" />
                        <Tab label={isMobile ? "Rationale" : "Rationale Generator"} icon={<Create />} iconPosition="start" />
                        <Tab label={isMobile ? "Poll" : "Internal Poll"} icon={<HowToVote />} iconPosition="start" />
                    </Tabs>

                    {/* Tab Panels */}
                    <TabPanel value={tabValue} index={0}>
                        {isLoading ? <Skeleton variant="rectangular" height={200} /> : <TransactionButton />}
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <LiveActions onUpdate={handleProposalsUpdate} />
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                        <CreateRationale />
                    </TabPanel>

                    <TabPanel value={tabValue} index={3}>
                        <InternalVote
                            connectedWalletAddress={stakeCredential}
                            proposals={proposals}
                        />
                    </TabPanel>
                </Paper>

                {/* Footer */}
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", mt: 4, mb: 2, px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
                    <a href="https://github.com/IntersectMBO/council-toolkit-app" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
                        <Image src="/images/github-mark.svg" alt="GitHub" width={24} height={24} />
                        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>View on GitHub</Typography>
                    </a>
                    <Box sx={{ flexGrow: 1 }} />
                </Box>
            </Container>
        </Box>
    );
}
