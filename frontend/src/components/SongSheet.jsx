import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ChordProViewer from './ChordProViewer/index.jsx';

export default function SongSheet({
    title,
    artist,
    chordProText,
    canEdit,
    editBlockedReason,
    onEdit,
}) {
    return (
        <Box className="song-reading" component="article" aria-label="Songblatt">
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    mb: 2,
                }}
            >
                <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
                    <Typography
                        variant="h3"
                        component="h3"
                        sx={{
                            fontSize: { xs: '1.75rem', md: '2.25rem' },
                            lineHeight: 1.2,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {title}
                    </Typography>
                    {artist ? (
                        <Typography component="p" variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
                            {artist}
                        </Typography>
                    ) : null}
                </Box>
                <Box sx={{ flex: '0 0 auto' }}>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={onEdit}
                        disabled={!canEdit}
                        aria-describedby={editBlockedReason ? 'song-edit-blocked' : undefined}
                    >
                        Bearbeiten
                    </Button>
                    {editBlockedReason ? (
                        <Typography
                            id="song-edit-blocked"
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, maxWidth: 280 }}
                        >
                            {editBlockedReason}
                        </Typography>
                    ) : null}
                </Box>
            </Box>
            <ChordProViewer chordProText={chordProText} />
        </Box>
    );
}
