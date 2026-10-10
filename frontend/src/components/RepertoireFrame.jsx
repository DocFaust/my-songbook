import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const REPERTOIRE_SONGS = '/repertoire';
const REPERTOIRE_SETLISTS = '/setlist';

function repertoireSection(pathname) {
    if (pathname === REPERTOIRE_SETLISTS) {
        return REPERTOIRE_SETLISTS;
    }
    if (pathname === REPERTOIRE_SONGS || pathname === '/editor') {
        return REPERTOIRE_SONGS;
    }
    return false;
}

export default function RepertoireFrame() {
    const { pathname } = useLocation();
    const section = repertoireSection(pathname);

    return (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, pb: 1 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 0.5 }}>
                Repertoire
            </Typography>
            <Tabs
                value={section}
                textColor="secondary"
                indicatorColor="secondary"
                aria-label="Repertoire"
                sx={{ minHeight: 48 }}
            >
                <Tab
                    component={RouterLink}
                    to={REPERTOIRE_SONGS}
                    value={REPERTOIRE_SONGS}
                    label="Songs"
                    sx={{ minHeight: 48, minWidth: 88, px: 2 }}
                />
                <Tab
                    component={RouterLink}
                    to={REPERTOIRE_SETLISTS}
                    value={REPERTOIRE_SETLISTS}
                    label="Setlists"
                    sx={{ minHeight: 48, minWidth: 88, px: 2 }}
                />
            </Tabs>
        </Box>
    );
}
