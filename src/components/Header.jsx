import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";

export default function Header() {
    return (
        <AppBar
            position="fixed"
            sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    SongManager
                </Typography>
                <Button color="inherit" component={Link} to="/">
                    Home
                </Button>
                <Button color="inherit" component={Link} to="/editor">
                    Editor
                </Button>
            </Toolbar>
        </AppBar>
    );
}
