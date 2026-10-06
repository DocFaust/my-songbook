import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { apiErrorMessage } from "../api/apiClient.js";
import { getPersonalSongNote, savePersonalSongNote } from "../api/personalSongNotesApi.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";
import { readPerformanceNote, readSnapshotNote } from "../performance/musicRead.js";
import { stageNoteChange } from "../performance/pendingNotes.js";

function writeOptions(note) {
    if (Number.isInteger(note?.version)) {
        return { expectedVersion: note.version };
    }
    if (note && Object.hasOwn(note, "version")) {
        return { expectAbsent: true };
    }
    return {};
}

export default function PersonalSongNotePanel({ token, bandId, songId, offline = null }) {
    const performance = usePerformanceMode();
    const [text, setText] = useState("");
    const [version, setVersion] = useState(null);
    const [versionKnown, setVersionKnown] = useState(false);
    const [pendingLocal, setPendingLocal] = useState(false);
    const [loading, setLoading] = useState(Boolean(songId));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saved, setSaved] = useState(false);
    const tokenRef = useRef(token);
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    useEffect(() => {
        if (!songId) {
            return undefined;
        }
        let cancelled = false;
        const apply = (note, failed, message) => {
            if (cancelled) {
                return;
            }
            setText(note?.text ?? "");
            setVersion(Number.isInteger(note?.version) ? note.version : null);
            setVersionKnown(Boolean(note && Object.hasOwn(note, "version")));
            setPendingLocal(Boolean(note?.pending));
            setLoadFailed(failed);
            setError(message);
            setLoading(false);
        };
        if (offline?.userId) {
            readPerformanceNote(offline.userId, bandId, songId)
                .then((note) => apply(note, false, null))
                .catch(() => apply({ text: "" }, true, "Die lokale Notiz konnte nicht gelesen werden."));
            return () => {
                cancelled = true;
            };
        }
        const activeToken = tokenRef.current;
        getPersonalSongNote({ token: activeToken, bandId, songId })
            .then((note) => apply(note, false, null))
            .catch((err) => apply({ text: "" }, true, apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [bandId, songId, offline?.userId, performance.revision]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            if (offline?.userId) {
                const snapshotNote = await readSnapshotNote(offline.userId, bandId, songId);
                const stored = await stageNoteChange({
                    userId: offline.userId,
                    bandId,
                    songId,
                    text,
                    snapshotNote,
                });
                setPendingLocal(Boolean(stored));
                setSaved(true);
                await performance.refreshPending(offline.userId);
                return;
            }
            const stored = await savePersonalSongNote({
                token,
                bandId,
                songId,
                text,
                ...writeOptions(versionKnown ? { version } : { text }),
            });
            setText(stored?.text ?? "");
            setVersion(Number.isInteger(stored?.version) ? stored.version : null);
            setVersionKnown(Boolean(stored && Object.hasOwn(stored, "version")));
            setSaved(true);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #ddd" }}>
            <Typography variant="subtitle1" component="h4">
                Meine Notiz
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
                Nur für dich sichtbar. Der Songtext bleibt davon unberührt.
            </Typography>
            {songId ? null : (
                <Typography variant="body2">
                    Eine persönliche Notiz kannst du speichern, sobald der Song gespeichert ist.
                </Typography>
            )}
            {error ? (
                <Alert severity="error" sx={{ mb: 1 }}>
                    {error}
                </Alert>
            ) : null}
            {songId && !loadFailed ? (
                <>
                    <TextField
                        label="Meine Notiz"
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setSaved(false);
                        }}
                        disabled={loading || saving}
                        multiline
                        minRows={3}
                        fullWidth
                    />
                    {pendingLocal ? (
                        <Typography variant="body2" sx={{ mt: 1 }} role="status">
                            Lokal geändert
                        </Typography>
                    ) : null}
                    <Button
                        sx={{ mt: 1 }}
                        variant="outlined"
                        onClick={handleSave}
                        disabled={loading || saving}
                    >
                        Notiz speichern
                    </Button>
                    {saved ? (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {offline ? "Notiz lokal gespeichert." : "Notiz gespeichert."}
                        </Typography>
                    ) : null}
                </>
            ) : null}
        </Box>
    );
}
