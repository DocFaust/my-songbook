import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import React from "react";
import './styles.css';
import Button from "@mui/material/Button";

export default function SongSidebar({ songs, onSelect, onNew, canCreate = true, createHint = null }) {
    return (
        <>
        <Button
            onClick={() => onNew()}
            disabled={!canCreate}
            aria-describedby={createHint ? "song-create-hint" : undefined}
        >
            New
        </Button>
        {createHint ? (
            <Typography variant="body2" id="song-create-hint" sx={{ px: 2, py: 1 }}>
                {createHint}
            </Typography>
        ) : null}
        <List>
            {songs.map((s) => (
                <ListItemButton
                    key={s.id}
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
                        primary={s.title}
                        secondary={s.artist || s.author || ""}
                        slotProps={{
                            primary: { fontSize: 16, fontWeight: "bold" },
                            secondary: { fontSize: 12, color: "text.secondary" }
                        }}
                    />

                </ListItemButton>
            ))}
        </List>
        </>
    );
}
