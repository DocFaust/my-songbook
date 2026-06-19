import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { addSongs } from "../db";
import { TextareaAutosize } from "@mui/material";

function songTitle(song) {
    return song.title || song.name || "Unbenannt";
}

export default function SongTextarea({ selectedSong, editedText, onChange }) {
    const [snackbar, setSnackbar] = useState({ open: false, message: "" });

    const handleSave = async () => {
        if (!selectedSong) return;

        if (!editedText.trim()) {
            setSnackbar({ open: true, message: "Songtext darf nicht leer sein." });
            return;
        }

        await addSongs([{ ...selectedSong, content: editedText }]);
        setSnackbar({ open: true, message: "Song gespeichert!" });
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                p: 2,
                minHeight: 0, // WICHTIG für Flex-Shrink!
            }}
        >
            <h3>{selectedSong ? songTitle(selectedSong) : "Kein Song ausgewählt"}</h3>

            <Box sx={{ flexGrow: 1, overflow: "auto" }}>
                <TextareaAutosize
                    minRows={10}
                    style={{
                        width: "100%",
                        height: "100%",
                        resize: "none",
                    }}
                    value={editedText}
                    onChange={(e) => onChange(e.target.value)}
                />
            </Box>

            <Box
                sx={{
                    mt: 2,
                    position: "sticky",
                    bottom: 0,
                    bgcolor: "background.paper",
                    py: 1,
                }}
            >
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!selectedSong}
                >
                    Speichern
                </Button>
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
