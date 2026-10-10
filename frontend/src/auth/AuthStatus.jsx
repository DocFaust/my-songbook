import React, { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { isOidcConfigured } from './authConfig.js';
import { useCurrentUser } from './useCurrentUser.js';
import { displayName, userInitials } from './userLabel.js';

export default function AuthStatus() {
    const auth = useAuth();
    useCurrentUser();
    const [anchor, setAnchor] = useState(null);
    const open = Boolean(anchor);

    if (!isOidcConfigured) {
        return (
            <Typography variant="caption" sx={{ opacity: 0.75, px: 1 }}>
                Auth nicht konfiguriert
            </Typography>
        );
    }

    if (auth.isLoading) {
        return (
            <Typography variant="caption" sx={{ px: 1 }}>
                …
            </Typography>
        );
    }

    if (!auth.isAuthenticated) {
        return (
            <Button color="inherit" onClick={() => auth.signinRedirect()}>
                Anmelden
            </Button>
        );
    }

    const name = displayName(auth.user);

    return (
        <>
            <IconButton
                color="inherit"
                id="account-button"
                aria-label={`Konto von ${name}`}
                aria-haspopup="menu"
                aria-controls={open ? 'account-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                onClick={(event) => setAnchor(event.currentTarget)}
            >
                <Avatar
                    sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'secondary.main',
                        color: 'secondary.contrastText',
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    {userInitials(name)}
                </Avatar>
            </IconButton>
            <Menu
                id="account-menu"
                anchorEl={anchor}
                open={open}
                onClose={() => setAnchor(null)}
                slotProps={{ paper: { sx: { minWidth: 220 } } }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle1" component="p">{name}</Typography>
                </Box>
                <Divider />
                <MenuItem
                    onClick={() => {
                        setAnchor(null);
                        auth.signoutRedirect();
                    }}
                >
                    Abmelden
                </MenuItem>
            </Menu>
        </>
    );
}
