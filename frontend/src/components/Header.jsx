import React, { useEffect, useState } from 'react';
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import { Link } from "react-router-dom";
import AuthStatus from "../auth/AuthStatus.jsx";
import BandSelector from "../band/BandSelector.jsx";
import { useBand } from "../band/BandContext.jsx";
import { formatSnapshotStand } from "../performance/formatSnapshotStand.js";
import { readPerformanceMusic } from "../performance/musicRead.js";
import { usePerformanceMode } from "../performance/PerformanceModeContext.jsx";

export default function Header() {
    const { activeBand } = useBand();
    const performance = usePerformanceMode();
    const showMusicNav = Boolean(activeBand);
    const [stand, setStand] = useState(null);

    useEffect(() => {
        if (!performance.active || !performance.userId || !activeBand?.id) {
            return undefined;
        }
        let cancelled = false;
        readPerformanceMusic(performance.userId, activeBand.id).then((music) => {
            if (!cancelled) {
                setStand(formatSnapshotStand(music.refreshedAt));
            }
        }).catch(() => {
            if (!cancelled) {
                setStand(null);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [performance.active, performance.userId, performance.revision, activeBand?.id]);

    const toggleMode = (event) => {
        if (event.target.checked) {
            performance.enable();
            return;
        }
        performance.disable();
    };

    const statusText = performance.active
        ? `Performance Mode · Stand ${stand ?? '…'}`
        : 'Online';

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
                {showMusicNav ? (
                    <>
                        <Button color="inherit" component={Link} to="/editor">
                            Editor
                        </Button>
                        <Button color="inherit" component={Link} to="/setlist">
                            Sets
                        </Button>
                        <Button color="inherit" component={Link} to="/import">
                            Import
                        </Button>
                        <Button color="inherit" component={Link} to="/band">
                            Band
                        </Button>
                    </>
                ) : null}
                <Switch
                    checked={performance.active}
                    onChange={toggleMode}
                    disabled={performance.enabling || !performance.ready}
                    color="default"
                    slotProps={{
                        input: {
                            'aria-label': performance.active
                                ? 'Performance Mode ausschalten'
                                : 'Performance Mode einschalten',
                        },
                    }}
                />
                <Typography variant="caption" component="p" role="status" sx={{ mr: 1, maxWidth: 220 }}>
                    {performance.enabling ? 'Performance Mode wird vorbereitet…' : statusText}
                </Typography>
                <BandSelector />
                <AuthStatus />
            </Toolbar>
        </AppBar>
    );
}
