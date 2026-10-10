import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import SongActions from "../components/SongActions.jsx";
import SongSidebar from "../components/SongSideBar";
import { filterSongs } from "../components/SongSideBar/filterSongs.js";
import SongTextarea from "../components/SongTextArea.jsx";
import SongViewer from "../components/SongViewer.jsx";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createSong, getSong, listSongs, updateSong } from "../api/songsApi.js";
import { apiErrorMessage, isApiErrorKind } from "../api/apiClient.js";
import PersonalSongNotePanel from "../components/PersonalSongNotePanel.jsx";
import { useBand } from "../band/BandContext.jsx";
import { canMutateBandMusic } from "../band/bandRoles.js";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
import { isBackendUnreachableError } from "../performance/backendReachability.js";
import { readPerformanceSongs } from "../performance/musicRead.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";

function EditorWorkspace() {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const { activeBand } = useBand();
    const token = auth.user?.access_token;
    const bandId = activeBand.id;
    const performanceLocked = performance.active;
    const performanceUserId = performance.userId;
    const performanceRevision = performance.revision;
    const reportUnreachable = performance.reportUnreachable;
    const canSave = canMutateBandMusic(activeBand.role) && !performanceLocked;
    const location = useLocation();
    const navigate = useNavigate();

    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [editedText, setEditedText] = useState("");
    const [isDraft, setIsDraft] = useState(() => location.state?.createSong === true && canSave);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [appliedCreateKey, setAppliedCreateKey] = useState(null);
    const createRequested = location.state?.createSong === true;
    const createKey = createRequested ? location.key : null;
    if (createKey && createKey !== appliedCreateKey) {
        setAppliedCreateKey(createKey);
        if (canSave) {
            setSelectedSong(null);
            setEditedText("");
            setIsDraft(true);
            setConflict(null);
            setError(null);
        }
    }

    const handleNewSong = () => {
        if (!canSave) {
            return;
        }
        setSelectedSong(null);
        setEditedText("");
        setIsDraft(true);
        setConflict(null);
        setError(null);
    };

    useEffect(() => {
        if (!createRequested) {
            return undefined;
        }
        const timer = window.setTimeout(() => {
            navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [createRequested, location.pathname, location.search, navigate]);

    useEffect(() => {
        let cancelled = false;
        const load = performanceLocked
            ? readPerformanceSongs(performanceUserId, bandId)
            : listSongs({ token, bandId });
        Promise.resolve(load)
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setSongs(Array.isArray(data) ? data : []);
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
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, bandId, performanceLocked, performanceUserId, performanceRevision, reportUnreachable]);

    const handleSelectSong = (song) => {
        setSelectedSong(song);
        setEditedText(song.content || "");
        setIsDraft(false);
        setConflict(null);
    };

    const handleSave = async () => {
        if (!canSave || (!selectedSong && !isDraft)) {
            return;
        }

        setSaving(true);
        setError(null);
        try {
            if (isDraft || !selectedSong?.id) {
                const created = await createSong({
                    token,
                    bandId,
                    title: "Neuer Song",
                    artist: "",
                    content: editedText,
                });
                setSongs((prev) => [...prev, created]);
                setSelectedSong(created);
                setEditedText(created.content);
                setIsDraft(false);
                setConflict(null);
                return;
            }

            const updated = await updateSong({
                token,
                bandId,
                songId: selectedSong.id,
                title: selectedSong.title,
                artist: selectedSong.artist ?? "",
                content: editedText,
                version: selectedSong.version,
            });
            setSongs((prev) => prev.map((song) => (song.id === updated.id ? updated : song)));
            setSelectedSong(updated);
            setEditedText(updated.content);
            setConflict(null);
        } catch (err) {
            if (isApiErrorKind(err, "conflict")) {
                setConflict(
                    "Dieser Song wurde zwischenzeitlich geändert. Dein aktueller Text bleibt erhalten, bis du ihn vom Server neu lädst."
                );
            } else {
                setError(apiErrorMessage(err));
            }
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const handleReloadConflict = async () => {
        if (!selectedSong?.id) {
            return;
        }
        setError(null);
        try {
            const fresh = await getSong({ token, bandId, songId: selectedSong.id });
            setSelectedSong(fresh);
            setEditedText(fresh.content || "");
            setSongs((prev) => prev.map((song) => (song.id === fresh.id ? fresh : song)));
            setConflict(null);
            setIsDraft(false);
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const visibleSongs = filterSongs(songs, query);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                flex: 1,
                height: "100%",
                minHeight: 0,
            }}
        >
            <Box
                sx={{
                    width: { xs: "100%", md: 320 },
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    maxHeight: { xs: "42%", md: "100%" },
                    bgcolor: "background.paper",
                    borderRight: { md: 1 },
                    borderBottom: { xs: 1, md: 0 },
                    borderColor: "divider",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        flexWrap: "wrap",
                        p: 1.5,
                    }}
                >
                    <TextField
                        label="Song suchen"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        size="small"
                        fullWidth
                        sx={{ flex: "1 1 160px", "& .MuiInputBase-root": { minHeight: 44 } }}
                    />
                    <SongActions onCreate={handleNewSong} />
                </Box>
                {performanceLocked ? (
                    <Alert severity="info" id="performance-readonly-hint" sx={{ mx: 1.5, mb: 1 }}>
                        Im Performance Mode nicht verfügbar.
                    </Alert>
                ) : null}
                {loading ? (
                    <Typography sx={{ px: 2, py: 1 }} variant="body2">
                        Laden…
                    </Typography>
                ) : null}
                {!loading && songs.length === 0 ? (
                    <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="body2">Noch keine Songs im Repertoire.</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Erstelle deinen ersten Song oder importiere einen bestehenden ChordPro-Song.
                        </Typography>
                    </Box>
                ) : null}
                {!loading && songs.length > 0 && visibleSongs.length === 0 ? (
                    <Typography sx={{ px: 2, py: 1 }} variant="body2">
                        Keine Songs passen zur Suche.
                    </Typography>
                ) : null}
                <Box sx={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
                    <SongSidebar
                        songs={visibleSongs}
                        onSelect={handleSelectSong}
                        selectedId={selectedSong?.id ?? null}
                    />
                </Box>
            </Box>

            <Box
                sx={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: { xs: "column", lg: "row" },
                    overflow: "auto",
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}>
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
                                <Button color="inherit" size="small" onClick={handleReloadConflict}>
                                    Vom Server laden
                                </Button>
                            }
                        >
                            {conflict}
                        </Alert>
                    ) : null}
                    <SongTextarea
                        selectedSong={selectedSong}
                        editedText={editedText}
                        onChange={setEditedText}
                        onSave={handleSave}
                        isDraft={isDraft}
                        saving={saving}
                        canSave={canSave}
                        readOnly={performanceLocked}
                    />
                    {selectedSong || isDraft ? (
                        <PersonalSongNotePanel
                            key={selectedSong?.id ?? "draft"}
                            token={token}
                            bandId={bandId}
                            songId={selectedSong?.id ?? null}
                            offline={performanceLocked ? { userId: performanceUserId } : null}
                        />
                    ) : null}
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        p: { xs: 2, md: 3 },
                        borderTop: { xs: 1, lg: 0 },
                        borderLeft: { lg: 1 },
                        borderColor: "divider",
                        overflowY: "auto",
                        bgcolor: "background.paper",
                    }}
                >
                    <SongViewer chordProText={editedText} />
                </Box>
            </Box>
        </Box>
    );
}

export default function EditorPage() {
    return (
        <MusicWorkflowGate>
            <EditorWorkspace />
        </MusicWorkflowGate>
    );
}
