// @ts-check
// Page 1 · invariants : ils doivent rester vrais avant et après la refonte.
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { PiloteCreer } = require('./pilotes/creer');
const { donnee } = require('./outils');
const V = require('../donnees/vecteurs');

test.describe('Page 1 · restaurer depuis des mots', () => {
  const cas = [
    ['XLM', V.MOTS.sep5test1, V.ADRESSES.xlmSep5test1, 'vecteur officiel SEP-0005 test 1'],
    ['XLM', V.MOTS.sep5test3, V.ADRESSES.xlmSep5test3, 'vecteur officiel SEP-0005 test 3'],
    ['XRPL', V.MOTS.abandon12, V.ADRESSES.xrplAbandon12, '12 mots'],
    ['XRPL', V.MOTS.abandon24, V.ADRESSES.xrplAbandon24, '24 mots'],
  ];
  for (const [chaine, mots, adresse, libelle] of cas) {
    test(`${chaine} · ${libelle}`, async ({ page }) => {
      const p = new PiloteCreer(page);
      await p.ouvrir(chaine);
      await p.restaurerDepuisMots(mots);
      expect((await p.lire()).adresse).toBe(adresse);
    });
  }
});

test.describe('Page 1 · créer un wallet', () => {
  for (const chaine of ['XRPL', 'XLM']) {
    for (const n of [12, 24]) {
      test(`${chaine} · ${n} mots BIP39, restaurables vers la même adresse`, async ({ page }) => {
        const p = new PiloteCreer(page);
        await p.ouvrir(chaine);
        await p.creer(n);
        const { mots, adresse } = await p.lire();
        const liste = await p.listeBip39();
        const tableau = mots.split(' ');
        expect(tableau).toHaveLength(n);
        for (const mot of tableau) expect(liste).toContain(mot);

        await p.ouvrir(chaine);
        await p.restaurerDepuisMots(mots);
        expect((await p.lire()).adresse).toBe(adresse);
      });
    }
  }

  test('XRPL · numéros secrets Xaman, restaurables vers la même adresse', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.creer('Numérique');
    const { mots, adresse } = await p.lire();
    expect(mots).toMatch(/^([0-9]{6} ){7}[0-9]{6}$/);

    await p.ouvrir('XRPL');
    await p.restaurerDepuisMots(mots);
    expect((await p.lire()).adresse).toBe(adresse);
  });
});

test.describe('Page 1 · fichier wallet chiffré', () => {
  test('XRPL · un fichier produit par l\'ancienne version reste lisible', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    expect(await p.restaurerDepuisFichier(donnee('wallets/xrpl-abandon12.xrplwallet'), V.MOT_DE_PASSE)).toBe(true);
    expect((await p.lire()).adresse).toBe(V.ADRESSES.xrplAbandon12);
  });

  test('XLM · un fichier produit par l\'ancienne version reste lisible', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XLM');
    expect(await p.restaurerDepuisFichier(donnee('wallets/xlm-sep5test1.xlmwallet'), V.MOT_DE_PASSE)).toBe(true);
    expect((await p.lire()).adresse).toBe(V.ADRESSES.xlmSep5test1);
  });

  for (const [chaine, mots, adresse] of [
    ['XRPL', V.MOTS.abandon12, V.ADRESSES.xrplAbandon12],
    ['XLM', V.MOTS.sep5test1, V.ADRESSES.xlmSep5test1],
  ]) {
    test(`${chaine} · enregistrer puis restaurer redonne la même adresse`, async ({ page }, infos) => {
      const p = new PiloteCreer(page);
      await p.ouvrir(chaine);
      await p.restaurerDepuisMots(mots);
      const fichier = await p.enregistrerFichier(V.MOT_DE_PASSE);
      expect(() => JSON.parse(fichier.contenu), 'le fichier ne doit pas être en clair').toThrow();

      const chemin = infos.outputPath(fichier.nom);
      fs.writeFileSync(chemin, fichier.contenu);
      await p.ouvrir(chaine);
      expect(await p.restaurerDepuisFichier(chemin, V.MOT_DE_PASSE)).toBe(true);
      expect((await p.lire()).adresse).toBe(adresse);
    });
  }

  test('un mauvais mot de passe ne restaure aucun wallet', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    expect(await p.restaurerDepuisFichier(donnee('wallets/xrpl-abandon12.xrplwallet'), 'pas-le-bon')).toBe(false);
  });
});
