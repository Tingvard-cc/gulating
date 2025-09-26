"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import ArticleIcon from "@mui/icons-material/Article";
import type {
  AuthorVerificationResult,
  CIP100VerificationResult,
} from "@/lib/cip100Verification";
import { cip100Example } from "@/data/cip100Example";

type VerificationResponse = CIP100VerificationResult & {
  details?: string;
};

export default function MetadataVerificationPage() {
  const [jsonInput, setJsonInput] = useState<string>("");
  const [verification, setVerification] =
    useState<VerificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasParsedQuery = useRef(false);

  useEffect(() => {
    const parseLocation = () => {
      if (typeof window === "undefined") {
        return;
      }

      const { hash, search } = window.location;

      if (hash.startsWith("#")) {
        try {
          const decoded = decodeURIComponent(hash.substring(1));
          const parsed = JSON.parse(decoded);
          setJsonInput(JSON.stringify(parsed, null, 2));
          setError(null);
          setVerification(null);
        } catch (err) {
          setError("Failed to parse JSON from URL hash");
        }
        return;
      }

      if (!hasParsedQuery.current) {
        hasParsedQuery.current = true;
        const params = new URLSearchParams(search);
        const rawJson = params.get("rawjson");
        if (rawJson) {
          try {
            const decoded = decodeURIComponent(rawJson);
            const parsed = JSON.parse(decoded);
            setJsonInput(JSON.stringify(parsed, null, 2));
            setError(null);
            setVerification(null);
          } catch (err) {
            setError("Failed to parse JSON from rawjson parameter");
          }
        }
      }
    };

    parseLocation();
    window.addEventListener("hashchange", parseLocation);
    return () => {
      window.removeEventListener("hashchange", parseLocation);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setVerification(null);
    setIsLoading(true);

    try {
      let metadata: unknown;
      try {
        metadata = JSON.parse(jsonInput);
      } catch (err) {
        throw new Error("Invalid JSON format");
      }

      const response = await fetch("/api/verify-cip100", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metadata }),
      });

      const data = (await response.json()) as VerificationResponse | {
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        const errorMessage =
          ("error" in data && data.error) ||
          ("details" in data && data.details) ||
          "Verification failed";
        throw new Error(errorMessage);
      }

      setVerification(data as VerificationResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExample = () => {
    setJsonInput(JSON.stringify(cip100Example, null, 2));
    setError(null);
    setVerification(null);
  };

  const handleReset = () => {
    setJsonInput("");
    setError(null);
    setVerification(null);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (err) {
      setError("Invalid JSON - cannot format");
    }
  };

  const renderAuthor = (author: AuthorVerificationResult, index: number) => (
    <Paper
      key={`${author.name}-${index}`}
      variant="outlined"
      sx={{
        p: 2.5,
        borderColor: author.valid ? "success.light" : "error.light",
        backgroundColor: (theme) =>
          alpha(
            author.valid
              ? theme.palette.success.light
              : theme.palette.error.light,
            0.18
          ),
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {author.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Algorithm: {author.witnessAlgorithm ?? "Unknown"}
            </Typography>
          </Box>
          <Chip
            icon={author.valid ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
            label={author.valid ? "Valid" : "Invalid"}
            color={author.valid ? "success" : "error"}
            variant={author.valid ? "filled" : "outlined"}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>

        {author.publicKey && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Public Key
            </Typography>
            <Box
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                p: 1.5,
                borderRadius: 1,
                border: "1px solid",
                borderColor: author.valid ? "success.light" : "error.light",
                backgroundColor: "background.paper",
              }}
            >
              {author.publicKey}
            </Box>
          </Box>
        )}

        {author.error && (
          <Alert severity="warning" variant="filled">
            {author.error}
          </Alert>
        )}

        {author.signature && (
          <Accordion elevation={0} sx={{ backgroundColor: "transparent" }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" color="text.secondary">
                View signature details
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  p: 1.5,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "background.paper",
                }}
              >
                {author.signature}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Stack>
    </Paper>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 4, md: 8 },
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.grey[200]} 100%)`,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          mb={4}
        >
          <Box>
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Metadata Verification
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Validate CIP-100 governance metadata, authors, and signatures.
            </Typography>
          </Box>
          <Button
            component={Link}
            href="/"
            variant="outlined"
            startIcon={<ArticleIcon />}
          >
            Back to Toolkit
          </Button>
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h5" fontWeight={600} gutterBottom>
                    Governance Metadata JSON-LD
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paste CIP-100 compliant governance metadata to verify canonized
                    hashes and author signatures.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    onClick={loadExample}
                    variant="contained"
                    color="secondary"
                    startIcon={<FactCheckIcon />}
                    size="small"
                  >
                    Load example
                  </Button>
                  <Button
                    onClick={formatJson}
                    variant="outlined"
                    startIcon={<FormatAlignLeftIcon />}
                    size="small"
                  >
                    Format JSON
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outlined"
                    color="inherit"
                    startIcon={<RestartAltIcon />}
                    size="small"
                  >
                    Reset
                  </Button>
                </Stack>

                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <Stack spacing={2.5}>
                    <TextField
                      label="CIP-100 Governance Metadata"
                      value={jsonInput}
                      onChange={(event) => setJsonInput(event.target.value)}
                      placeholder="Paste your CIP-100 governance metadata JSON here..."
                      minRows={16}
                      multiline
                      fullWidth
                      required
                      InputProps={{
                        sx: {
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                        },
                      }}
                    />

                    {error && (
                      <Alert severity="error" variant="filled">
                        {error}
                      </Alert>
                    )}

                    <Box display="flex" justifyContent="flex-end">
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        startIcon={
                          isLoading ? <CircularProgress color="inherit" size={20} /> : <FactCheckIcon />
                        }
                        disabled={isLoading || !jsonInput.trim()}
                      >
                        {isLoading ? "Verifying..." : "Verify metadata"}
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, minHeight: "100%" }}>
              <Stack spacing={3} height="100%">
                <Typography variant="h5" fontWeight={600}>
                  Verification Results
                </Typography>

                {verification ? (
                  <Stack spacing={3} flexGrow={1}>
                    <Alert
                      severity={verification.result ? "success" : "error"}
                      iconMapping={{
                        success: <CheckCircleOutlineIcon fontSize="inherit" />,
                        error: <ErrorOutlineIcon fontSize="inherit" />,
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Overall result: {verification.result ? "Valid" : "Invalid"}
                      </Typography>
                      {verification.errorMsg && (
                        <Typography variant="body2">{verification.errorMsg}</Typography>
                      )}
                    </Alert>

                    {verification.canonizedHash && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Canonized hash (BLAKE2b-256)
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            p: 1.5,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            backgroundColor: "background.paper",
                          }}
                        >
                          {verification.canonizedHash}
                        </Box>
                      </Box>
                    )}

                    <Divider />

                    {verification.authors.length > 0 ? (
                      <Stack spacing={2.5}>
                        {verification.authors.map(renderAuthor)}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No authors found in the metadata payload.
                      </Typography>
                    )}

                    {verification.body && (
                      <Accordion elevation={0} sx={{ mt: "auto" }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Show metadata body
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box
                            component="pre"
                            sx={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                              p: 1.5,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                              backgroundColor: "background.paper",
                              maxHeight: 320,
                              overflow: "auto",
                            }}
                          >
                            {JSON.stringify(verification.body, null, 2)}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Stack>
                ) : (
                  <Box
                    flexGrow={1}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    textAlign="center"
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        No verification yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Submit governance metadata to view signature checks and canonized hash information.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Box mt={6} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Powered by the Cardano Foundation open-source CIP-100 verification reference implementation.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
