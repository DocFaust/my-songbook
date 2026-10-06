import React, { Fragment } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { isOidcConfigured } from '../auth/authConfig.js';
import { useBand } from '../band/BandContext.jsx';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';

export default function MusicWorkflowGate({ children }) {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const { isAuthenticated, activeBand, loading } = useBand();

    if (performance.active) {
        if (!performance.ready || loading) {
            return (
                <Box sx={{ p: 2 }}>
                    <Typography>Laden…</Typography>
                </Box>
            );
        }
        if (!activeBand) {
            return (
                <Box sx={{ p: 2 }}>
                    <Alert severity="info">
                        Für diesen Offline-Stand ist keine Band gespeichert.
                    </Alert>
                </Box>
            );
        }
        return <Fragment key={activeBand.id}>{children}</Fragment>;
    }

    if (!isOidcConfigured) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">
                    Import, Editor und Setlists erfordern eine Anmeldung. Authentifizierung ist nicht konfiguriert.
                </Alert>
            </Box>
        );
    }

    if (auth.isLoading || (isAuthenticated && loading)) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Laden…</Typography>
            </Box>
        );
    }

    if (!isAuthenticated) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Import, Editor und Setlists erfordern eine Anmeldung.
                </Alert>
                <Button variant="contained" onClick={() => auth.signinRedirect()}>
                    Anmelden
                </Button>
            </Box>
        );
    }

    if (!activeBand) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">
                    Keine Band ausgewählt. Lege oben eine Band an oder wähle eine bestehende Band,
                    um Songs und Setlists zu verwenden.
                </Alert>
            </Box>
        );
    }

    return <Fragment key={activeBand.id}>{children}</Fragment>;
}
