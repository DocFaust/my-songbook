import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { createInvitation, listInvitations, revokeInvitation } from '../api/invitationsApi.js';
import { listMembers, removeMember, updateMemberRole } from '../api/membershipsApi.js';
import { apiErrorMessage } from '../api/apiClient.js';
import { useCurrentUser } from '../auth/useCurrentUser.js';
import { useBand } from '../band/BandContext.jsx';
import { ASSIGNABLE_ROLES, canManageMemberships, isOwnerRole } from '../band/bandRoles.js';
import MusicWorkflowGate from '../components/MusicWorkflowGate.jsx';

function memberLabel(member, currentUserId) {
    if (currentUserId && member.userId === currentUserId) {
        return 'Du';
    }
    if (member.displayName && member.displayName !== member.userId) {
        return member.displayName;
    }
    return member.userId.slice(0, 8);
}

function formatExpiry(value) {
    if (!value) {
        return '';
    }
    return new Date(value).toLocaleString();
}

function invitationStatusLabel(status) {
    if (status === 'ACTIVE') {
        return 'Aktiv';
    }
    if (status === 'EXPIRED') {
        return 'Abgelaufen';
    }
    if (status === 'ACCEPTED') {
        return 'Angenommen';
    }
    return status;
}

function BandWorkspace() {
    const auth = useAuth();
    const { activeBand } = useBand();
    const { currentUser } = useCurrentUser();
    const token = auth.user?.access_token;
    const bandId = activeBand.id;
    const canManage = canManageMemberships(activeBand.role);
    const currentUserId = currentUser?.id;

    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [createdInvite, setCreatedInvite] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const [memberList, invitationList] = await Promise.all([
            listMembers({ token, bandId }),
            canManage ? listInvitations({ token, bandId }) : Promise.resolve([]),
        ]);
        setMembers(Array.isArray(memberList) ? memberList : []);
        setInvitations(Array.isArray(invitationList) ? invitationList : []);
    }, [token, bandId, canManage]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            listMembers({ token, bandId }),
            canManage ? listInvitations({ token, bandId }) : Promise.resolve([]),
        ])
            .then(([memberList, invitationList]) => {
                if (cancelled) {
                    return;
                }
                setMembers(Array.isArray(memberList) ? memberList : []);
                setInvitations(Array.isArray(invitationList) ? invitationList : []);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                setError(apiErrorMessage(err));
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token, bandId, canManage]);

    const handleRoleChange = async (userId, role) => {
        setError(null);
        try {
            await updateMemberRole({ token, bandId, userId, role });
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const handleRemove = async (userId) => {
        setError(null);
        try {
            await removeMember({ token, bandId, userId });
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const handleCreateInvitation = async () => {
        setError(null);
        setCopyFeedback('');
        try {
            const created = await createInvitation({ token, bandId });
            setCreatedInvite(created);
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const handleCopy = async () => {
        if (!createdInvite?.inviteUrl) {
            return;
        }
        try {
            await navigator.clipboard.writeText(createdInvite.inviteUrl);
            setCopyFeedback('Link kopiert.');
        } catch {
            setCopyFeedback('Kopieren nicht möglich. Bitte den Link manuell markieren.');
        }
    };

    const handleRevoke = async (invitationId) => {
        setError(null);
        try {
            await revokeInvitation({ token, bandId, invitationId });
            if (createdInvite?.id === invitationId) {
                setCreatedInvite(null);
            }
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    return (
        <Box sx={{ p: 2, maxWidth: 800 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Band: {activeBand.name}
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {loading ? <Typography sx={{ mb: 2 }}>Laden…</Typography> : null}

            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Mitglieder
            </Typography>
            {members.map((member) => {
                const owner = isOwnerRole(member.role);
                return (
                    <Box
                        key={member.userId}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            mb: 1,
                            flexWrap: 'wrap',
                        }}
                    >
                        <Typography sx={{ minWidth: 120 }}>
                            {memberLabel(member, currentUserId)}
                        </Typography>
                        {canManage && !owner ? (
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                                <Select
                                    value={member.role}
                                    aria-label={`Rolle von ${memberLabel(member, currentUserId)}`}
                                    onChange={(event) => handleRoleChange(member.userId, event.target.value)}
                                >
                                    {ASSIGNABLE_ROLES.map((role) => (
                                        <MenuItem key={role} value={role}>{role}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <Typography>{member.role}</Typography>
                        )}
                        {canManage && !owner ? (
                            <Button color="error" onClick={() => handleRemove(member.userId)}>
                                Entfernen
                            </Button>
                        ) : null}
                    </Box>
                );
            })}

            {canManage ? (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                        Einladungen
                    </Typography>
                    <Button variant="contained" onClick={handleCreateInvitation} sx={{ mb: 2 }}>
                        Einladungslink erzeugen
                    </Button>
                    {createdInvite ? (
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                label="Einladungslink"
                                value={createdInvite.inviteUrl}
                                slotProps={{ input: { readOnly: true } }}
                                sx={{ mb: 1 }}
                            />
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Gültig bis {formatExpiry(createdInvite.expiresAt)}
                            </Typography>
                            <Button onClick={handleCopy}>Link kopieren</Button>
                            {copyFeedback ? (
                                <Typography variant="body2" sx={{ mt: 1 }}>{copyFeedback}</Typography>
                            ) : null}
                        </Box>
                    ) : null}
                    {invitations.map((invitation) => (
                        <Box
                            key={invitation.id}
                            sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}
                        >
                            <Typography>
                                {invitationStatusLabel(invitation.status)} · bis {formatExpiry(invitation.expiresAt)}
                            </Typography>
                            {invitation.status === 'ACTIVE' ? (
                                <Button color="error" onClick={() => handleRevoke(invitation.id)}>
                                    Zurückziehen
                                </Button>
                            ) : null}
                        </Box>
                    ))}
                </Box>
            ) : (
                <Alert severity="info" sx={{ mt: 3 }}>
                    Mitglieder und Rollen können OWNER und ADMIN ändern.
                </Alert>
            )}
        </Box>
    );
}

export default function BandPage() {
    return (
        <MusicWorkflowGate>
            <BandWorkspace />
        </MusicWorkflowGate>
    );
}
