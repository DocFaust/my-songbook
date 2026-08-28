import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { useBand } from './BandContext.jsx';

export default function BandSelector() {
    const auth = useAuth();
    const { bands, activeBand, loading, createBand, selectBand } = useBand();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    if (!auth.isAuthenticated) {
        return null;
    }

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

    return (
        <>
            <Tooltip title="Songs und Setlists gehören zur aktiven Band.">
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    {loading ? (
                        <Typography variant="caption" sx={{ mr: 1 }}>
                            …
                        </Typography>
                    ) : bands.length === 0 ? (
                        <Typography variant="caption" sx={{ mr: 1, opacity: 0.85 }}>
                            Keine Band
                        </Typography>
                    ) : (
                        <Select
                            variant="standard"
                            disableUnderline
                            value={activeBand?.id ?? ''}
                            onChange={(event) => selectBand(event.target.value)}
                            displayEmpty
                            inputProps={{ 'aria-label': 'Aktive Band' }}
                            sx={{
                                color: 'inherit',
                                minWidth: 140,
                                mr: 1,
                                '& .MuiSelect-icon': { color: 'inherit' },
                            }}
                        >
                            {bands.map((band) => (
                                <MenuItem key={band.id} value={band.id}>
                                    {band.name}
                                </MenuItem>
                            ))}
                        </Select>
                    )}
                    <Button color="inherit" onClick={openDialog}>
                        Band anlegen
                    </Button>
                </Box>
            </Tooltip>
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
