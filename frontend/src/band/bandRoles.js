export function canMutateBandMusic(role) {
    if (role == null) {
        return true;
    }
    return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
}

export function canDeleteBandMusic(role) {
    if (role == null) {
        return true;
    }
    return role === 'OWNER' || role === 'ADMIN';
}

export function canManageMemberships(role) {
    return role === 'OWNER' || role === 'ADMIN';
}

export function isOwnerRole(role) {
    return role === 'OWNER';
}

export const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'GUEST'];
