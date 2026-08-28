import Box from "@mui/material/Box";
import ChordProViewer from "./ChordProViewer/index.jsx";

export default function SongViewer({ chordProText }) {
    return (
        <Box sx={{ flex: 1, p: 2 }}>
            <h3>Vorschau</h3>
            <ChordProViewer chordProText={chordProText} />
        </Box>
    );
}
