import Box from "@mui/material/Box";

export default function PageContent({ children, sx, ...props }) {
    return (
        <Box
            component="main"
            sx={{
                pt: { xs: 7, sm: 8 },
                bgcolor: 'background.default',
                minHeight: '100vh',
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
}
