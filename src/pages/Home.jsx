import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function Home() {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
                Willkommen im SongManager
            </Typography>
            <Typography>Wähle oben einen Menüpunkt.</Typography>
        </Box>
    );
}
