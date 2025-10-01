import React, { useEffect, useMemo, useState } from "react";
import { getAllSongs, getSetlists, saveSetlist, deleteSetlist } from "../db";
import { v4 as uuid } from "uuid";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Typography from "@mui/material/Typography";
import SongViewer from "../components/SongViewer.jsx";

export default function SetlistPage() {
    const [songs, setSongs] = useState([]);
    const [setlists, setSetlists] = useState([]);
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        getAllSongs().then(setSongs);
        getSetlists().then(setSetlists);
    }, []);

    const addToSetlist = (songId) => {
        if (!selectedIds.includes(songId)) setSelectedIds([...selectedIds, songId]);
    };

    const removeFromSetlist = (songId) => {
        setSelectedIds(selectedIds.filter((id) => id !== songId));
    };

    const save = async () => {
        if (!name.trim()) return;
        const sl = { id: uuid(), name: name.trim(), songIds: selectedIds };
        await saveSetlist(sl);
        setSetlists([...setlists, sl]);
        setName("");
        setSelectedIds([]);
    };

    const selectedSongs = useMemo(
        () => selectedIds.map((id) => songs.find((s) => s.Id === id)).filter(Boolean),
        [selectedIds, songs]
    );

    return (
        <Box sx={{ display: "flex", gap: 2, p: 2 }}>
            <Box sx={{ width: 360 }}>
                <Typography variant="h6">Neue Setlist</Typography>
                <TextField
                    label="Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ my: 1 }}
                />
                <TextField select label="Song hinzufügen" fullWidth defaultValue="">
                    <MenuItem value="" disabled>Song wählen…</MenuItem>
                    {songs.map((s) => (
                        <MenuItem key={s.Id} value={s.Id} onClick={() => addToSetlist(s.Id)}>
                            {s.title || s.Id}
                        </MenuItem>
                    ))}
                </TextField>
                <List dense sx={{ border: "1px solid #ddd", my: 1, maxHeight: 280, overflowY: "auto" }}>
                    {selectedSongs.map((s) => (
                        <ListItem
                            key={s.Id}
                            secondaryAction={
                                <Button size="small" onClick={() => removeFromSetlist(s.Id)}>Entfernen</Button>
                            }
                        >
                            {s.title || s.Id}
                        </ListItem>
                    ))}
                </List>
                <Button variant="contained" onClick={save}>Setlist speichern</Button>

                <Typography variant="h6" sx={{ mt: 3 }}>Gespeicherte Setlists</Typography>
                <List dense sx={{ border: "1px solid #ddd", my: 1, maxHeight: 240, overflowY: "auto" }}>
                    {setlists.map((sl) => (
                        <ListItem
                            key={sl.id}
                            secondaryAction={
                                <Button size="small" color="error" onClick={() => deleteSetlist(sl.id).then(() => setSetlists(setlists.filter(x=>x.id!==sl.id)))}>
                                    Löschen
                                </Button>
                            }
                        >
                            {sl.name} ({sl.songIds.length})
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Auftritts-Ansicht (Preview)</Typography>
                {selectedSongs.length === 0 ? (
                    <Typography variant="body2">Wähle Songs für die Vorschau.</Typography>
                ) : (
                    selectedSongs.map((s) => (
                        <Box key={s.Id} sx={{ mb: 4, p: 2, border: "1px solid #eee", borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                {s.title || s.Id}
                            </Typography>
                            <SongViewer chordProText={s.content} />
                        </Box>
                    ))
                )}
            </Box>
        </Box>
    );
}
