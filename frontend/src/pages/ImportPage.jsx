import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useAuth } from "react-oidc-context";
import convertToChordPro from "../converter/convertToChordPro.js";
import { createSong } from "../api/songsApi.js";
import { apiErrorMessage } from "../api/apiClient.js";
import { useBand } from "../band/BandContext.jsx";
import { canMutateBandMusic } from "../band/bandRoles.js";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
import { isBackendUnreachableError } from "../performance/backendReachability.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";

function ImportWorkspace() {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const { activeBand } = useBand();
    const [ugInput, setUgInput] = useState("");
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [saving, setSaving] = useState(false);
    const performanceLocked = performance.active;
    const canImport = canMutateBandMusic(activeBand?.role) && !performanceLocked;

    const importUG = async () => {
        if (!canImport) {
            return;
        }

        setFeedback(null);
        setSaving(true);
        try {
            const chordPro = convertToChordPro({
                title: title || "Unbenannt",
                artist: artist || "",
                input: ugInput,
            });

            await createSong({
                token: auth.user?.access_token,
                bandId: activeBand.id,
                title: title || "Unbenannt",
                artist: artist || "",
                content: chordPro,
            });

            setUgInput("");
            setTitle("");
            setArtist("");
            setFeedback({ severity: "success", message: "Song importiert!" });
        } catch (error) {
            if (isBackendUnreachableError(error)) {
                performance.reportUnreachable();
            }
            setFeedback({ severity: "error", message: apiErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Ultimate-Guitar Paste → ChordPro
                </Typography>

                {feedback ? (
                    <Alert severity={feedback.severity} sx={{ mb: 1 }}>
                        {feedback.message}
                    </Alert>
                ) : null}

                {performanceLocked ? (
                    <Alert severity="info" id="performance-readonly-hint" sx={{ mb: 1 }}>
                        Im Performance Mode nicht verfügbar.
                    </Alert>
                ) : null}

                {!canImport && !performanceLocked ? (
                    <Alert severity="info" sx={{ mb: 1 }}>
                        Mit deiner Rolle kannst du keine Songs anlegen.
                    </Alert>
                ) : null}

                <TextField
                    label="Titel"
                    fullWidth
                    sx={{ mb: 1 }}
                    disabled={performanceLocked}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <TextField
                    label="Artist"
                    fullWidth
                    sx={{ mb: 1 }}
                    disabled={performanceLocked}
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                />

                <TextField
                    label="UG-Inhalt einfügen"
                    fullWidth
                    multiline
                    minRows={12}
                    disabled={performanceLocked}
                    value={ugInput}
                    onChange={(e) => setUgInput(e.target.value)}
                    sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre",
                        fontSize: "0.95rem",
                    }}
                />

                <Button
                    variant="contained"
                    sx={{ mt: 1 }}
                    onClick={importUG}
                    disabled={!ugInput.trim() || !canImport || saving}
                    aria-describedby={performanceLocked ? "performance-readonly-hint" : undefined}
                >
                    Konvertieren &amp; Speichern
                </Button>

                <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 1, opacity: 0.75 }}
                >
                    Hinweis: Bitte beachte die Nutzungsbedingungen von Ultimate Guitar.
                    Kopiere nur Inhalte, die du rechtlich verwenden darfst.
                </Typography>
            </Box>
        </Box>
    );
}

export default function ImportPage() {
    return (
        <MusicWorkflowGate>
            <ImportWorkspace />
        </MusicWorkflowGate>
    );
}
