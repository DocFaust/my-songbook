import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { acceptInvitation } from '../api/invitationsApi.js';
import { ApiError, isApiErrorKind } from '../api/apiClient.js';
import { isOidcConfigured } from '../auth/authConfig.js';
import { clearPendingInviteToken, savePendingInviteToken } from '../auth/inviteStorage.js';
import { useBand } from '../band/BandContext.jsx';

function invitationErrorMessage(error) {
    if (isApiErrorKind(error, 'gone')) {
        return 'Diese Einladung ist abgelaufen. Bitte um einen neuen Link.';
    }
    if (isApiErrorKind(error, 'conflict')) {
        return 'Diese Einladung wurde bereits verwendet.';
    }
    if (isApiErrorKind(error, 'not_found')) {
        return 'Diese Einladung ist ungültig oder wurde zurückgezogen.';
    }
    if (error instanceof ApiError && error.kind === 'unauthorized') {
        return 'Bitte erneut anmelden, um die Einladung anzunehmen.';
    }
    return 'Die Einladung konnte nicht angenommen werden.';
}

export default function InvitePage() {
    const { token } = useParams();
    const auth = useAuth();
    const navigate = useNavigate();
    const { refreshBands } = useBand();
    const accessToken = auth.user?.access_token;
    const isAuthenticated = Boolean(auth.isAuthenticated && accessToken);
    const authLoading = auth.isLoading;
    const signinRedirect = auth.signinRedirect;
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!token || !isOidcConfigured) {
            return undefined;
        }
        if (authLoading) {
            return undefined;
        }
        if (!isAuthenticated) {
            savePendingInviteToken(token);
            signinRedirect();
            return undefined;
        }

        let cancelled = false;
        acceptInvitation({ token: accessToken, inviteToken: token })
            .then(async (accepted) => {
                clearPendingInviteToken();
                if (cancelled) {
                    return;
                }
                await refreshBands(accepted.bandId);
                navigate('/editor', { replace: true });
            })
            .catch((err) => {
                clearPendingInviteToken();
                if (!cancelled) {
                    setError(invitationErrorMessage(err));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [token, authLoading, isAuthenticated, accessToken, signinRedirect, refreshBands, navigate]);

    if (!isOidcConfigured) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">
                    Einladungen erfordern eine Anmeldung. Authentifizierung ist nicht konfiguriert.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2, maxWidth: 640 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Band-Einladung
            </Typography>
            {error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Typography>
                    Einladung wird angenommen…
                </Typography>
            )}
        </Box>
    );
}
