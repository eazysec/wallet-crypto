// @ts-check
// Cohérence entre les 4 pages : un même élément s'affiche partout de la même façon.
const { test, expect } = require('@playwright/test');
const { urlPage } = require('./outils');

const PAGES = [
  ['hors-ligne/1-creer-wallet.html', null],
  ['en-ligne/2-preparer.html', null],
  ['hors-ligne/3-signer.html', 'lu dans le fichier'],
  ['en-ligne/4-envoyer.html', 'lu dans le fichier'],
];

for (const [chemin, valeur] of PAGES) {
  test(`${chemin} · le réseau est présenté dans la bande par « Réseau » et sa valeur`, async ({ page }) => {
    await page.context().setOffline(true);
    await page.goto(urlPage(chemin));
    const reseau = page.locator('.bande .bande__reseau');
    await expect(reseau).toHaveCount(1);
    await expect(reseau).toContainText(/^Réseau/);
    if (valeur) await expect(reseau.locator('.bande__valeur')).toHaveText(valeur);
    else await expect(reseau.locator('select')).toHaveCount(1);
  });
}

test('page 1 · le réseau se choisit dans la bande, comme à l\'étape 2, puis se verrouille', async ({ page }) => {
  await page.context().setOffline(true);
  await page.goto(urlPage('hors-ligne/1-creer-wallet.html'));
  const choix = page.locator('.bande .bande__reseau select');
  await expect(choix.locator('option')).toHaveText(['XRPL', 'Stellar']);
  await expect(page.locator('main [aria-label="Réseau"], main #chaine')).toHaveCount(0);
  await choix.selectOption('XLM');
  await expect(page.locator('#contexte-chaine')).toHaveText('Réseau : Stellar');
  await page.click('#aller-creer');
  await expect(choix).toBeDisabled();
  await page.click('[data-retour]:visible');
  await expect(choix).toBeEnabled();
});

// Petits écrans : l'écran principal d'abord, le contexte ensuite. Exception : l'étape 3, où le
// contexte est le guide « Comment vérifier », à lire avant de décider.
const ORDRE = [
  ['hors-ligne/1-creer-wallet.html', 'action'],
  ['en-ligne/2-preparer.html', 'action'],
  ['hors-ligne/3-signer.html', 'contexte'],
  ['en-ligne/4-envoyer.html', 'action'],
];
for (const [chemin, premier] of ORDRE) {
  for (const largeur of [390, 1000]) {
    test(`${chemin} · ${largeur} px · ${premier === 'action' ? "l'écran principal passe avant le contexte" : "le guide passe avant l'écran principal"}`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.context().setOffline(true);
      await page.goto(urlPage(chemin));
      const haut = async (selecteur) => (await page.locator(selecteur).boundingBox()).y;
      const [action, contexte] = [await haut('main.action'), await haut('aside.contexte')];
      if (premier === 'action') expect(action).toBeLessThan(contexte);
      else expect(contexte).toBeLessThan(action);
    });
  }
}
