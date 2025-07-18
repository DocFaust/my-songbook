import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import React from "react";
import './styles.css';
export default function SongSidebar({ songs, onSelect }) {
    return (
        <List>
            {songs.map((s) => (
                <ListItemButton
                    key={s.Id}
                    onClick={() => onSelect(s)}
                    sx={{
                        "&:hover": { bgcolor: "action.hover" },
                        alignItems: "flex-start",
                        flexDirection: "column",
                        py: 0,
                        px: 2,
                    }}
                >
                    <ListItemText
                        primary={s.name}
                        secondary={s.author || ""}
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
