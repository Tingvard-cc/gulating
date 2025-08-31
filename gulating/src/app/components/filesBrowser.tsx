"use client";

import {
    Box,
    Breadcrumbs,
    Link as MLink,
    Typography,
    Paper,
    Table,
    TableHead,
    TableBody,
    TableCell,
    TableRow,
    TableContainer,
    IconButton,
    Tooltip,
    Skeleton,
    Alert,
    Chip,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = {
    name: string;
    path: string; // relative to root
    isDir: boolean;
    size: number | null;
    mtime: string;
};

async function fetchDir(relPath: string) {
    const r = await fetch(`/api/files?path=${encodeURIComponent(relPath)}`);
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as { entries: Entry[]; cwd: string };
}

function humanSize(n: number | null) {
    if (n == null) return "—";
    if (n < 1024) return `${n} B`;
    const i = Math.floor(Math.log(n) / Math.log(1024));
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    return `${(n / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default function FilesBrowser() {
    const [cwd, setCwd] = useState<string>("");
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const load = useCallback(async (rel: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchDir(rel);
            setEntries(data.entries);
            setCwd(data.cwd);
        } catch (e: any) {
            setError(e?.message || "Failed to load directory");
            setEntries(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load("");
    }, [load]);

    const crumbs = useMemo(() => {
        const parts = cwd ? cwd.replaceAll("\\", "/").split("/") : [];
        const list = [{ label: "root", rel: "" }];
        let acc = "";
        for (const p of parts) {
            acc = acc ? `${acc}/${p}` : p;
            list.push({ label: p, rel: acc });
        }
        return list;
    }, [cwd]);

    const goUp = () => {
        if (!cwd) return;
        const parts = cwd.replaceAll("\\", "/").split("/");
        parts.pop();
        load(parts.join("/"));
    };

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
                <Tooltip title={cwd ? "Up one level" : ""}>
                    <span>
                        <IconButton onClick={goUp} disabled={!cwd}>
                            <ArrowBackIcon />
                        </IconButton>
                    </span>
                </Tooltip>

                <Breadcrumbs aria-label="breadcrumb" sx={{ flexWrap: "wrap" }}>
                    {crumbs.map((c, i) =>
                        i === crumbs.length - 1 ? (
                            <Typography color="text.primary" key={i}>
                                {c.label}
                            </Typography>
                        ) : (
                            <MLink
                                key={i}
                                underline="hover"
                                color="inherit"
                                sx={{ cursor: "pointer" }}
                                onClick={() => load(c.rel)}
                            >
                                {c.label}
                            </MLink>
                        )
                    )}
                </Breadcrumbs>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
                {loading ? (
                    <Box sx={{ p: 2 }}>
                        <Skeleton variant="text" height={32} />
                        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1 }} />
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small" aria-label="files table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Size</TableCell>
                                    <TableCell>Modified</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {entries?.map((e) => {
                                    const isDir = e.isDir;
                                    const modified = e.mtime ? new Date(e.mtime).toLocaleString() : "—";
                                    return (
                                        <TableRow
                                            key={e.path}
                                            hover
                                            sx={{ cursor: isDir ? "pointer" : "default" }}
                                            onClick={(evt) => {
                                                if (isDir && (evt.target as HTMLElement).closest("button") == null) {
                                                    load(e.path);
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    {isDir ? <FolderIcon /> : <InsertDriveFileIcon />}
                                                    <Typography>{e.name}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell width={120}>
                                                {isDir ? <Chip size="small" label="Folder" /> : <Chip size="small" label="File" />}
                                            </TableCell>
                                            <TableCell align="right" width={120}>
                                                {humanSize(e.size)}
                                            </TableCell>
                                            <TableCell width={200}>{modified}</TableCell>
                                            <TableCell align="right" width={120}>
                                                {!isDir && (
                                                    <Tooltip title="Download">
                                                        <IconButton
                                                            href={`/api/files/download?path=${encodeURIComponent(e.path)}`}
                                                            onClick={(evt) => evt.stopPropagation()}
                                                        >
                                                            <DownloadIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!entries?.length && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                                                Empty folder
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
}
