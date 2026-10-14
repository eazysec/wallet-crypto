// @ts-check
// Accessibilité au clavier : tout se fait sans souris, et l'élément actif est toujours visible.
const { test, expect } = require('@playwright/test');
const { urlPage, donnee } = require('./outils');
const { PiloteSigner } = require('./pilotes/signer');
const { PiloteEnvoyer } = require('./pilotes/envoyer');
const { nouvelEtat } = require('./reseau');
const V = require('../donnees/vecteurs');
const ATTENDU = require('../donnees/attendus');

/** Appuie sur Tab jusqu'à atteindre `selecteur` ; échoue si l'élément n'est pas atteignable. */
async function tabulerJusqua(page, selecteur) {
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement && document.activeElement.matches(s), selecteur)) return;
  }
  throw new Error(`${selecteur} n'est pas atteignable au clavier`);
}

/** Parcourt la page au clavier et renvoie les éléments atteints sans contour visible. */
async function elementsSansContour(page) {
  const sansContour = [];
  const vus = new Set();
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    const etat = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { id: 'corps de page', contour: true };
      // Champ de fichier caché : c'est son bouton « Parcourir… » qui doit montrer le focus.
      const visible = el.classList.contains('visuellement-cache') ? el.previousElementSibling : el;
      const style = getComputedStyle(visible);
      const contour = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      return { id: el.id || el.textContent.trim().slice(0, 30) || el.tagName, contour };
    });
    if (vus.has(etat.id)) break;
    vus.add(etat.id);
    if (!etat.contour) sansContour.push(etat.id);
  }
  return { sansContour, nombre: vus.size };
}

for (const chemin of ['hors-ligne/1-creer-wallet.html', 'en-ligne/2-preparer.html', 'hors-ligne/3-signer.html', 'en-ligne/4-envoyer.html']) {
  test(`${chemin} · chaque élément atteint au clavier montre un contour visible`, async ({ page }) => {
    await page.context().setOffline(true);
    await page.goto(urlPage(chemin));
    const { sansContour, nombre } = await elementsSansContour(page);
    expect(nombre).toBeGreaterThan(2);
    expect(sansContour).toEqual([]);
  });
}

test('page 3 · vérifier puis signer au clavier seul, appui maintenu compris', async ({ page }) => {
  const p = new PiloteSigner(page);
  await p.ouvrir();
  // Le choix du fichier ouvre la fenêtre du système : seul ce geste passe par Playwright.
  await page.setInputFiles('#fichier', donnee('transactions/xrpl-paiement.tosign.json'));
  await tabulerJusqua(page, '#choisir-cle');
  await page.keyboard.press('Enter');
  await tabulerJusqua(page, '#methode [data-valeur="mots"]');
  await page.keyboard.press('Enter');
  await tabulerJusqua(page, '#mots');
  await page.keyboard.type(V.MOTS.abandon12);
  await tabulerJusqua(page, '#ouvrir-mots');
  await page.keyboard.press('Enter');
  await tabulerJusqua(page, '#vers-signature');
  await page.keyboard.press('Enter');
  await tabulerJusqua(page, '#bouton-signer');
  await page.keyboard.down(' ');
  await expect(page.locator('#vue-enregistrer')).toBeVisible();
  await page.keyboard.up(' ');
  expect(await p.lire()).toEqual(ATTENDU.xrplClePrincipale);
});

test('page 4 · envoyer au clavier seul', async ({ page }) => {
  const etat = nouvelEtat({ registre: 1500 });
  const p = new PiloteEnvoyer(page, etat);
  await p.ouvrir();
  await p.chargerTransactionSignee(ATTENDU.xrplClePrincipale, 'XRPL');
  await tabulerJusqua(page, '#bouton-envoyer');
  await page.keyboard.press('Enter');
  await expect(page.locator('#vue-resultat')).toBeVisible();
  expect(etat.xrpl.soumises).toHaveLength(1);
});
