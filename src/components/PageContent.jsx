import Box from "@mui/material/Box";

export default function PageContent({ children, sx, ...props }) {
    return (
        <Box
            component="main"
            sx={{
                pt: 8,
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
}
