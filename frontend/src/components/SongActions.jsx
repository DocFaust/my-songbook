import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { Link, useNavigate } from 'react-router-dom';
import { useBand } from '../band/BandContext.jsx';
import { canMutateBandMusic } from '../band/bandRoles.js';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';

export default function SongActions() {
    const navigate = useNavigate();
    const { activeBand } = useBand();
    const performance = usePerformanceMode();
    const [anchor, setAnchor] = useState(null);
    const open = Boolean(anchor);
    const blockedByRole = Boolean(activeBand?.id) && !canMutateBandMusic(activeBand.role);
    const canCreate = !performance.active && !blockedByRole;
    const createHint = performance.active ? 'Im Performance Mode nicht verfügbar.' : null;

    const close = () => setAnchor(null);

    const startCreate = () => {
        close();
        navigate('/editor', { state: { createSong: true } });
    };

    return (
        <>
            <Button
                color="inherit"
                id="song-actions-button"
                aria-haspopup="menu"
                aria-controls={open ? 'song-actions-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-label="+ Song"
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{ flexShrink: 0, px: { xs: 1, sm: 1.5 }, minWidth: 0 }}
            >
                + Song
            </Button>
            <Menu
                id="song-actions-menu"
                anchorEl={anchor}
                open={open}
                onClose={close}
                slotProps={{ paper: { sx: { minWidth: 220 } } }}
            >
                <MenuItem onClick={startCreate} disabled={!canCreate}>
                    Neuer Song
                </MenuItem>
                {createHint ? (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1 }}>
                        {createHint}
                    </Typography>
                ) : null}
                <MenuItem component={Link} to="/import" onClick={close}>
                    Song importieren
                </MenuItem>
            </Menu>
        </>
    );
}
