import { describe, expect, it } from 'vitest';
import { displayName, userInitials } from '../userLabel.js';

describe('userLabel', () => {
    it('bevorzugt den Anmeldenamen', () => {
        expect(displayName({ profile: { preferred_username: 'ada', name: 'Ada Lovelace' } })).toBe('ada');
        expect(displayName({ profile: { name: 'Ada Lovelace' } })).toBe('Ada Lovelace');
        expect(displayName({ profile: {} })).toBe('Angemeldet');
    });

    it('bildet Initialen aus Vor- und Nachname oder den ersten beiden Zeichen', () => {
        expect(userInitials('Werner Faust')).toBe('WF');
        expect(userInitials('local-dev')).toBe('LD');
        expect(userInitials('ada')).toBe('AD');
        expect(userInitials('…')).toBe('•');
    });
});
