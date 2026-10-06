import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { usePerformanceMode } from './PerformanceModeContext.jsx';

function decisionLabel(count) {
    if (count === 1) {
        return '1 Notiz benötigt deine Entscheidung.';
    }
    return `${count} Notizen benötigen deine Entscheidung.`;
}

export default function PerformanceBanner({ onOpenDecisions }) {
    const {
        active,
        enabling,
        backendAvailable,
        unreachable,
        offlineReady,
        notice,
        conflicts,
        blocked,
        enable,
        dismissNotice,
    } = usePerformanceMode();
    const decisions = conflicts.length + blocked.length;

    return (
        <Box sx={{ px: 2, pt: 1 }}>
            {notice ? (
                <Alert severity="warning" sx={{ mb: 1 }} onClose={dismissNotice}>
                    {notice}
                </Alert>
            ) : null}
            {active && backendAvailable ? (
                <Alert severity="info" sx={{ mb: 1 }} role="status">
                    Verbindung verfügbar.
                </Alert>
            ) : null}
            {!active && unreachable ? (
                <Alert
                    severity="warning"
                    sx={{ mb: 1 }}
                    action={offlineReady ? (
                        <Button color="inherit" onClick={() => enable()} disabled={enabling}>
                            Performance Mode starten
                        </Button>
                    ) : null}
                >
                    {offlineReady
                        ? 'Server nicht erreichbar. Performance Mode ist verfügbar.'
                        : 'Server nicht erreichbar.'}
                </Alert>
            ) : null}
            {!active && decisions > 0 ? (
                <Alert
                    severity="info"
                    sx={{ mb: 1 }}
                    action={(
                        <Button color="inherit" onClick={onOpenDecisions}>
                            Entscheidungen öffnen
                        </Button>
                    )}
                >
                    {decisionLabel(decisions)}
                </Alert>
            ) : null}
        </Box>
    );
}
