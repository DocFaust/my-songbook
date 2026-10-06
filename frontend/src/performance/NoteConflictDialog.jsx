import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { deletePersonalSongNote, getPersonalSongNote, savePersonalSongNote } from '../api/personalSongNotesApi.js';
import { readSnapshotSongTitle } from './musicRead.js';
import { usePerformanceMode } from './PerformanceModeContext.jsx';
import { discardPendingNote, resolvePendingNote } from './syncPendingNotes.js';

function conflictCopy(change) {
    if (change.action === 'DELETE') {
        return {
            title: 'Die Notiz wurde online geändert, nachdem du sie offline gelöscht hast.',
            localLabel: 'Meine Offline-Löschung',
            localText: '',
            keepLocal: 'Trotzdem löschen',
            keepServer: 'Online-Notiz behalten',
        };
    }
    if (change.conflict?.code === 'deleted') {
        return {
            title: 'Die Notiz wurde zwischenzeitlich online gelöscht.',
            localLabel: 'Meine Offline-Notiz',
            localText: change.text ?? '',
            keepLocal: 'Meine Offline-Notiz wiederherstellen',
            keepServer: 'Gelöscht lassen',
        };
    }
    return {
        title: 'Notiz wurde an anderer Stelle geändert.',
        localLabel: 'Meine Offline-Notiz',
        localText: change.text ?? '',
        keepLocal: 'Meine Version verwenden',
        keepServer: 'Server-Version verwenden',
    };
}

function blockedCopy(change) {
    if (change.blocked === 'membership') {
        return 'Die Notiz kann nicht synchronisiert werden, weil du nicht mehr Mitglied dieser Band bist.';
    }
    return 'Die Notiz kann nicht synchronisiert werden, weil der Song nicht mehr existiert.';
}

function NoteComparison({ label, text }) {
    return (
        <TextField
            label={label}
            value={text}
            multiline
            minRows={4}
            fullWidth
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{ input: { readOnly: true } }}
        />
    );
}

export default function NoteConflictDialog({ open, onClose }) {
    const auth = useAuth();
    const { userId, conflicts, blocked, refreshPending } = usePerformanceMode();
    const items = [...conflicts, ...blocked];
    const [index, setIndex] = useState(0);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState(null);
    const [pendingAction, setPendingAction] = useState(false);
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (!open) {
            setIndex(0);
            setMessage(null);
        }
    }
    const change = items[index] ?? items[0] ?? null;

    useEffect(() => {
        if (!change || !userId) {
            return undefined;
        }
        let cancelled = false;
        readSnapshotSongTitle(userId, change.bandId, change.songId).then((songTitle) => {
            if (!cancelled) {
                setTitle(songTitle || 'Song');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [change, userId]);

    if (!change) {
        return null;
    }

    const finish = async () => {
        const pending = await refreshPending(userId);
        const remaining = pending.filter((entry) => entry.conflict || entry.blocked);
        setMessage(null);
        setIndex(0);
        if (remaining.length === 0) {
            onClose();
        }
    };

    const choose = async (choice) => {
        setPendingAction(true);
        setMessage(null);
        try {
            const result = await resolvePendingNote({
                change,
                choice,
                token: auth.user?.access_token,
                clients: {
                    getNote: getPersonalSongNote,
                    saveNote: savePersonalSongNote,
                    deleteNote: deletePersonalSongNote,
                },
            });
            if (!result.ok) {
                setMessage(result.reason === 'network'
                    ? 'Keine Verbindung zum Server. Die lokale Notiz bleibt erhalten.'
                    : 'Der Serverstand hat sich erneut geändert. Bitte entscheide anhand der neuen Fassung.');
                await refreshPending(userId);
                return;
            }
            await finish();
        } finally {
            setPendingAction(false);
        }
    };

    const discard = async () => {
        setPendingAction(true);
        try {
            await discardPendingNote(change);
            await finish();
        } finally {
            setPendingAction(false);
        }
    };

    const copyText = async () => {
        const text = change.text ?? '';
        try {
            await navigator.clipboard.writeText(text);
            setMessage('Text kopiert.');
        } catch {
            setMessage('Kopieren nicht möglich. Bitte den Text markieren.');
        }
    };

    const comparison = change.conflict ? conflictCopy(change) : null;

    return (
        <Dialog open={open} onClose={pendingAction ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="note-conflict-title">
            <DialogTitle id="note-conflict-title">{title}</DialogTitle>
            <DialogContent>
                {comparison ? (
                    <>
                        <Typography sx={{ mb: 2 }}>{comparison.title}</Typography>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                            <NoteComparison label={comparison.localLabel} text={comparison.localText} />
                            <NoteComparison
                                label="Aktuelle Online-Notiz"
                                text={change.conflict.serverText ?? ''}
                            />
                        </Box>
                    </>
                ) : (
                    <>
                        <Typography sx={{ mb: 2 }}>{blockedCopy(change)}</Typography>
                        <TextField
                            label="Lokaler Text"
                            value={change.text ?? ''}
                            multiline
                            minRows={4}
                            fullWidth
                            slotProps={{ input: { readOnly: true } }}
                        />
                        <Button sx={{ mt: 1 }} onClick={copyText}>Text kopieren</Button>
                    </>
                )}
                {message ? <Alert severity="info" sx={{ mt: 2 }}>{message}</Alert> : null}
                {items.length > 1 ? (
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        {index + 1} von {items.length}
                    </Typography>
                ) : null}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={pendingAction}>Schließen</Button>
                {comparison ? (
                    <>
                        <Button onClick={() => choose('server')} disabled={pendingAction} variant="outlined">
                            {comparison.keepServer}
                        </Button>
                        <Button onClick={() => choose('local')} disabled={pendingAction} variant="contained">
                            {comparison.keepLocal}
                        </Button>
                    </>
                ) : (
                    <Button onClick={discard} disabled={pendingAction} color="error" variant="contained">
                        Lokale Notiz verwerfen
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
