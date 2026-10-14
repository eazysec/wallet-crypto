// @ts-check
// Composants partagés (commun/), vérifiés sur la page de référence commun/specimen.html.
const { test, expect } = require('@playwright/test');
const { urlPage } = require('./outils');

const SPECIMEN = 'commun/specimen.html';

test.beforeEach(async ({ page }) => {
  // La page de référence doit fonctionner sans réseau, comme les pages hors ligne.
  await page.context().setOffline(true);
  await page.goto(urlPage(SPECIMEN));
});

test('aucun style écrit dans le HTML (prérequis de la politique de sécurité du contenu)', async ({ page }) => {
  await expect(page.locator('[style]')).toHaveCount(0);
});

test('les polices embarquées sont chargées', async ({ page }) => {
  const chargees = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['16px "Atkinson Hyperlegible Next"', '16px "Atkinson Hyperlegible Mono"'].map((f) => document.fonts.check(f));
  });
  expect(chargees).toEqual([true, true]);
});

test('une adresse est affichée par blocs de 4, extrémités marquées, et se copie sans espaces', async ({ page }) => {
  const adresse = page.locator('[data-adresse="rKt4WzP9bC7hN3qMvX8sJd2FgE6yRa5uTo"]').first();
  await expect(adresse.locator('span')).toHaveCount(9);
  await expect(adresse.locator('.adresse__bout')).toHaveText(['rKt4', 'To']);
  expect(await adresse.textContent()).toBe('rKt4WzP9bC7hN3qMvX8sJd2FgE6yRa5uTo');
});

test('un montant est affiché selon l\'usage français', async ({ page }) => {
  await expect(page.locator('[data-montant="1250"]').first()).toHaveText('1\u00a0250');
});

test('choix segmenté : un seul choix actif à la fois', async ({ page }) => {
  const choix = page.locator('[data-test="choix-format"]');
  await choix.getByRole('button', { name: '12 mots' }).click();
  await expect(choix.getByRole('button', { name: '12 mots' })).toHaveAttribute('aria-pressed', 'true');
  await expect(choix.getByRole('button', { name: '24 mots' })).toHaveAttribute('aria-pressed', 'false');
});

test('appui maintenu : relâcher trop tôt ne confirme rien', async ({ page }) => {
  const bouton = page.locator('[data-test="maintenir"]');
  await bouton.hover();
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await expect(bouton).not.toHaveClass(/est-confirme/);
});

test('appui maintenu : maintenir assez longtemps confirme', async ({ page }) => {
  const bouton = page.locator('[data-test="maintenir"]');
  await bouton.hover();
  await page.mouse.down();
  await expect(bouton).toHaveClass(/est-confirme/, { timeout: 3000 });
  await page.mouse.up();
  await expect(bouton).toHaveText('Transaction signée');
});

test('appui maintenu : fonctionne au clavier', async ({ page }) => {
  const bouton = page.locator('[data-test="maintenir"]');
  await bouton.focus();
  await page.keyboard.down('Space');
  await expect(bouton).toHaveClass(/est-confirme/, { timeout: 3000 });
  await page.keyboard.up('Space');
});

test('tiroir : s\'ouvre, se ferme par le bouton et par Échap', async ({ page }) => {
  const tiroir = page.locator('#tiroir-aide');
  await page.locator('[data-tiroir="tiroir-aide"]').first().click();
  await expect(tiroir).toBeVisible();
  await tiroir.getByRole('button', { name: 'Fermer' }).click();
  await expect(tiroir).toBeHidden();
  await page.locator('[data-tiroir="tiroir-aide"]').first().click();
  await expect(tiroir).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tiroir).toBeHidden();
});

test('secret : masqué par défaut, affichable volontairement', async ({ page }) => {
  const saisie = page.locator('#specimen-mot-de-passe');
  const bouton = page.locator('[data-basculer-secret="specimen-mot-de-passe"]');
  await expect(saisie).toHaveAttribute('type', 'password');
  await bouton.click();
  await expect(saisie).toHaveAttribute('type', 'text');
  await expect(bouton).toHaveText('Masquer');
  await bouton.click();
  await expect(saisie).toHaveAttribute('type', 'password');
});

test('appui maintenu : un appui trop court dit qu\'il faut maintenir, puis le libellé revient', async ({ page }) => {
  const bouton = page.locator('[data-test="maintenir"]');
  const libelle = await bouton.innerText();
  await bouton.click();
  await expect(bouton).toHaveText("Maintenez appuyé jusqu'au bout");
  await expect(bouton).not.toHaveClass(/est-confirme/);
  await expect(bouton).toHaveText(libelle, { timeout: 5000 });
});
