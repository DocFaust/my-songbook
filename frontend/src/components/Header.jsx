import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import AuthStatus from '../auth/AuthStatus.jsx';
import BandSelector from '../band/BandSelector.jsx';
import PerformanceStatus from '../performance/PerformanceStatus.jsx';
import SongActions from './SongActions.jsx';

export default function Header() {
    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
                <Typography variant="h6" component="h1" sx={{ m: 0, flexShrink: 0, lineHeight: 1, color: 'primary.contrastText' }}>
                    <Link
                        component={RouterLink}
                        to="/"
                        underline="none"
                        aria-label="SongManager"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: 44,
                            px: { xs: 0.5, sm: 1 },
                            color: 'primary.contrastText',
                            '&:hover': {
                                color: 'primary.contrastText',
                            },
                        }}
                    >
                        <Box
                            component="span"
                            aria-hidden
                            sx={{ mr: { xs: 0, sm: 1 }, color: 'primary.contrastText', fontSize: '1.25rem', lineHeight: 1 }}
                        >
                            ♫
                        </Box>
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            SongManager
                        </Box>
                    </Link>
                </Typography>
                <SongActions />
                <Button
                    component={RouterLink}
                    to="/setlist"
                    color="inherit"
                    aria-label="Setlists"
                    sx={{ flexShrink: 0, px: { xs: 1, sm: 1.5 }, minWidth: 0 }}
                >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Setlists</Box>
                    <Box component="span" sx={{ display: { sm: 'none' } }}>Sets</Box>
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: { xs: 0.25, sm: 0.5 } }}>
                    <BandSelector />
                    <PerformanceStatus />
                    <AuthStatus />
                </Box>
            </Toolbar>
        </AppBar>
    );
}
