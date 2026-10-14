// @ts-check
// Politique de sécurité du contenu (constat F-10), vérifiée en file:// comme en usage réel.
// Les pages hors ligne ne peuvent joindre aucun serveur ; les pages en ligne, seulement ceux
// des réseaux (commun/connexion.js).
const { test, expect } = require('@playwright/test');
const { urlPage } = require('./outils');
const { PilotePreparer } = require('./pilotes/preparer');
const { PiloteSigner } = require('./pilotes/signer');
const { PiloteEnvoyer } = require('./pilotes/envoyer');
const { PiloteCreer } = require('./pilotes/creer');
const { nouvelEtat } = require('./reseau');
const { MOTS, ADRESSES: A } = require('../donnees/vecteurs');
const C = require('../donnees/comptes');

const PAGES = ['hors-ligne/1-creer-wallet.html', 'en-ligne/2-preparer.html', 'hors-ligne/3-signer.html', 'en-ligne/4-envoyer.html'];

/** Violations de la politique, telles que le navigateur les signale dans la console. */
function surveiller(page) {
  const violations = [];
  page.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text()); });
  return violations;
}

for (const chemin of PAGES) {
  test(`${chemin} · déclare une politique qui interdit tout par défaut`, async ({ page }) => {
    await page.goto(urlPage(chemin));
    const politique = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    expect(politique).toContain("default-src 'none'");
    expect(politique).toContain("script-src 'self'");
    expect(politique).not.toMatch(/unsafe-inline|unsafe-eval/);
  });
}

for (const chemin of ['hors-ligne/1-creer-wallet.html', 'hors-ligne/3-signer.html']) {
  test(`${chemin} · aucune connexion possible, même sur un poste connecté`, async ({ page }) => {
    const violations = surveiller(page);
    await page.goto(urlPage(chemin));
    const resultat = await page.evaluate(() => fetch('https://example.org/').then(() => 'joint', () => 'bloqué'));
    expect(resultat).toBe('bloqué');
    expect(violations.join('\n')).toContain('connect-src');
  });
}

test('page en ligne · un serveur hors liste est bloqué', async ({ page }) => {
  const violations = surveiller(page);
  await page.goto(urlPage('en-ligne/4-envoyer.html'));
  const resultat = await page.evaluate(() => fetch('https://example.org/').then(() => 'joint', () => 'bloqué'));
  expect(resultat).toBe('bloqué');
  expect(violations.join('\n')).toContain('connect-src');
});

for (const c of [
  { chaine: 'XRPL', mots: MOTS.abandon12, source: A.xrplAbandon12, dest: A.xrplAbandon24, etat: () => nouvelEtat({ xrplComptes: C.xrpl.standard }) },
  { chaine: 'XLM', mots: MOTS.sep5test1, source: A.xlmSep5test1, dest: A.xlmSep5test3, etat: () => nouvelEtat({ xlmComptes: C.xlm.standard }) },
]) {
  test(`${c.chaine} · le cycle complet fonctionne sans aucune violation de la politique`, async ({ browser }) => {
    const etat = c.etat();
    const posteEnLigne = await browser.newContext();
    const posteHorsLigne = await browser.newContext();
    const violations = [];

    const p1 = await posteHorsLigne.newPage();
    violations.push(...surveiller(p1));
    const creer = new PiloteCreer(p1);
    await creer.ouvrir(c.chaine);
    await creer.creer(12);
    await creer.enregistrerFichier('Lampe-Orage-Velours-1987!');
    await creer.enregistrerAdressePublique();

    const p2 = await posteEnLigne.newPage();
    const v2 = surveiller(p2);
    const preparer = new PilotePreparer(p2, etat);
    await preparer.ouvrir(c.chaine);
    await preparer.verifierCompte(c.source);
    await preparer.envoyer({ vers: c.dest, tag: '104557', montant: '10' });

    const p3 = await posteHorsLigne.newPage();
    const v3 = surveiller(p3);
    const signer = new PiloteSigner(p3);
    await signer.ouvrir();
    await signer.chargerFichier(preparer.dernierExport);
    await signer.signerAvecMots(c.mots);
    const signe = await signer.enregistrer();

    const p4 = await posteEnLigne.newPage();
    const v4 = surveiller(p4);
    const envoyer = new PiloteEnvoyer(p4, etat);
    await envoyer.ouvrir();
    await envoyer.chargerFichierSigne(signe);
    expect((await envoyer.envoyer()).reussi).toBe(true);

    expect([...violations, ...v2, ...v3, ...v4]).toEqual([]);
    await posteEnLigne.close();
    await posteHorsLigne.close();
  });
}
