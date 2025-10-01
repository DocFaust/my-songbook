import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ImportButton from "../components/ImportButton.jsx";
import { ugToChordPro } from "../utils/ugToChordPro.js";
import { addSongs } from "../db";

export default function ImportPage() {
    const [ugInput, setUgInput] = useState("");
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");

    const importUG = async () => {
        const chordPro = ugToChordPro(ugInput);
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
        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Datei-Import</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                    Lade ein Exportformat (z.B. dein bestehendes JSON/TXT) hoch.
                </Typography>
                <ImportButton onImportDone={() => alert("Import abgeschlossen")} />
            </Box>

            <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Ultimate-Guitar Paste → ChordPro</Typography>
                <TextField label="Titel" fullWidth sx={{ mb: 1 }} value={title} onChange={(e)=>setTitle(e.target.value)} />
                <TextField label="Artist" fullWidth sx={{ mb: 1 }} value={artist} onChange={(e)=>setArtist(e.target.value)} />
                <TextField
                    label="UG-Inhalt einfügen"
                    fullWidth
                    multiline
                    minRows={10}
                    value={ugInput}
                    onChange={(e) => setUgInput(e.target.value)}
                />
                <Button variant="contained" sx={{ mt: 1 }} onClick={importUG} disabled={!ugInput.trim()}>
                    Konvertieren & Speichern
                </Button>
                <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.75 }}>
                    Hinweis: Bitte beachte die Nutzungsbedingungen von Ultimate Guitar. Kopiere nur Inhalte, die du rechtlich verwenden darfst.
                </Typography>
            </Box>
        </Box>
    );
}
