import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { apiErrorMessage } from "../api/apiClient.js";
import { getPersonalSongNote, savePersonalSongNote } from "../api/personalSongNotesApi.js";

export default function PersonalSongNotePanel({ token, bandId, songId }) {
    const [text, setText] = useState("");
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
        const activeToken = tokenRef.current;
        getPersonalSongNote({ token: activeToken, bandId, songId })
            .then((note) => {
                if (cancelled) {
                    return;
                }
                setText(note?.text ?? "");
                setLoadFailed(false);
                setError(null);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setText("");
                setLoadFailed(true);
                setError(apiErrorMessage(err));
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [bandId, songId]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const stored = await savePersonalSongNote({ token, bandId, songId, text });
            setText(stored?.text ?? "");
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
                            Notiz gespeichert.
                        </Typography>
                    ) : null}
                </>
            ) : null}
        </Box>
    );
}
