import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useBand } from '../band/BandContext.jsx';
import { formatSnapshotStand } from './formatSnapshotStand.js';
import { readPerformanceMusic } from './musicRead.js';
import { usePerformanceMode } from './PerformanceModeContext.jsx';

function statusLabel(performance) {
    if (performance.enabling) {
        return 'Performance Mode wird vorbereitet…';
    }
    if (performance.active) {
        return 'Performance Mode';
    }
    return 'Online';
}

export default function PerformanceStatus() {
    const { activeBand } = useBand();
    const performance = usePerformanceMode();
    const [anchor, setAnchor] = useState(null);
    const [stand, setStand] = useState(null);
    const open = Boolean(anchor);
    const label = statusLabel(performance);

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

    const close = () => setAnchor(null);

    const activate = () => {
        close();
        performance.enable();
    };

    const leave = () => {
        close();
        performance.disable();
    };

    return (
        <>
            <Button
                color="inherit"
                id="app-status-button"
                aria-haspopup="menu"
                aria-controls={open ? 'app-status-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-label={label}
                disabled={performance.enabling || !performance.ready}
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{
                    flexShrink: 0,
                    px: { xs: 1, sm: 1.5 },
                    maxWidth: { xs: 168, sm: 'none' },
                }}
            >
                <Box
                    component="span"
                    aria-hidden
                    sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        mr: 1,
                        flexShrink: 0,
                        bgcolor: performance.active ? 'secondary.light' : 'success.light',
                    }}
                />
                <Typography component="span" role="status" noWrap sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                    {label}
                </Typography>
            </Button>
            <Menu
                id="app-status-menu"
                anchorEl={anchor}
                open={open}
                onClose={close}
                slotProps={{ paper: { sx: { minWidth: 260 } } }}
            >
                {performance.active ? (
                    <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="subtitle1" component="p">Performance Mode</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {`Stand ${stand ?? '…'}`}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="subtitle1" component="p">Online</Typography>
                    </Box>
                )}
                {performance.active ? (
                    <MenuItem onClick={leave}>Performance Mode beenden</MenuItem>
                ) : (
                    <MenuItem onClick={activate}>Performance Mode aktivieren</MenuItem>
                )}
            </Menu>
        </>
    );
}
