import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
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
import SongViewer from "../components/SongViewer.jsx";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
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

function SetlistWorkspace() {
    const auth = useAuth();
    const { activeBand } = useBand();
    const token = auth.user?.access_token;
    const bandId = activeBand.id;
    const canMutate = canMutateBandMusic(activeBand.role);
    const canDelete = canDeleteBandMusic(activeBand.role);

    const [songs, setSongs] = useState([]);
    const [setlists, setSetlists] = useState([]);
    const [name, setName] = useState("");
    const [entries, setEntries] = useState([]);
    const [songToAdd, setSongToAdd] = useState("");
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            listSongs({ token, bandId }),
            listSetlists({ token, bandId }),
        ])
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
                setError(apiErrorMessage(err));
                setSongs([]);
                setSetlists([]);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, bandId]);

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

    const resetForm = () => {
        setName("");
        setEntries([]);
        setEditing(null);
        setConflict(null);
        setSongToAdd("");
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

    return (
        <Box sx={{ display: "flex", gap: 2, p: 2 }}>
            <Box sx={{ width: 360 }}>
                <Typography variant="h6">
                    {editing ? "Setlist bearbeiten" : "Neue Setlist"}
                </Typography>
                {loading ? (
                    <Typography variant="body2" sx={{ my: 1 }}>
                        Laden…
                    </Typography>
                ) : null}
                {error ? (
                    <Alert severity="error" sx={{ my: 1 }}>
                        {error}
                    </Alert>
                ) : null}
                {conflict ? (
                    <Alert
                        severity="warning"
                        sx={{ my: 1 }}
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
                <List
                    dense
                    aria-label="Setlist-Einträge"
                    sx={{ border: "1px solid #ddd", my: 1, maxHeight: 280, overflowY: "auto" }}
                >
                    {resolvedEntries.map((entry) => (
                        <ListItem
                            key={entry.key}
                            secondaryAction={
                                <Box sx={{ display: "flex", gap: 0.5 }}>
                                    <Button
                                        size="small"
                                        onClick={() => moveOccurrence(entry.index, -1)}
                                        disabled={!canMutate || entry.index === 0}
                                    >
                                        Hoch
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => moveOccurrence(entry.index, 1)}
                                        disabled={!canMutate || entry.index === resolvedEntries.length - 1}
                                    >
                                        Runter
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => removeOccurrence(entry.index)}
                                        disabled={!canMutate}
                                    >
                                        Entfernen
                                    </Button>
                                </Box>
                            }
                            sx={{ pr: 28 }}
                        >
                            {entry.song?.title || entry.songId}
                        </ListItem>
                    ))}
                </List>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="contained" onClick={save} disabled={!canMutate || saving}>
                        Setlist speichern
                    </Button>
                    {editing ? (
                        <Button onClick={resetForm} disabled={saving}>
                            Neue Setlist
                        </Button>
                    ) : null}
                </Box>

                <Typography variant="h6" sx={{ mt: 3 }}>Gespeicherte Setlists</Typography>
                {!loading && setlists.length === 0 ? (
                    <Typography variant="body2" sx={{ my: 1 }}>
                        Keine Setlists in dieser Band.
                    </Typography>
                ) : null}
                <List
                    dense
                    aria-label="Gespeicherte Setlists"
                    sx={{ border: "1px solid #ddd", my: 1, maxHeight: 240, overflowY: "auto" }}
                >
                    {setlists.map((setlist) => (
                        <ListItem
                            key={setlist.id}
                            disablePadding
                            secondaryAction={
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => handleDelete(setlist)}
                                    disabled={!canDelete}
                                >
                                    Löschen
                                </Button>
                            }
                        >
                            <ListItemButton
                                selected={editing?.id === setlist.id}
                                onClick={() => loadSetlist(setlist)}
                            >
                                <ListItemText primary={`${setlist.name} (${setlist.songIds.length})`} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Auftritts-Ansicht (Preview)</Typography>
                {resolvedEntries.length === 0 ? (
                    <Typography variant="body2">Wähle Songs für die Vorschau.</Typography>
                ) : (
                    resolvedEntries.map((entry) => (
                        <Box key={`preview-${entry.key}`} sx={{ mb: 4, p: 2, border: "1px solid #eee", borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                {entry.song?.title || entry.songId}
                            </Typography>
                            {entry.song ? (
                                <SongViewer chordProText={entry.song.content} />
                            ) : (
                                <Typography variant="body2">
                                    Dieser Song ist in der Band nicht mehr verfügbar.
                                </Typography>
                            )}
                        </Box>
                    ))
                )}
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
