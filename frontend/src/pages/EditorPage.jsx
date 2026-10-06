import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import SongSidebar from "../components/SongSideBar";
import SongTextarea from "../components/SongTextArea.jsx";
import SongViewer from "../components/SongViewer.jsx";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
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

    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [editedText, setEditedText] = useState("");
    const [isDraft, setIsDraft] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [saving, setSaving] = useState(false);

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

    return (
        <Box
            sx={{
                display: "flex",
                height: "calc(100vh - 64px)",
            }}
        >
            <Box
                sx={{
                    width: 300,
                    borderRight: "1px solid #ddd",
                    overflowY: "auto",
                }}
            >
                {performanceLocked ? (
                    <Alert severity="info" id="performance-readonly-hint" sx={{ mb: 1 }}>
                        Im Performance Mode nicht verfügbar.
                    </Alert>
                ) : null}
                <SongSidebar
                    songs={songs}
                    onSelect={handleSelectSong}
                    onNew={handleNewSong}
                    canCreate={canSave}
                    createHint={performanceLocked ? "Im Performance Mode nicht verfügbar." : null}
                />
                {loading ? (
                    <Typography sx={{ px: 2, py: 1 }} variant="body2">
                        Laden…
                    </Typography>
                ) : null}
                {!loading && songs.length === 0 ? (
                    <Typography sx={{ px: 2, py: 1 }} variant="body2">
                        Keine Songs in dieser Band.
                    </Typography>
                ) : null}
            </Box>

            <Box
                sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                <Box sx={{ flex: 1, p: 3, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}>
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
                        p: 3,
                        borderLeft: "1px solid #ddd",
                        overflowY: "auto",
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
