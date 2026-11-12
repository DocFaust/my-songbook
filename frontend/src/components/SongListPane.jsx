import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SongActions from './SongActions.jsx';
import SongSidebar from './SongSideBar';

export default function SongListPane({
    query,
    onQueryChange,
    onCreate,
    loading,
    songs,
    visibleSongs,
    performanceLocked,
    selectedId,
    onSelect,
}) {
    return (
        <Box
            className="song-list-body"
            sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    p: 1.5,
                    flexShrink: 0,
                }}
            >
                <TextField
                    label="Song suchen"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    size="small"
                    fullWidth
                    sx={{ flex: '1 1 160px', '& .MuiInputBase-root': { minHeight: 44 } }}
                />
                <SongActions onCreate={onCreate} />
            </Box>
            {performanceLocked ? (
                <Alert severity="info" id="performance-readonly-hint" sx={{ mx: 1.5, mb: 1 }}>
                    Im Performance Mode nicht verfügbar.
                </Alert>
            ) : null}
            {loading ? (
                <Typography sx={{ px: 2, py: 1 }} variant="body2">
                    Laden…
                </Typography>
            ) : null}
            {!loading && songs.length === 0 ? (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2">Noch keine Songs im Repertoire.</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Erstelle deinen ersten Song oder importiere einen bestehenden ChordPro-Song.
                    </Typography>
                </Box>
            ) : null}
            {!loading && songs.length > 0 && visibleSongs.length === 0 ? (
                <Typography sx={{ px: 2, py: 1 }} variant="body2">
                    Keine Songs passen zur Suche.
                </Typography>
            ) : null}
            <Box sx={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                <SongSidebar
                    songs={visibleSongs}
                    onSelect={onSelect}
                    selectedId={selectedId}
                />
            </Box>
        </Box>
    );
}
