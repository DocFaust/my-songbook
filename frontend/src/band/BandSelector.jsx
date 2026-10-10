import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { Link } from 'react-router-dom';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';
import { useBand } from './BandContext.jsx';

export default function BandSelector() {
    const auth = useAuth();
    const { bands, activeBand, loading, createBand, selectBand } = useBand();
    const performance = usePerformanceMode();
    const [anchor, setAnchor] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const open = Boolean(anchor);

    if (!auth.isAuthenticated && !performance.active) {
        return null;
    }

    const bandLabel = loading ? '…' : (activeBand?.name ?? 'Keine Band');

    const closeMenu = () => setAnchor(null);

    const openDialog = () => {
        setName('');
        setError('');
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (!saving) {
            setDialogOpen(false);
        }
    };

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            await createBand(trimmed);
            setDialogOpen(false);
            setName('');
        } catch {
            setError('Band konnte nicht angelegt werden.');
        } finally {
            setSaving(false);
        }
    };

    const chooseBand = (bandId) => {
        selectBand(bandId);
        closeMenu();
    };

    return (
        <>
            <Tooltip title="Songs und Setlists gehören zur aktiven Band.">
                <Button
                    color="inherit"
                    id="active-band-button"
                    aria-haspopup="menu"
                    aria-controls={open ? 'active-band-menu' : undefined}
                    aria-expanded={open ? 'true' : undefined}
                    aria-label={`Aktive Band: ${bandLabel}`}
                    disabled={loading}
                    onClick={(event) => setAnchor(event.currentTarget)}
                    sx={{
                        maxWidth: { xs: 120, sm: 200, md: 280 },
                        minWidth: 0,
                        px: { xs: 1, sm: 1.5 },
                    }}
                >
                    <Typography component="span" noWrap sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                        {bandLabel}
                    </Typography>
                    <Box component="span" aria-hidden sx={{ ml: 0.5, flexShrink: 0 }}>▾</Box>
                </Button>
            </Tooltip>
            <Menu
                id="active-band-menu"
                anchorEl={anchor}
                open={open}
                onClose={closeMenu}
                slotProps={{ paper: { sx: { minWidth: 240 } } }}
            >
                {bands.length > 0 ? <ListSubheader disableSticky>Band wechseln</ListSubheader> : null}
                {bands.map((band) => (
                    <MenuItem
                        key={band.id}
                        selected={band.id === activeBand?.id}
                        onClick={() => chooseBand(band.id)}
                    >
                        <Box component="span" aria-hidden sx={{ width: 20, flexShrink: 0 }}>
                            {band.id === activeBand?.id ? '✓' : ''}
                        </Box>
                        {band.name}
                    </MenuItem>
                ))}
                {bands.length > 0 ? <Divider /> : null}
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        openDialog();
                    }}
                    disabled={performance.active}
                    aria-describedby={performance.active ? 'band-create-performance-hint' : undefined}
                >
                    Band erstellen
                </MenuItem>
                {performance.active ? (
                    <Typography
                        id="band-create-performance-hint"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', px: 2, pb: 1 }}
                    >
                        Im Performance Mode nicht verfügbar.
                    </Typography>
                ) : null}
                {activeBand ? (
                    <MenuItem component={Link} to="/band" onClick={closeMenu}>
                        Band verwalten
                    </MenuItem>
                ) : null}
            </Menu>
            <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
                <DialogTitle>Neue Band</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={Boolean(error)}
                        helperText={error}
                        slotProps={{ htmlInput: { maxLength: 100 } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialog} disabled={saving}>
                        Abbrechen
                    </Button>
                    <Button onClick={submit} disabled={saving || !name.trim()}>
                        Anlegen
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
