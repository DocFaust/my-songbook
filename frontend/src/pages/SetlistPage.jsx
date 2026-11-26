import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ChordProViewer from "../components/ChordProViewer/index.jsx";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
import { songArtist, songTitle } from "../components/songDisplay.js";
import { listSongs } from "../api/songsApi.js";
import {
    createSetlist,
    deleteSetlist,
    getSetlist,
    listSetlists,
    updateSetlist,
} from "../api/setlistsApi.js";
import { apiErrorMessage, isApiErrorKind } from "../api/apiClient.js";
import { useBand } from "../band/BandContext.jsx";
import { canDeleteBandMusic, canMutateBandMusic } from "../band/bandRoles.js";
import { isBackendUnreachableError } from "../performance/backendReachability.js";
import { readPerformanceMusic } from "../performance/musicRead.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";

function occurrenceKey(songId, index) {
    return `${index}:${songId}`;
}

function moveEntry(entries, index, delta) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= entries.length) {
        return entries;
    }
    const next = [...entries];
    const current = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = current;
    return next;
}

const selectedRowSx = {
    minHeight: 48,
    alignItems: "flex-start",
    py: 1,
    "&.Mui-selected": {
        bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.14),
        boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.secondary.main}`,
    },
    "&.Mui-selected:hover": {
        bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.22),
    },
};

function entryTitle(entry) {
    return entry.song ? songTitle(entry.song) : entry.songId;
}

function SetlistPlayer({ name, entries, index, onIndexChange, onClose }) {
    const entry = entries[index];
    const title = entryTitle(entry);
    const artist = entry.song ? songArtist(entry.song) : "";
    const atStart = index <= 0;
    const atEnd = index >= entries.length - 1;
    const goTo = (nextIndex) => {
        if (nextIndex < 0 || nextIndex >= entries.length) {
            return;
        }
        onIndexChange(nextIndex);
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                    px: { xs: 2, md: 3 },
                    pt: { xs: 2, md: 3 },
                    pb: 1,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                        {name.trim() || "Setlist"}
                    </Typography>
                    <Typography component="p" variant="subtitle1">
                        {`Position ${index + 1} von ${entries.length}`}
                    </Typography>
                </Box>
                <Button variant="outlined" onClick={onClose}>
                    Zur Setlist
                </Button>
            </Box>
            <Box sx={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", px: { xs: 2, md: 3 }, pb: 2 }}>
                <Box
                    className="song-reading"
                    component="article"
                    aria-label="Songblatt"
                    sx={{
                        bgcolor: "background.paper",
                        borderRadius: 2,
                        p: { xs: 2, md: 3 },
                    }}
                >
                    <Typography
                        variant="h3"
                        component="h3"
                        sx={{
                            fontSize: { xs: "1.75rem", md: "2.25rem" },
                            lineHeight: 1.2,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {title}
                    </Typography>
                    {artist ? (
                        <Typography component="p" variant="subtitle1" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                            {artist}
                        </Typography>
                    ) : null}
                    {entry.song ? (
                        <ChordProViewer chordProText={entry.song.content || ""} />
                    ) : (
                        <Typography variant="body1" sx={{ mt: 2 }}>
                            Dieser Song ist in der Band nicht mehr verfügbar.
                        </Typography>
                    )}
                </Box>
            </Box>
            <Box
                component="nav"
                aria-label="Setlist-Navigation"
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    px: { xs: 2, md: 3 },
                    py: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                    bgcolor: "background.default",
                }}
            >
                <Button
                    variant="outlined"
                    onClick={() => goTo(index - 1)}
                    disabled={atStart}
                    sx={{ flex: "1 1 180px", minHeight: 52 }}
                >
                    Vorheriger Song
                </Button>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => goTo(index + 1)}
                    disabled={atEnd}
                    sx={{ flex: "1 1 180px", minHeight: 52 }}
                >
                    Nächster Song
                </Button>
            </Box>
        </Box>
    );
}

function SetlistWorkspace() {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const { activeBand } = useBand();
    const token = auth.user?.access_token;
    const bandId = activeBand.id;
    const performanceLocked = performance.active;
    const performanceUserId = performance.userId;
    const performanceRevision = performance.revision;
    const reportUnreachable = performance.reportUnreachable;
    const canMutate = canMutateBandMusic(activeBand.role) && !performanceLocked;
    const canDelete = canDeleteBandMusic(activeBand.role) && !performanceLocked;

    const [songs, setSongs] = useState([]);
    const [setlists, setSetlists] = useState([]);
    const [name, setName] = useState("");
    const [entries, setEntries] = useState([]);
    const [songToAdd, setSongToAdd] = useState("");
    const [editing, setEditing] = useState(null);
    const [playingIndex, setPlayingIndex] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = performanceLocked
            ? readPerformanceMusic(performanceUserId, bandId).then((music) => [music.songs, music.setlists])
            : Promise.all([
                listSongs({ token, bandId }),
                listSetlists({ token, bandId }),
            ]);
        Promise.resolve(load)
            .then(([songList, setlistList]) => {
                if (cancelled) {
                    return;
                }
                setSongs(Array.isArray(songList) ? songList : []);
                setSetlists(Array.isArray(setlistList) ? setlistList : []);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                if (!performanceLocked && isBackendUnreachableError(err)) {
                    reportUnreachable();
                }
                setError(apiErrorMessage(err));
                setSongs([]);
                setSetlists([]);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, bandId, performanceLocked, performanceUserId, performanceRevision, reportUnreachable]);

    const resolvedEntries = useMemo(
        () =>
            entries.map((songId, index) => ({
                key: occurrenceKey(songId, index),
                index,
                songId,
                song: songs.find((song) => song.id === songId) ?? null,
            })),
        [entries, songs]
    );

    if (playingIndex != null && !resolvedEntries[playingIndex]) {
        setPlayingIndex(null);
    }

    const resetForm = () => {
        setName("");
        setEntries([]);
        setEditing(null);
        setConflict(null);
        setSongToAdd("");
        setPlayingIndex(null);
    };

    const addToSetlist = (songId) => {
        if (!songId || !canMutate) {
            return;
        }
        setEntries((prev) => [...prev, songId]);
        setSongToAdd("");
    };

    const removeOccurrence = (index) => {
        if (!canMutate) {
            return;
        }
        setEntries((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    };

    const moveOccurrence = (index, delta) => {
        if (!canMutate) {
            return;
        }
        setEntries((prev) => moveEntry(prev, index, delta));
    };

    const loadSetlist = (setlist) => {
        setName(setlist.name);
        setEntries([...(setlist.songIds ?? [])]);
        setEditing({ id: setlist.id, version: setlist.version });
        setConflict(null);
        setError(null);
        setPlayingIndex(null);
    };

    const startPlay = (index) => {
        if (index < 0 || index >= entries.length) {
            return;
        }
        setPlayingIndex(index);
    };

    const save = async () => {
        if (!canMutate || !name.trim()) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editing) {
                const updated = await updateSetlist({
                    token,
                    bandId,
                    setlistId: editing.id,
                    name: name.trim(),
                    songIds: entries,
                    version: editing.version,
                });
                setSetlists((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                setEditing({ id: updated.id, version: updated.version });
                setEntries([...(updated.songIds ?? [])]);
                setName(updated.name);
                setConflict(null);
            } else {
                const created = await createSetlist({
                    token,
                    bandId,
                    name: name.trim(),
                    songIds: entries,
                });
                setSetlists((prev) => [...prev, created]);
                setEditing({ id: created.id, version: created.version });
                setEntries([...(created.songIds ?? [])]);
                setName(created.name);
                setConflict(null);
            }
        } catch (err) {
            if (isApiErrorKind(err, "conflict")) {
                setConflict(
                    "Diese Setlist wurde zwischenzeitlich geändert. Die aktuelle Zusammenstellung bleibt erhalten, bis du sie vom Server neu lädst."
                );
            } else {
                setError(apiErrorMessage(err));
            }
        } finally {
            setSaving(false);
        }
    };

    const handleReloadConflict = async () => {
        if (!editing?.id) {
            return;
        }
        setError(null);
        try {
            const fresh = await getSetlist({ token, bandId, setlistId: editing.id });
            loadSetlist(fresh);
            setSetlists((prev) => prev.map((item) => (item.id === fresh.id ? fresh : item)));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const handleDelete = async (setlist) => {
        if (!canDelete) {
            return;
        }
        setError(null);
        try {
            await deleteSetlist({
                token,
                bandId,
                setlistId: setlist.id,
                version: setlist.version,
            });
            setSetlists((prev) => prev.filter((item) => item.id !== setlist.id));
            if (editing?.id === setlist.id) {
                resetForm();
            }
        } catch (err) {
            if (isApiErrorKind(err, "conflict")) {
                setConflict(
                    "Diese Setlist wurde zwischenzeitlich geändert. Sie wurde nicht gelöscht."
                );
            } else {
                setError(apiErrorMessage(err));
            }
        }
    };

    if (playingIndex != null && resolvedEntries[playingIndex]) {
        return (
            <SetlistPlayer
                name={name}
                entries={resolvedEntries}
                index={playingIndex}
                onIndexChange={setPlayingIndex}
                onClose={() => setPlayingIndex(null)}
            />
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                height: "100%",
                minHeight: 0,
            }}
        >
            <Box
                sx={{
                    width: { xs: "100%", md: 300 },
                    flex: { xs: "0 0 auto", md: "0 0 300px" },
                    maxHeight: { xs: "42vh", md: "none" },
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    borderRight: { md: 1 },
                    borderBottom: { xs: 1, md: 0 },
                    borderColor: "divider",
                }}
            >
                <Box sx={{ p: 1.5, flexShrink: 0 }}>
                    <Button variant="contained" color="secondary" onClick={resetForm} disabled={saving} fullWidth>
                        Neue Setlist
                    </Button>
                </Box>
                <Box sx={{ overflow: "auto", flex: "1 1 auto", minHeight: 0, px: 1.5, pb: 1.5 }}>
                    {loading ? (
                        <Typography variant="body2" sx={{ my: 1 }}>
                            Laden…
                        </Typography>
                    ) : null}
                    {!loading && setlists.length === 0 ? (
                        <Typography variant="body2" sx={{ my: 1 }}>
                            Keine Setlists in dieser Band.
                        </Typography>
                    ) : null}
                    <List aria-label="Gespeicherte Setlists" sx={{ py: 0 }}>
                        {setlists.map((setlist) => (
                            <ListItem key={setlist.id} disablePadding sx={{ display: "block", mb: 1 }}>
                                <ListItemButton
                                    selected={editing?.id === setlist.id}
                                    onClick={() => loadSetlist(setlist)}
                                    sx={selectedRowSx}
                                >
                                    <ListItemText primary={`${setlist.name} (${(setlist.songIds ?? []).length})`} />
                                </ListItemButton>
                                <Box sx={{ px: 1, pb: 0.5 }}>
                                    <Button
                                        color="error"
                                        onClick={() => handleDelete(setlist)}
                                        disabled={!canDelete}
                                    >
                                        Löschen
                                    </Button>
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </Box>

            <Box sx={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, overflow: "auto", p: { xs: 2, md: 3 } }}>
                <Typography variant="h5" component="h3" sx={{ mb: 1 }}>
                    {editing ? (name.trim() || "Setlist") : "Neue Setlist"}
                </Typography>
                {performanceLocked ? (
                    <Alert severity="info" id="performance-readonly-hint" sx={{ mb: 1 }}>
                        Im Performance Mode nicht verfügbar.
                    </Alert>
                ) : null}
                {error ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                        {error}
                    </Alert>
                ) : null}
                {conflict ? (
                    <Alert
                        severity="warning"
                        sx={{ mb: 1 }}
                        action={
                            editing ? (
                                <Button color="inherit" size="small" onClick={handleReloadConflict}>
                                    Vom Server laden
                                </Button>
                            ) : null
                        }
                    >
                        {conflict}
                    </Alert>
                ) : null}
                <TextField
                    label="Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ my: 1 }}
                    disabled={!canMutate}
                />
                <TextField
                    select
                    label="Song hinzufügen"
                    fullWidth
                    value={songToAdd}
                    onChange={(event) => addToSetlist(event.target.value)}
                    disabled={!canMutate || songs.length === 0}
                >
                    <MenuItem value="" disabled>
                        Song wählen…
                    </MenuItem>
                    {songs.map((song) => (
                        <MenuItem key={song.id} value={song.id}>
                            {song.title || song.id}
                        </MenuItem>
                    ))}
                </TextField>
                {resolvedEntries.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Füge Songs hinzu. Ein Song darf in der Setlist mehrfach stehen.
                    </Typography>
                ) : null}
                <List aria-label="Setlist-Einträge" sx={{ my: 1, py: 0 }}>
                    {resolvedEntries.map((entry) => {
                        const title = entryTitle(entry);
                        return (
                            <ListItem key={entry.key} disablePadding sx={{ display: "block", mb: 1 }}>
                                <ListItemButton
                                    onClick={() => startPlay(entry.index)}
                                    aria-label={`Position ${entry.index + 1}: ${title}`}
                                    sx={selectedRowSx}
                                >
                                    <ListItemText
                                        primary={`${entry.index + 1}. ${title}`}
                                        secondary={
                                            entry.song
                                                ? (songArtist(entry.song) || null)
                                                : "Dieser Song ist in der Band nicht mehr verfügbar."
                                        }
                                    />
                                </ListItemButton>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 1, pb: 0.5 }}>
                                    <Button
                                        onClick={() => moveOccurrence(entry.index, -1)}
                                        disabled={!canMutate || entry.index === 0}
                                    >
                                        Hoch
                                    </Button>
                                    <Button
                                        onClick={() => moveOccurrence(entry.index, 1)}
                                        disabled={!canMutate || entry.index === resolvedEntries.length - 1}
                                    >
                                        Runter
                                    </Button>
                                    <Button
                                        onClick={() => removeOccurrence(entry.index)}
                                        disabled={!canMutate}
                                    >
                                        Entfernen
                                    </Button>
                                </Box>
                            </ListItem>
                        );
                    })}
                </List>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => startPlay(0)}
                        disabled={resolvedEntries.length === 0}
                        sx={{ minWidth: 140 }}
                    >
                        Spielen
                    </Button>
                    <Button
                        variant="contained"
                        onClick={save}
                        disabled={!canMutate || saving}
                        aria-describedby={performanceLocked ? "performance-readonly-hint" : undefined}
                    >
                        Setlist speichern
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}

export default function SetlistPage() {
    return (
        <MusicWorkflowGate>
            <SetlistWorkspace />
        </MusicWorkflowGate>
    );
}
