import { alpha } from "@mui/material/styles";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import React from "react";
import './styles.css';

export default function SongSidebar({ songs, onSelect, selectedId = null }) {
    return (
        <List aria-label="Songs" sx={{ py: 0 }}>
            {songs.map((song) => (
                <ListItemButton
                    key={song.id}
                    selected={song.id === selectedId}
                    aria-selected={song.id === selectedId}
                    onClick={() => onSelect(song)}
                    sx={{
                        minHeight: 48,
                        alignItems: "flex-start",
                        flexDirection: "column",
                        py: 1,
                        px: 2,
                        "&.Mui-selected": {
                            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.14),
                            boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.secondary.main}`,
                        },
                        "&.Mui-selected:hover": {
                            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.22),
                        },
                    }}
                >
                    <ListItemText
                        primary={song.title}
                        secondary={song.artist || song.author || ""}
                        slotProps={{
                            primary: { fontSize: 16, fontWeight: "bold" },
                            secondary: { fontSize: 12, color: "text.secondary" }
                        }}
                    />
                </ListItemButton>
            ))}
        </List>
    );
}
