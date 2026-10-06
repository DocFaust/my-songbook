export function formatSnapshotStand(iso, now = new Date()) {
    if (typeof iso !== 'string' || iso.length === 0) {
        return null;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    const time = new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
    const sameDay = now.toDateString() === date.toDateString();
    if (sameDay) {
        return `heute ${time}`;
    }
    const day = new Intl.DateTimeFormat('de-DE', {
        day: 'numeric',
        month: 'numeric',
    }).format(date);
    return `${day} ${time}`;
}
