import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import PersonalSongNotePanel from './PersonalSongNotePanel.jsx';

export default function SongNotes({ token, bandId, songId, offline = null }) {
    const [mounted, setMounted] = useState(false);

    return (
        <Accordion
            disableGutters
            elevation={0}
            slots={{ heading: 'div' }}
            onChange={(_, expanded) => {
                if (expanded) {
                    setMounted(true);
                }
            }}
            sx={{
                mt: 2,
                bgcolor: 'transparent',
                borderTop: 1,
                borderColor: 'divider',
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                id="personal-notes-header"
                aria-controls="personal-notes-panel"
                sx={{ minHeight: 48, px: 0.5 }}
            >
                <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Meine Notizen
                </Typography>
            </AccordionSummary>
            <AccordionDetails id="personal-notes-panel" sx={{ px: 0.5, pt: 0 }}>
                {mounted ? (
                    <PersonalSongNotePanel
                        key={songId ?? 'draft'}
                        token={token}
                        bandId={bandId}
                        songId={songId}
                        offline={offline}
                    />
                ) : null}
            </AccordionDetails>
        </Accordion>
    );
}
