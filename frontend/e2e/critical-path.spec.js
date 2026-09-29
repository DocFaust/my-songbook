import { expect, test } from '@playwright/test';
import { completeKeycloakForm, contextOptions, newUserContext } from './support/auth.js';
import { memberUser, ownerUser } from './support/users.js';

// One band, one song and one setlist. The cases follow a single membership
// lifecycle, so they run in order in this file and are not independent.
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const bandName = `E2E ${stamp}`;
const songTitle = `E2E Song ${stamp}`;
const setlistName = `E2E Set ${stamp}`;
const ownerNote = `Notiz Eigentuemer ${stamp}`;
const memberNote = `Notiz Mitglied ${stamp}`;
const songMarker = `E2E-MARKER-${stamp}`;

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function openApp(page) {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Band anlegen' })).toBeVisible();
    const noBand = page.getByText('Keine Band', { exact: true });
    const selector = page.getByRole('combobox', { name: 'Aktive Band' });
    await expect(noBand.or(selector)).toBeVisible();
}

async function selectBand(page) {
    const selector = page.getByRole('combobox', { name: 'Aktive Band' });
    await expect(selector).toBeVisible();
    const current = await selector.innerText();
    if (current.includes(bandName)) {
        return;
    }
    await selector.click();
    await page.getByRole('option', { name: bandName, exact: true }).click();
    await expect(selector).toContainText(bandName);
}

async function useBand(page) {
    await openApp(page);
    await selectBand(page);
}

async function openBandPage(page) {
    await page.getByRole('link', { name: 'Band', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Band: ${bandName}` })).toBeVisible();
}

async function openSong(page) {
    await page.getByRole('link', { name: 'Editor', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(escapeRegex(songTitle)) }).click();
    await expect(page.getByRole('heading', { name: songTitle, level: 3 })).toBeVisible();
}

async function changeRole(page, role) {
    const select = page.getByRole('combobox', { name: /^Rolle von / });
    await select.click();
    await page.getByRole('option', { name: role, exact: true }).click();
    await expect(select).toContainText(role);
}

async function expectBandAbsent(page) {
    await expect(page.getByRole('heading', { name: `Band: ${bandName}` })).toHaveCount(0);
    const noBand = page.getByText('Keine Band', { exact: true });
    const selector = page.getByRole('combobox', { name: 'Aktive Band' });
    await expect(noBand.or(selector)).toBeVisible();
    if (await noBand.isVisible()) {
        return;
    }
    await expect(selector).not.toContainText(bandName);
    await selector.click();
    await expect(page.getByRole('option', { name: bandName, exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
}

async function leaveBand(page) {
    await openBandPage(page);
    await page.getByRole('button', { name: 'Band verlassen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Band verlassen' });
    await dialog.getByRole('button', { name: 'Mitgliedschaft beenden' }).click();
    await expect(dialog).toBeHidden();
    await expectBandAbsent(page);
}

test.describe('Kritischer Pfad', () => {
    test('legt eine Band an und ist Eigentümer', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        try {
            await openApp(owner.page);
            await owner.page.getByRole('button', { name: 'Band anlegen' }).click();
            const dialog = owner.page.getByRole('dialog', { name: 'Neue Band' });
            await dialog.getByLabel('Name').fill(bandName);
            await dialog.getByRole('button', { name: 'Anlegen' }).click();
            await expect(dialog).toBeHidden();
            await expect(owner.page.getByRole('combobox', { name: 'Aktive Band' })).toContainText(bandName);
            await expect(owner.page.getByRole('link', { name: 'Editor' })).toBeVisible();

            await openBandPage(owner.page);
            await expect(owner.page.getByText('Du', { exact: true })).toBeVisible();
            await expect(owner.page.getByText('OWNER', { exact: true })).toBeVisible();
        } finally {
            await owner.context.close();
        }
    });

    test('nimmt eine Einladung über den Keycloak-Login an', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        const guestContext = await browser.newContext(contextOptions);
        const guestPage = await guestContext.newPage();
        try {
            await useBand(owner.page);
            await openBandPage(owner.page);
            await owner.page.getByRole('button', { name: 'Einladungslink erzeugen' }).click();
            const inviteUrl = await owner.page.getByLabel('Einladungslink').inputValue();
            expect(inviteUrl).toMatch(/\/invite\/.+/);

            await guestPage.goto(inviteUrl);
            await completeKeycloakForm(guestPage, memberUser);
            await guestPage.waitForURL(/\/editor$/);
            await expect(guestPage.getByRole('combobox', { name: 'Aktive Band' })).toContainText(bandName);
            await openBandPage(guestPage);
            await expect(guestPage.getByText('Du', { exact: true })).toBeVisible();
            await expect(guestPage.getByText('GUEST', { exact: true })).toBeVisible();

            await owner.page.reload();
            await expect(owner.page.getByRole('combobox', { name: /^Rolle von / })).toBeVisible();
            await expect(owner.page.getByRole('combobox', { name: 'Aktive Band' })).toContainText(bandName);
        } finally {
            await owner.context.close();
            await guestContext.close();
        }
    });

    test('ändert die Rolle von GUEST über MEMBER zu ADMIN', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        try {
            await useBand(owner.page);
            await openBandPage(owner.page);
            await changeRole(owner.page, 'MEMBER');
            await changeRole(owner.page, 'ADMIN');
        } finally {
            await owner.context.close();
        }
    });

    test('speichert einen Song und behält ihn nach dem Neuladen', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        try {
            await useBand(owner.page);
            await owner.page.getByRole('link', { name: 'Import', exact: true }).click();
            await owner.page.getByLabel('Titel').fill(songTitle);
            await owner.page.getByLabel('Artist').fill('E2E');
            await owner.page.getByLabel('UG-Inhalt einfügen').fill('C G\nHello E2E');
            await owner.page.getByRole('button', { name: 'Konvertieren & Speichern' }).click();
            await expect(owner.page.getByText('Song importiert!')).toBeVisible();

            await openSong(owner.page);
            const songText = owner.page.getByRole('textbox', { name: 'Songtext' });
            await songText.fill(`${await songText.inputValue()}\n${songMarker}`);
            await owner.page.getByRole('button', { name: 'Speichern', exact: true }).click();
            await expect(owner.page.getByText('Song gespeichert!')).toBeVisible();

            await owner.page.reload();
            await openSong(owner.page);
            await expect(owner.page.getByRole('textbox', { name: 'Songtext' })).toHaveValue(
                new RegExp(escapeRegex(songMarker))
            );
        } finally {
            await owner.context.close();
        }
    });

    test('speichert eine Setlist und erlaubt denselben Song zweimal', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        try {
            await useBand(owner.page);
            await owner.page.getByRole('link', { name: 'Sets', exact: true }).click();
            await owner.page.getByLabel('Name').fill(setlistName);
            const songSelect = owner.page.getByRole('combobox', { name: 'Song hinzufügen' });
            await expect(songSelect).toBeEnabled();

            const entries = owner.page.getByRole('list', { name: 'Setlist-Einträge' });
            await songSelect.click();
            await owner.page.getByRole('option', { name: songTitle, exact: true }).click();
            await expect(entries.getByText(songTitle)).toHaveCount(1);
            await songSelect.click();
            await owner.page.getByRole('option', { name: songTitle, exact: true }).click();
            await expect(entries.getByText(songTitle)).toHaveCount(2);

            await owner.page.getByRole('button', { name: 'Setlist speichern' }).click();
            const saved = owner.page.getByRole('list', { name: 'Gespeicherte Setlists' });
            await expect(saved.getByRole('button', { name: `${setlistName} (2)` })).toBeVisible();

            await owner.page.reload();
            await saved.getByRole('button', { name: `${setlistName} (2)` }).click();
            await expect(entries.getByText(songTitle)).toHaveCount(2);
        } finally {
            await owner.context.close();
        }
    });

    test('trennt persönliche Notizen zwischen zwei Mitgliedern', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        const member = await newUserContext(browser, memberUser);
        try {
            await useBand(owner.page);
            await openSong(owner.page);
            const ownerNoteField = owner.page.getByRole('textbox', { name: 'Meine Notiz' });
            await expect(ownerNoteField).toBeEnabled();
            await ownerNoteField.fill(ownerNote);
            await owner.page.getByRole('button', { name: 'Notiz speichern' }).click();
            await expect(owner.page.getByText('Notiz gespeichert.')).toBeVisible();

            await useBand(member.page);
            await openSong(member.page);
            const memberNoteField = member.page.getByRole('textbox', { name: 'Meine Notiz' });
            await expect(memberNoteField).toBeEnabled();
            await expect(memberNoteField).toHaveValue('');
            await memberNoteField.fill(memberNote);
            await member.page.getByRole('button', { name: 'Notiz speichern' }).click();
            await expect(member.page.getByText('Notiz gespeichert.')).toBeVisible();

            await owner.page.reload();
            await openSong(owner.page);
            await expect(owner.page.getByRole('textbox', { name: 'Meine Notiz' })).toHaveValue(ownerNote);
            await expect(owner.page.getByRole('textbox', { name: 'Meine Notiz' })).not.toHaveValue(memberNote);
        } finally {
            await owner.context.close();
            await member.context.close();
        }
    });

    test('verlässt die Band als Nicht-Eigentümer', async ({ browser }) => {
        const member = await newUserContext(browser, memberUser);
        try {
            await useBand(member.page);
            await leaveBand(member.page);
        } finally {
            await member.context.close();
        }
    });

    test('zeigt nach erneutem Beitritt keine alte persönliche Notiz', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        const member = await newUserContext(browser, memberUser);
        try {
            await useBand(owner.page);
            await openBandPage(owner.page);
            await owner.page.getByRole('button', { name: 'Einladungslink erzeugen' }).click();
            const inviteUrl = await owner.page.getByLabel('Einladungslink').inputValue();

            await member.page.goto(inviteUrl);
            await member.page.waitForURL(/\/editor$/);
            await expect(member.page.getByRole('combobox', { name: 'Aktive Band' })).toContainText(bandName);
            await openSong(member.page);
            const note = member.page.getByRole('textbox', { name: 'Meine Notiz' });
            await expect(note).toBeEnabled();
            await expect(note).toHaveValue('');
            await expect(note).not.toHaveValue(memberNote);
        } finally {
            await owner.context.close();
            await member.context.close();
        }
    });

    test('überträgt die Eigentümerschaft und der bisherige Eigentümer verlässt die Band', async ({ browser }) => {
        const owner = await newUserContext(browser, ownerUser);
        const member = await newUserContext(browser, memberUser);
        try {
            await useBand(owner.page);
            await openBandPage(owner.page);
            const target = owner.page.getByRole('combobox', { name: 'Mitglied für die Eigentümerschaft' });
            await target.click();
            await owner.page.getByRole('option').filter({ hasNotText: 'Mitglied wählen' }).click();
            await owner.page.getByRole('button', { name: 'Ownership übertragen' }).click();
            const transferDialog = owner.page.getByRole('dialog', { name: 'Eigentümerschaft übertragen' });
            await transferDialog.getByRole('button', { name: 'Eigentümerschaft übertragen' }).click();
            await expect(transferDialog).toBeHidden();
            await expect(owner.page.getByRole('combobox', { name: 'Rolle von Du' })).toContainText('ADMIN');
            await expect(owner.page.getByText('OWNER', { exact: true })).toBeVisible();

            await useBand(member.page);
            await openBandPage(member.page);
            await expect(member.page.getByText('Du', { exact: true })).toBeVisible();
            await expect(member.page.getByText('OWNER', { exact: true })).toBeVisible();
            await expect(member.page.getByRole('combobox', { name: 'Rolle von Du' })).toHaveCount(0);
            await expect(member.page.getByRole('combobox', { name: /^Rolle von / })).toContainText('ADMIN');
            await expect(member.page.getByText('solange du Eigentümer bist')).toBeVisible();

            await leaveBand(owner.page);
            await expectBandAbsent(owner.page);

            await member.page.goto('/');
            await selectBand(member.page);
            await openSong(member.page);
            await expect(member.page.getByRole('textbox', { name: 'Songtext' })).toHaveValue(
                new RegExp(escapeRegex(songMarker))
            );
            await member.page.getByRole('link', { name: 'Sets', exact: true }).click();
            await expect(
                member.page.getByRole('list', { name: 'Gespeicherte Setlists' })
                    .getByRole('button', { name: `${setlistName} (2)` })
            ).toBeVisible();
        } finally {
            await owner.context.close();
            await member.context.close();
        }
    });
});
