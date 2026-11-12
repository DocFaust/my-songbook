import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { TextareaAutosize } from "@mui/material";
import { songTitle } from "./songDisplay.js";

export default function SongTextarea({
    selectedSong,
    editedText,
    onChange,
    onSave,
    isDraft = false,
    saving = false,
    canSave = true,
    readOnly = false,
    onCancel,
    notifyOnSave = true,
}) {
    const [snackbar, setSnackbar] = useState({ open: false, message: "" });
    const canEdit = Boolean(selectedSong || isDraft);

    const handleSave = async () => {
        if (!canEdit || !onSave) {
            return;
        }

        if (!editedText.trim()) {
            setSnackbar({ open: true, message: "Songtext darf nicht leer sein." });
            return;
        }

        try {
            await onSave();
            if (notifyOnSave) {
                setSnackbar({ open: true, message: "Song gespeichert!" });
            }
        } catch {
            // API-Fehler und Konflikte zeigt die Editor-Seite.
        }
    };

    return (
        <Box
            className="song-editor"
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
            }}
        >
            <Typography variant="h3" component="h3" sx={{ overflowWrap: "anywhere" }}>
                {songTitle(selectedSong, isDraft)}
            </Typography>

            <Box sx={{ flexGrow: 1, overflow: "auto" }}>
                <TextareaAutosize
                    minRows={10}
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        resize: "vertical",
                        fontFamily: 'ui-monospace, Consolas, "Cascadia Code", monospace',
                        fontSize: "1rem",
                        lineHeight: 1.5,
                    }}
                    aria-label="Songtext"
                    value={editedText}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={!canEdit || readOnly}
                />
            </Box>

            <Box
                sx={{
                    mt: 2,
                    bgcolor: "background.paper",
                    py: 1,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                }}
            >
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSave}
                    disabled={!canEdit || !canSave || saving || readOnly}
                    aria-describedby={readOnly ? "performance-readonly-hint" : undefined}
                >
                    Speichern
                </Button>
                {onCancel ? (
                    <Button
                        variant="outlined"
                        onClick={onCancel}
                        disabled={saving}
                    >
                        Abbrechen
                    </Button>
                ) : null}
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={2000}
                onClose={() => setSnackbar({ open: false, message: "" })}
                message={snackbar.message}
            />
        </Box>
    );
}
