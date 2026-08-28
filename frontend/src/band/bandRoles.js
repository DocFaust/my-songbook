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
