import React from 'react';
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import AuthStatus from "../auth/AuthStatus.jsx";
import BandSelector from "../band/BandSelector.jsx";
import { useBand } from "../band/BandContext.jsx";
import { canManageMemberships } from "../band/bandRoles.js";

export default function Header() {
    const { activeBand } = useBand();
    const showBandAdmin = canManageMemberships(activeBand?.role);

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
                <Button color="inherit" component={Link} to="/setlist">
                    Sets
                </Button>
                <Button color="inherit" component={Link} to="/import">
                    Import
                </Button>
                {showBandAdmin ? (
                    <Button color="inherit" component={Link} to="/band">
                        Band
                    </Button>
                ) : null}
                <BandSelector />
                <AuthStatus />
            </Toolbar>
        </AppBar>
    );
}
