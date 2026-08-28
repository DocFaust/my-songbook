import Box from "@mui/material/Box";

export default function SongEditorLayout({ children }) {
    return (
        <Box sx={{ display: "flex" }}>
            {children[0]} {/* Sidebar */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    height: "calc(100vh - 64px)",
                    display: "flex",
                }}
            >
                {children.slice(1)}
            </Box>
        </Box>
    );
}
