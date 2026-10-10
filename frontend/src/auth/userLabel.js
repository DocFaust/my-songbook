export function displayName(user) {
    const profile = user?.profile ?? {};
    return profile.preferred_username || profile.name || 'Angemeldet';
}

export function userInitials(name) {
    const parts = String(name).trim().split(/[\s._-]+/).filter((part) => part.length > 0);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase('de-DE');
    }
    const compact = String(name).replace(/[^0-9A-Za-zÄÖÜäöüß]/g, '');
    return (compact.slice(0, 2) || '•').toLocaleUpperCase('de-DE');
}
