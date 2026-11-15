import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useAuth } from "react-oidc-context";
import convertToChordPro from "../converter/convertToChordPro.js";
import { createSong } from "../api/songsApi.js";
import { apiErrorMessage } from "../api/apiClient.js";
import { useBand } from "../band/BandContext.jsx";
import { canMutateBandMusic } from "../band/bandRoles.js";
import MusicWorkflowGate from "../components/MusicWorkflowGate.jsx";
import { isBackendUnreachableError } from "../performance/backendReachability.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";
import {
    CHORDPRO_FILE_ACCEPT,
    ChordProFileError,
    readChordProFile,
} from "../import/chordProFile.js";

function ImportWorkspace() {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const { activeBand } = useBand();
    const [importType, setImportType] = useState("ultimate-guitar");
    const [ugInput, setUgInput] = useState("");
    const [ugTitle, setUgTitle] = useState("");
    const [ugArtist, setUgArtist] = useState("");
    const [fileName, setFileName] = useState("");
    const [chordPro, setChordPro] = useState("");
    const [chordTitle, setChordTitle] = useState("");
    const [chordArtist, setChordArtist] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);
    const performanceLocked = performance.active;
    const canImport = canMutateBandMusic(activeBand?.role) && !performanceLocked;
    const chordTitleMissing = chordPro.trim() !== "" && chordTitle.trim() === "";

    const showSaveError = (error) => {
        if (isBackendUnreachableError(error)) {
            performance.reportUnreachable();
        }
        setFeedback({ severity: "error", message: apiErrorMessage(error) });
    };

    const importUG = async () => {
        if (!canImport) {
            return;
        }

        setFeedback(null);
        setSaving(true);
        try {
            const chordProText = convertToChordPro({
                title: ugTitle || "Unbenannt",
                artist: ugArtist || "",
                input: ugInput,
            });

            await createSong({
                token: auth.user?.access_token,
                bandId: activeBand.id,
                title: ugTitle || "Unbenannt",
                artist: ugArtist || "",
                content: chordProText,
            });

            setUgInput("");
            setUgTitle("");
            setUgArtist("");
            setFeedback({ severity: "success", message: "Song importiert!" });
        } catch (error) {
            showSaveError(error);
        } finally {
            setSaving(false);
        }
    };

    const chooseChordProFile = async (event) => {
        const input = event.target;
        const file = input.files?.[0];
        input.value = "";
        if (!file || !canImport) {
            return;
        }

        setFeedback(null);
        try {
            const loaded = await readChordProFile(file);
            setFileName(file.name);
            setChordPro(loaded.content);
            setChordTitle(loaded.title);
            setChordArtist(loaded.artist);
        } catch (error) {
            const message = error instanceof ChordProFileError
                ? error.message
                : "Die Datei konnte nicht gelesen werden.";
            setFeedback({ severity: "error", message });
        }
    };

    const cancelChordPro = () => {
        if (saving) {
            return;
        }
        setFileName("");
        setChordPro("");
        setChordTitle("");
        setChordArtist("");
        setFeedback(null);
    };

    const saveChordPro = async () => {
        if (!canImport || saving) {
            return;
        }

        const title = chordTitle.trim();
        if (!chordPro.trim() || !title) {
            setFeedback({
                severity: "error",
                message: title ? "Die Datei ist leer." : "Titel darf nicht leer sein.",
            });
            return;
        }

        setFeedback(null);
        setSaving(true);
        try {
            await createSong({
                token: auth.user?.access_token,
                bandId: activeBand.id,
                title,
                artist: chordArtist.trim(),
                content: chordPro,
            });
            setFileName("");
            setChordPro("");
            setChordTitle("");
            setChordArtist("");
            setFeedback({ severity: "success", message: "Song importiert!" });
        } catch (error) {
            showSaveError(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: 2, display: "grid", gap: 2 }}>
            <Typography variant="h6">Song importieren</Typography>

            <ToggleButtonGroup
                exclusive
                value={importType}
                aria-label="Importart"
                disabled={saving}
                onChange={(_, next) => {
                    if (next) {
                        setImportType(next);
                        setFeedback(null);
                    }
                }}
            >
                <ToggleButton value="chordpro">ChordPro-Datei</ToggleButton>
                <ToggleButton value="ultimate-guitar">Ultimate Guitar</ToggleButton>
            </ToggleButtonGroup>

            {feedback ? (
                <Alert severity={feedback.severity}>{feedback.message}</Alert>
            ) : null}

            {performanceLocked ? (
                <Alert severity="info" id="performance-readonly-hint">
                    Im Performance Mode nicht verfügbar.
                </Alert>
            ) : null}

            {!canImport && !performanceLocked ? (
                <Alert severity="info">
                    Mit deiner Rolle kannst du keine Songs anlegen.
                </Alert>
            ) : null}

            {importType === "chordpro" ? (
                <Box>
                    <Button
                        variant="outlined"
                        disabled={!canImport || saving}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        ChordPro-Datei wählen
                    </Button>
                    <input
                        ref={fileInputRef}
                        id="chordpro-file"
                        type="file"
                        accept={CHORDPRO_FILE_ACCEPT}
                        aria-label="ChordPro-Datei auswählen"
                        tabIndex={-1}
                        disabled={!canImport || saving}
                        onChange={chooseChordProFile}
                        style={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            overflow: "hidden",
                            clip: "rect(0 0 0 0)",
                        }}
                    />
                    <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.75 }}>
                        .cho, .chopro, .chordpro, .pro oder .txt. Die Datei wird auf diesem Gerät gelesen.
                    </Typography>

                    {chordPro ? (
                        <Box sx={{ mt: 2 }}>
                            {fileName ? (
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    {`Gewählte Datei: ${fileName}`}
                                </Typography>
                            ) : null}
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Der Dateiinhalt wird unverändert gespeichert. Titel und Interpret kannst du vorher anpassen.
                            </Typography>
                            {chordTitleMissing ? (
                                <Alert severity="error" sx={{ mb: 1 }}>
                                    Titel darf nicht leer sein.
                                </Alert>
                            ) : null}
                            <TextField
                                label="Titel"
                                fullWidth
                                sx={{ mb: 1 }}
                                disabled={!canImport}
                                value={chordTitle}
                                onChange={(event) => setChordTitle(event.target.value)}
                            />
                            <TextField
                                label="Interpret"
                                fullWidth
                                sx={{ mb: 1 }}
                                disabled={!canImport}
                                value={chordArtist}
                                onChange={(event) => setChordArtist(event.target.value)}
                            />
                            <TextField
                                label="ChordPro"
                                fullWidth
                                multiline
                                minRows={6}
                                maxRows={10}
                                disabled={!canImport}
                                value={chordPro}
                                slotProps={{ input: { readOnly: true } }}
                                sx={{
                                    fontFamily: "monospace",
                                    whiteSpace: "pre",
                                    fontSize: "0.95rem",
                                }}
                            />
                            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                                <Button
                                    variant="contained"
                                    onClick={saveChordPro}
                                    disabled={!canImport || saving || chordTitleMissing}
                                    aria-describedby={performanceLocked ? "performance-readonly-hint" : undefined}
                                >
                                    Song anlegen
                                </Button>
                                <Button variant="outlined" onClick={cancelChordPro} disabled={saving}>
                                    Abbrechen
                                </Button>
                            </Box>
                        </Box>
                    ) : null}
                </Box>
            ) : (
                <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Ultimate-Guitar Paste → ChordPro
                    </Typography>

                    <TextField
                        label="Titel"
                        fullWidth
                        sx={{ mb: 1 }}
                        disabled={performanceLocked}
                        value={ugTitle}
                        onChange={(event) => setUgTitle(event.target.value)}
                    />

                    <TextField
                        label="Artist"
                        fullWidth
                        sx={{ mb: 1 }}
                        disabled={performanceLocked}
                        value={ugArtist}
                        onChange={(event) => setUgArtist(event.target.value)}
                    />

                    <TextField
                        label="UG-Inhalt einfügen"
                        fullWidth
                        multiline
                        minRows={12}
                        disabled={performanceLocked}
                        value={ugInput}
                        onChange={(event) => setUgInput(event.target.value)}
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
            )}
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
