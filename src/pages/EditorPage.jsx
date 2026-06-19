import React, { useState, useEffect } from "react";
import { getAllSongs } from "../db";
import SongSidebar from "../components/SongSideBar";
import SongTextarea from "../components/SongTextArea.jsx";
import SongViewer from "../components/SongViewer.jsx";
import Box from "@mui/material/Box";

export default function EditorPage() {
    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);
    const [editedText, setEditedText] = useState("");

    useEffect(() => {
        getAllSongs().then(setSongs);
    }, []);

    const handleSelectSong = (song) => {
        setSelectedSong(song);
        setEditedText(song.content || "");
    };
    const handleNewSong = () => {
        const song = {
            Id: crypto.randomUUID(),
            type: 1,
            title: "Neuer Song",
            artist: "",
            content: "",
        };
        setSongs((prevSongs) => [...prevSongs, song]);
        setSelectedSong(song);
        setEditedText(song.content);
    };

    return (
        <Box
            sx={{
                display: "flex",
                height: "calc(100vh - 64px)",
            }}
        >
            {/* Songliste - links */}
            <Box
                sx={{
                    width: 300,
                    borderRight: "1px solid #ddd",
                    overflowY: "auto",
                }}
            >
                <SongSidebar songs={songs} onSelect={handleSelectSong} onNew={handleNewSong}/>
            </Box>

            {/* Hauptbereich - rechts */}
            <Box
                sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                {/* Textarea */}
                <Box sx={{ flex: 1, p: 3 }}>
                    <SongTextarea
                        selectedSong={selectedSong}
                        editedText={editedText}
                        onChange={setEditedText}
                    />
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        p: 3,
                        borderLeft: "1px solid #ddd",
                        overflowY: "auto",
                    }}
                >
                    <SongViewer chordProText={editedText} />
                </Box>
            </Box>
        </Box>
    );
}
