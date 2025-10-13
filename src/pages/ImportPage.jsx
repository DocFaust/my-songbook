import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Entfernt: ImportButton
// Entfernt: ugToChordPro
import { addSongs } from "../db";

// ⬇️ Neu: deinen modularen Converter verwenden
// Passe den Pfad an, falls ImportPage an anderer Stelle liegt:
import convertToChordPro from "../converter/convertToChordPro.js";

export default function ImportPage() {
    const [ugInput, setUgInput] = useState("");
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");

    const importUG = async () => {
        const chordPro = convertToChordPro({
            title: title || "Unbenannt",
            artist: artist || "",
            input: ugInput,
            // optional: capo, key
            // capo: 2,
            // key: "E",
        });

        const song = {
            Id: crypto.randomUUID(),
            type: 1,
            title: title || "Unbenannt",
            artist: artist || "",
            content: chordPro,
        };

        await addSongs([song]);
        setUgInput("");
        setTitle("");
        setArtist("");
        alert("Song importiert!");
    };

    return (
        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Ultimate-Guitar Paste → ChordPro
                </Typography>

                <TextField
                    label="Titel"
                    fullWidth
                    sx={{ mb: 1 }}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <TextField
                    label="Artist"
                    fullWidth
                    sx={{ mb: 1 }}
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                />

                <TextField
                    label="UG-Inhalt einfügen"
                    fullWidth
                    multiline
                    minRows={12}
                    value={ugInput}
                    onChange={(e) => setUgInput(e.target.value)}
                    // Monospace + Whitespaces erhalten
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
                    disabled={!ugInput.trim()}
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
