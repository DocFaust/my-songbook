import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { createSong, getSong, listSongs, updateSong } from "../api/songsApi.js";
import { apiErrorMessage, isApiErrorKind } from "../api/apiClient.js";
import SongListPane from "../components/SongListPane.jsx";
import SongNotes from "../components/SongNotes.jsx";
import SongSheet from "../components/SongSheet.jsx";
import SongTextarea from "../components/SongTextArea.jsx";
import { filterSongs } from "../components/SongSideBar/filterSongs.js";
import {
    editBlockedReason,
    isSongContentDirty,
    songArtist,
    songTitle,
} from "../components/songDisplay.js";
import { useBand } from "../band/BandContext.jsx";
import { canMutateBandMusic } from "../band/bandRoles.js";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
import { isBackendUnreachableError } from "../performance/backendReachability.js";
import { readPerformanceSongs } from "../performance/musicRead.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";
import useMediaQuery from "@mui/material/useMediaQuery";

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
    const canMutate = canMutateBandMusic(activeBand.role);
    const canSave = canMutate && !performanceLocked;
    const blockedReason = editBlockedReason({ performanceLocked, canMutate });
    const location = useLocation();
    const navigate = useNavigate();

    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [editedText, setEditedText] = useState("");
    const [isDraft, setIsDraft] = useState(() => location.state?.createSong === true && canSave);
    const [editing, setEditing] = useState(() => location.state?.createSong === true && canSave);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [savedMessage, setSavedMessage] = useState("");
    const [discardTarget, setDiscardTarget] = useState(null);
    const [listOpen, setListOpen] = useState(false);
    const compact = useMediaQuery("(max-width:899.95px)");
    const [appliedCreateKey, setAppliedCreateKey] = useState(null);
    const createRequested = location.state?.createSong === true;
    const createKey = createRequested ? location.key : null;
    if (createKey && createKey !== appliedCreateKey) {
        setAppliedCreateKey(createKey);
        if (canSave) {
            setSelectedSong(null);
            setEditedText("");
            setIsDraft(true);
            setEditing(true);
            setConflict(null);
            setError(null);
            setDiscardTarget(null);
        }
    }
    if (!canSave && (editing || isDraft)) {
        setEditing(false);
        setIsDraft(false);
        setConflict(null);
        setDiscardTarget(null);
        if (isDraft) {
            setSelectedSong(null);
            setEditedText("");
        } else {
            setEditedText(selectedSong?.content || "");
        }
    }

    const dirty = isSongContentDirty({ editing, isDraft, song: selectedSong, editedText });

    useEffect(() => {
        if (!dirty) {
            return undefined;
        }
        const onBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

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

    const startDraft = () => {
        setSelectedSong(null);
        setEditedText("");
        setIsDraft(true);
        setEditing(true);
        setConflict(null);
        setError(null);
        setSavedMessage("");
        setDiscardTarget(null);
        setListOpen(false);
    };

    const applySong = (song) => {
        setSelectedSong(song);
        setEditedText(song.content || "");
        setIsDraft(false);
        setEditing(false);
        setConflict(null);
        setSavedMessage("");
        setDiscardTarget(null);
        setListOpen(false);
    };

    const requestSelect = (song) => {
        if (!isDraft && song.id === selectedSong?.id) {
            return;
        }
        if (dirty) {
            setDiscardTarget({ type: "select", song });
            return;
        }
        applySong(song);
    };

    const requestCreate = () => {
        if (!canSave) {
            return;
        }
        if (dirty) {
            setDiscardTarget({ type: "create" });
            return;
        }
        startDraft();
    };

    const confirmDiscard = () => {
        const target = discardTarget;
        setDiscardTarget(null);
        if (!target) {
            return;
        }
        if (target.type === "create") {
            startDraft();
            return;
        }
        applySong(target.song);
    };

    const handleEdit = () => {
        if (!canSave || !selectedSong) {
            return;
        }
        setEditedText(selectedSong.content || "");
        setEditing(true);
        setConflict(null);
        setSavedMessage("");
    };

    const handleCancel = () => {
        setConflict(null);
        setDiscardTarget(null);
        if (isDraft) {
            setIsDraft(false);
            setEditing(false);
            setSelectedSong(null);
            setEditedText("");
            setError(null);
            return;
        }
        setEditedText(selectedSong?.content || "");
        setEditing(false);
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
                setEditing(false);
                setConflict(null);
                setSavedMessage("Song gespeichert!");
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
            setEditing(false);
            setConflict(null);
            setSavedMessage("Song gespeichert!");
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
    const hasWorkspace = Boolean(selectedSong) || isDraft;
    const showEditor = canSave && editing && (isDraft || Boolean(selectedSong));
    const showList = !compact || !hasWorkspace || listOpen;

    return (
        <Box
            className="song-workspace"
            sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                flex: 1,
                height: "100%",
                minHeight: 0,
            }}
        >
            {showList ? (
                <Box
                    sx={{
                        width: { xs: "100%", md: 300 },
                        flex: { xs: hasWorkspace ? "0 0 auto" : "1 1 auto", md: "0 0 300px" },
                        maxHeight: { xs: hasWorkspace ? "45vh" : "none", md: "none" },
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
                    <SongListPane
                        query={query}
                        onQueryChange={setQuery}
                        onCreate={requestCreate}
                        loading={loading}
                        songs={songs}
                        visibleSongs={visibleSongs}
                        performanceLocked={performanceLocked}
                        selectedId={selectedSong?.id ?? null}
                        onSelect={requestSelect}
                    />
                </Box>
            ) : null}

            <Box
                sx={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    minHeight: 0,
                    overflow: "auto",
                    display: { xs: hasWorkspace ? "block" : "none", md: "block" },
                    p: { xs: 2, md: 3 },
                }}
            >
                {compact && hasWorkspace ? (
                    <Button
                        variant="outlined"
                        onClick={() => setListOpen((open) => !open)}
                        sx={{ mb: 2 }}
                    >
                        {listOpen ? "Songliste schließen" : "Songliste"}
                    </Button>
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
                            <Button color="inherit" size="small" onClick={handleReloadConflict}>
                                Vom Server laden
                            </Button>
                        }
                    >
                        {conflict}
                    </Alert>
                ) : null}

                {showEditor ? (
                    <Box
                        sx={{
                            bgcolor: "background.paper",
                            borderRadius: 2,
                            p: { xs: 2, md: 3 },
                        }}
                    >
                        <SongTextarea
                            selectedSong={selectedSong}
                            editedText={editedText}
                            onChange={setEditedText}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            isDraft={isDraft}
                            saving={saving}
                            canSave={canSave}
                            readOnly={performanceLocked}
                            notifyOnSave={false}
                        />
                    </Box>
                ) : null}

                {!showEditor && selectedSong ? (
                    <Box
                        sx={{
                            bgcolor: "background.paper",
                            borderRadius: 2,
                            p: { xs: 2, md: 3 },
                        }}
                    >
                        <SongSheet
                            title={songTitle(selectedSong)}
                            artist={songArtist(selectedSong)}
                            chordProText={selectedSong.content || ""}
                            canEdit={canSave}
                            editBlockedReason={canSave ? null : blockedReason}
                            onEdit={handleEdit}
                        />
                    </Box>
                ) : null}

                {!showEditor && !selectedSong ? (
                    <Box sx={{ py: 2 }}>
                        <Typography variant="h5" component="h3">
                            Song
                        </Typography>
                        <Typography color="text.secondary">
                            Wähle einen Song aus der Liste.
                        </Typography>
                    </Box>
                ) : null}

                {selectedSong || isDraft ? (
                    <SongNotes
                        token={token}
                        bandId={bandId}
                        songId={selectedSong?.id ?? null}
                        offline={performanceLocked ? { userId: performanceUserId } : null}
                    />
                ) : null}
            </Box>

            <Dialog
                open={Boolean(discardTarget)}
                onClose={() => setDiscardTarget(null)}
                aria-labelledby="discard-song-title"
            >
                <DialogTitle id="discard-song-title">Ungespeicherte Änderungen</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Dieser Song hat ungespeicherte Änderungen. Verwerfen und fortfahren?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDiscardTarget(null)}>Weiter bearbeiten</Button>
                    <Button variant="contained" color="secondary" onClick={confirmDiscard}>
                        Verwerfen
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(savedMessage)}
                autoHideDuration={4000}
                onClose={() => setSavedMessage("")}
                message={savedMessage}
            />
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
