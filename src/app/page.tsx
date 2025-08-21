"use client";

import { Wallet } from "./components/wallet";
import { TransactionButton } from "./components/transaction";
import { Container, Typography, Box, Tabs, Tab, Paper } from "@mui/material";
import Image from "next/image";
import { useState } from "react";
import { LiveActions } from "./components/LiveActions";

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
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function Home() {
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Box className="background-container">
            <Container maxWidth="md" sx={{ display: "flex", backgroundColor: "rgba(255, 255, 255, 0.7)", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", minHeight: "100vh", padding: 2 }}>
                {/* Header */}
                <Box sx={{
                    width: "100%",
                    marginTop: "20px",
                    padding: "15px 0 15px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Image src="/images/Logo.svg" alt="Logo" width={150} height={150} />
                </Box>

                {/* Wallet - Persistent across all tabs */}
                <Box width="100%" mb={3}>
                    <Wallet />
                </Box>

                {/* Tabs */}
                <Paper sx={{ width: '100%' }}>
                    <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab label="Transaction Inspector" />
                        <Tab label="Live Actions" />
                    </Tabs>

                    {/* Tab Panels */}
                    <TabPanel value={tabValue} index={0}>
                        <TransactionButton />
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <LiveActions />
                    </TabPanel>
                </Paper>

                {/* Footer */}
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", mt: 3 }}>
                    <a href="https://github.com/IntersectMBO/council-toolkit-app" target="_blank">
                        <Image src="/images/github-mark.svg" alt="Logo" width={24} height={24} />
                    </a>

                    <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
                        <Typography>Version 2.0.1 - Tingvard</Typography>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}