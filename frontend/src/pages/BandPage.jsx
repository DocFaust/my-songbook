import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from 'react-oidc-context';
import { ApiError, apiErrorMessage } from '../api/apiClient.js';
import { createInvitation, listInvitations, revokeInvitation } from '../api/invitationsApi.js';
import { leaveBand, listMembers, removeMember, transferOwnership, updateMemberRole } from '../api/membershipsApi.js';
import { useCurrentUser } from '../auth/useCurrentUser.js';
import { useBand } from '../band/BandContext.jsx';
import { ASSIGNABLE_ROLES, canLeaveBand, canManageMemberships, canTransferOwnership } from '../band/bandRoles.js';
import MusicWorkflowGate from '../components/MusicWorkflowGate.jsx';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';

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

function membershipActionMessage(error) {
    if (error instanceof ApiError && error.body?.error === 'OWNER cannot leave the band') {
        return 'Du kannst diese Band nicht verlassen, solange du Eigentümer bist. Übertrage zuerst die Eigentümerschaft.';
    }
    if (error instanceof ApiError && error.body?.error === 'Ownership cannot be transferred to yourself') {
        return 'Die Eigentümerschaft kann nicht an dich selbst übertragen werden.';
    }
    if (error instanceof ApiError && error.body?.error === 'Target member is required') {
        return 'Bitte wähle ein Mitglied aus.';
    }
    return apiErrorMessage(error);
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

function loadingNotice(isLoading) {
    return isLoading ? <Typography sx={{ mb: 2 }}>Laden…</Typography> : null;
}

function BandWorkspace() {
    const auth = useAuth();
    const { activeBand, refreshBands, dropBand } = useBand();
    const { currentUser } = useCurrentUser();
    const token = auth.user?.access_token;
    const bandId = activeBand.id;
    const canManage = canManageMemberships(activeBand.role);
    const canTransfer = canTransferOwnership(activeBand.role);
    const canLeave = canLeaveBand(activeBand.role);
    const currentUserId = currentUser?.id;

    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [createdInvite, setCreatedInvite] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [transferTargetId, setTransferTargetId] = useState('');
    const [transferOpen, setTransferOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [pending, setPending] = useState(false);

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
            setError(membershipActionMessage(err));
        }
    };

    const handleRemove = async (userId) => {
        setError(null);
        try {
            await removeMember({ token, bandId, userId });
            await load();
        } catch (err) {
            setError(membershipActionMessage(err));
        }
    };

    const transferTargets = members.filter((member) => currentUserId && member.userId !== currentUserId);
    const selectedTarget = transferTargets.find((member) => member.userId === transferTargetId) ?? null;

    const handleTransfer = async () => {
        if (!selectedTarget) {
            return;
        }
        setError(null);
        setPending(true);
        try {
            await transferOwnership({ token, bandId, userId: selectedTarget.userId });
            setTransferOpen(false);
            await refreshBands();
            await load();
        } catch (err) {
            setError(membershipActionMessage(err));
        } finally {
            setPending(false);
        }
    };

    const handleLeave = async () => {
        setError(null);
        setPending(true);
        try {
            await leaveBand({ token, bandId });
            setLeaveOpen(false);
            setPending(false);
            dropBand(bandId);
            try {
                await refreshBands();
            } catch {
                // Die verlassene Band ist lokal bereits verworfen.
            }
        } catch (err) {
            setError(membershipActionMessage(err));
            setPending(false);
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
            setError(membershipActionMessage(err));
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
            setError(membershipActionMessage(err));
        }
    };

    return (
        <Box sx={{ p: 2, maxWidth: 800 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Band: {activeBand.name}
            </Typography>
            {error && !transferOpen && !leaveOpen ? (
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            ) : null}
            {loadingNotice(loading)}

            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Mitglieder
            </Typography>
            {members.map((member) => {
                const owner = member.role === 'OWNER';
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

            {canTransfer ? (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                        Eigentümerschaft
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                                displayEmpty
                                value={selectedTarget ? transferTargetId : ''}
                                aria-label="Mitglied für die Eigentümerschaft"
                                onChange={(event) => setTransferTargetId(event.target.value)}
                            >
                                <MenuItem value="">Mitglied wählen</MenuItem>
                                {transferTargets.map((member) => (
                                    <MenuItem key={member.userId} value={member.userId}>
                                        {memberLabel(member, currentUserId)} ({member.role})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            disabled={!selectedTarget || pending}
                            onClick={() => {
                                setError(null);
                                setTransferOpen(true);
                            }}
                        >
                            Ownership übertragen
                        </Button>
                    </Box>
                </Box>
            ) : null}

            <Box sx={{ mt: 3 }}>
                {canLeave ? (
                    <Button
                        color="error"
                        variant="outlined"
                        disabled={pending}
                        onClick={() => {
                            setError(null);
                            setLeaveOpen(true);
                        }}
                    >
                        Band verlassen
                    </Button>
                ) : (
                    <Alert severity="info">
                        Du kannst diese Band nicht verlassen, solange du Eigentümer bist.
                        Übertrage zuerst die Eigentümerschaft an ein anderes Mitglied.
                    </Alert>
                )}
            </Box>

            <Dialog open={transferOpen} onClose={() => !pending && setTransferOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Eigentümerschaft übertragen</DialogTitle>
                <DialogContent>
                    <Typography>
                        Möchtest du die Eigentümerschaft wirklich an {selectedTarget ? memberLabel(selectedTarget, currentUserId) : 'dieses Mitglied'} übertragen?
                        Du wirst anschließend Administrator dieser Band.
                    </Typography>
                    {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTransferOpen(false)} disabled={pending}>Abbrechen</Button>
                    <Button onClick={handleTransfer} disabled={pending || !selectedTarget} variant="contained">
                        Eigentümerschaft übertragen
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={leaveOpen} onClose={() => !pending && setLeaveOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Band verlassen</DialogTitle>
                <DialogContent>
                    <Typography>
                        Möchtest du die Band wirklich verlassen? Deine Mitgliedschaft wird beendet.
                        Deine persönlichen Notizen zu Songs dieser Band werden gelöscht.
                        Songs und Setlists dieser Band bleiben für die anderen Mitglieder erhalten.
                    </Typography>
                    {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLeaveOpen(false)} disabled={pending}>Abbrechen</Button>
                    <Button color="error" onClick={handleLeave} disabled={pending} variant="contained">
                        Mitgliedschaft beenden
                    </Button>
                </DialogActions>
            </Dialog>

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

function PerformanceBandWorkspace({ band }) {
    const canManage = canManageMemberships(band.role);
    const canTransfer = canTransferOwnership(band.role);
    const canLeave = canLeaveBand(band.role);
    return (
        <Box sx={{ p: 2, maxWidth: 800 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                Band: {band.name}
            </Typography>
            <Alert severity="info" id="performance-readonly-hint" sx={{ mb: 2 }}>
                Im Performance Mode nicht verfügbar.
            </Alert>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                Mitglieder
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
                Mitglieder und Einladungen können im Performance Mode nicht geändert werden.
            </Typography>
            {canManage ? (
                <Button variant="contained" disabled aria-describedby="performance-readonly-hint" sx={{ mr: 1, mb: 1 }}>
                    Einladungslink erzeugen
                </Button>
            ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Mitglieder und Rollen können OWNER und ADMIN ändern.
                </Alert>
            )}
            {canTransfer ? (
                <Button variant="contained" disabled aria-describedby="performance-readonly-hint" sx={{ mr: 1, mb: 1 }}>
                    Ownership übertragen
                </Button>
            ) : null}
            {canLeave ? (
                <Button color="error" variant="outlined" disabled aria-describedby="performance-readonly-hint">
                    Band verlassen
                </Button>
            ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                    Du kannst diese Band nicht verlassen, solange du Eigentümer bist.
                    Übertrage zuerst die Eigentümerschaft an ein anderes Mitglied.
                </Alert>
            )}
        </Box>
    );
}

function BandWorkspaceSwitch() {
    const performance = usePerformanceMode();
    const { activeBand } = useBand();
    if (performance.active) {
        return <PerformanceBandWorkspace band={activeBand} />;
    }
    return <BandWorkspace />;
}

export default function BandPage() {
    return (
        <MusicWorkflowGate>
            <BandWorkspaceSwitch />
        </MusicWorkflowGate>
    );
}
