import { expect, test } from '@playwright/test';
import { newUserContext } from './support/auth.js';
import { ownerUser } from './support/users.js';

const stamp = Date.now().toString(36);
const bandName = `E2E Cho ${stamp}`;
const songTitle = `Frühling ${stamp}`;
const chordPro = [
    `{title: ${songTitle}}`,
    '{artist: Müller}',
    '{comment: Größe}',
    '[C]Grün und groß',
    '',
].join('\n');

test('importiert eine lokale ChordPro-Datei unverändert', async ({ browser }) => {
    const owner = await newUserContext(browser, ownerUser);
    const page = owner.page;
    try {
        await page.goto('/');
        await expect(page.getByRole('button', { name: /^Konto von / })).toBeVisible();
        await page.getByRole('button', { name: /Aktive Band/ }).click();
        await page.getByRole('menuitem', { name: 'Band erstellen' }).click();
        const dialog = page.getByRole('dialog', { name: 'Neue Band' });
        await dialog.getByLabel('Name').fill(bandName);
        await dialog.getByRole('button', { name: 'Anlegen' }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole('button', { name: /Aktive Band/ })).toContainText(bandName);

        await page.getByRole('button', { name: '+ Song' }).click();
        await page.getByRole('menuitem', { name: 'Song importieren' }).click();
        await expect(page).toHaveURL(/\/import$/);
        await expect(page.getByRole('button', { name: 'Ultimate Guitar' })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'ChordPro-Datei', exact: true }).click();
        await page.getByLabel('ChordPro-Datei auswählen').setInputFiles({
            name: 'fruehling.cho',
            mimeType: 'text/plain',
            buffer: Buffer.from(chordPro, 'utf-8'),
        });

        await expect(page.getByLabel('Titel')).toHaveValue(songTitle);
        await expect(page.getByLabel('Interpret')).toHaveValue('Müller');
        await expect(page.getByRole('textbox', { name: 'ChordPro', exact: true })).toHaveValue(chordPro);
        await page.getByRole('button', { name: 'Ultimate Guitar' }).click();
        await expect(page.getByLabel('UG-Inhalt einfügen')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Konvertieren & Speichern' })).toBeDisabled();
        await page.getByRole('button', { name: 'ChordPro-Datei', exact: true }).click();
        await expect(page.getByRole('textbox', { name: 'ChordPro', exact: true })).toHaveValue(chordPro);
        await page.getByRole('button', { name: 'Song anlegen' }).click();
        await expect(page.getByText('Song importiert!')).toBeVisible();

        await page.getByRole('link', { name: 'SongManager' }).click();
        await expect(page).toHaveURL(/\/repertoire$/);
        await page.getByRole('button', { name: new RegExp(songTitle) }).click();
        await expect(page.getByRole('heading', { name: songTitle, level: 3 })).toBeVisible();
        await expect(page.getByText('Grün und groß')).toBeVisible();
        await page.getByRole('button', { name: 'Bearbeiten' }).click();
        await expect(page.getByRole('textbox', { name: 'Songtext' })).toHaveValue(chordPro);
    } finally {
        await owner.context.close();
    }
});
