// @ts-check
// Page 1 · invariants : ils doivent rester vrais avant et après la refonte.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
    test(`${chaine} · enregistrer puis restaurer redonne la même adresse`, async ({ page }) => {
      const p = new PiloteCreer(page);
      await p.ouvrir(chaine);
      await p.restaurerDepuisMots(mots);
      const fichier = await p.enregistrerFichier(V.MOT_DE_PASSE);
      expect(JSON.parse(fichier.contenu).format, 'le fichier doit être chiffré au format v2').toBe('securedwallet/wallet-v2');
      expect(fichier.contenu).not.toContain(mots.split(' ')[0] + ' ');

      // Chemin sans accents : le dépôt de fichier échoue si le chemin en contient
      // (le dossier de résultats reprend le titre du test, « même », « · »).
      const chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'securedwallet-')), fichier.nom);
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

// ---------- Nouvelle interface (lot 7) ----------

const { PiloteSigner } = require('./pilotes/signer');
const { PilotePreparer } = require('./pilotes/preparer');
const { nouvelEtat } = require('./reseau');
const { envelopperTransaction } = require('../../commun/fichiers');
const ATTENDU = require('../donnees/attendus');
const C = require('../donnees/comptes');

const A = V.ADRESSES;
const SOLIDE = 'Lampe-Orage-Velours-1987!';

/** Écrit un fichier dans un dossier temporaire sans accents (voir plus haut) et renvoie son chemin. */
function fichierTemporaire(nom, contenu) {
  const chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'securedwallet-')), nom);
  fs.writeFileSync(chemin, contenu);
  return chemin;
}

test.describe('Page 1 · nouvelle interface · créer', () => {
  test('les mots ne s\'affichent qu\'après le geste « personne ne voit mon écran », sans bouton Copier', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await page.click('#aller-creer');
    await expect(page.locator('#grille-mots li')).toHaveCount(0);
    await page.click('#format [data-valeur="12"]');
    await expect(page.locator('#afficher-mots')).toHaveText('Personne ne voit mon écran : afficher les 12 mots');
    await page.click('#afficher-mots');
    await expect(page.locator('#grille-mots li')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /copier/i })).toHaveCount(0);
  });

  test('« Masquer les mots » les cache, puis les remontre', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.afficherMots(24);
    await page.click('#masquer-mots');
    expect(new Set(await page.locator('#grille-mots .mots__mot').allTextContents())).toEqual(new Set(['•••••']));
    await page.click('#masquer-mots');
    expect((await page.locator('#grille-mots .mots__mot').allTextContents()).join(' ')).toBe(p.mots);
  });

  test('vérification de la copie : 3 mots différents, une faute bloque, la bonne copie débloque', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.afficherMots(24);
    await p.allerVerification();
    const positions = await p.positionsDemandees();
    expect(new Set(positions).size).toBe(3);
    const liste = p.mots.split(' ');
    const bons = positions.map((n) => liste[n - 1]);
    await p.recopier([bons[0], bons[1], 'faux']);
    expect(await p.copieAcceptee()).toBe(false);
    await p.recopier([bons[0], bons[1], ` ${bons[2].toUpperCase()} `]);
    expect(await p.copieAcceptee()).toBe(true);
  });

  test('numéros secrets Xaman : la vérification demande des séries', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.afficherMots('Numérique');
    await expect(page.locator('#titre-mots')).toHaveText('Écrivez ces 8 séries de chiffres à la main');
    await p.allerVerification();
    await expect(page.locator('#verifications-copie').getByText(/^Série n° \d$/)).toHaveCount(3);
  });

  test('Stellar : pas de numéros secrets Xaman', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XLM');
    await page.click('#aller-creer');
    await expect(page.locator('#format-xaman')).toBeHidden();
  });

  test('longueur libre : 15 mots de la liste officielle, restaurables vers la même adresse', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.afficherMots(15);
    const { mots, adresse } = await p.lire();
    expect(mots.split(' ')).toHaveLength(15);
    const liste = await p.listeBip39();
    for (const mot of mots.split(' ')) expect(liste).toContain(mot);

    await p.ouvrir('XRPL');
    await p.restaurerDepuisMots(mots);
    expect((await p.lire()).adresse).toBe(adresse);
    await expect(page.locator('#note-non-standard')).toBeVisible();
  });

  test('mot de passe : vide, faible ou différent bloquent l\'enregistrement', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.creer(12);
    expect(await p.jauge()).toEqual({ niveau: 'vide', texte: 'Saisissez un mot de passe.' });
    expect(await p.enregistrementPossible()).toBe(false);

    await p.saisirMotDePasse('azerty12');
    expect((await p.jauge()).niveau).toBe('faible');
    expect(await p.enregistrementPossible()).toBe(false);

    await p.saisirMotDePasse(SOLIDE, `${SOLIDE}x`);
    expect((await p.jauge()).niveau).toBe('solide');
    await expect(page.locator('#correspondance')).toHaveText('Les deux mots de passe sont différents.');
    expect(await p.enregistrementPossible()).toBe(false);

    await p.saisirMotDePasse(SOLIDE);
    expect(await p.enregistrementPossible()).toBe(true);
  });

  test('fichier wallet : nom conventionnel, chiffré, et utilisable pour signer à l\'étape 3', async ({ page, browser }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.restaurerDepuisMots(V.MOTS.abandon12);
    const fichier = await p.enregistrerFichier(SOLIDE);
    expect(fichier.nom).toBe('xrpl_rHsM-N5v3.xrplwallet');
    expect(JSON.parse(fichier.contenu).format).toBe('securedwallet/wallet-v2');
    expect(await p.bilan()).toEqual(['Wallet retrouvé à partir de vos mots', 'Fichier chiffré enregistré : xrpl_rHsM-N5v3.xrplwallet']);

    const posteHorsLigne = await browser.newContext();
    const s = new PiloteSigner(await posteHorsLigne.newPage());
    await s.ouvrir();
    await s.chargerTransaction(donnee('transactions/xrpl-paiement.tosign.json'));
    await s.signerAvecFichier(fichierTemporaire(fichier.nom, fichier.contenu), SOLIDE);
    expect(await s.lire()).toEqual(ATTENDU.xrplClePrincipale);
    await posteHorsLigne.close();
  });

  test('sans fichier : le bilan le dit, et la clé privée n\'est jamais affichée', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XLM');
    await p.restaurerDepuisMots(V.MOTS.sep5test1);
    await p.continuerSansFichier();
    expect(await p.bilan()).toContain('Pas de fichier wallet : vous signerez avec vos mots.');
    expect(await p.adresseFinale()).toBe(A.xlmSep5test1);
    // textContent : y compris le contenu caché (détails repliés).
    expect(await page.locator('body').textContent()).not.toContain(V.CLES.xlmSep5test1);
  });

  test('fichier d\'adresse publique : sans secret, lu tel quel par l\'étape 2', async ({ page, browser }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.restaurerDepuisMots(V.MOTS.abandon12);
    await p.continuerSansFichier();
    const fichier = await p.enregistrerAdressePublique();
    expect(fichier.nom).toBe('xrpl_rHsM-N5v3.adresse-publique.txt');
    expect(fichier.contenu).toBe(`${A.xrplAbandon12}\n`);

    const posteEnLigne = await browser.newContext();
    const preparer = new PilotePreparer(await posteEnLigne.newPage(), nouvelEtat({ xrplComptes: C.xrpl.standard }));
    await preparer.ouvrir('XRPL');
    await preparer.chargerFichierAdresse(fichier.contenu);
    expect(await preparer.adresseSaisie()).toBe(A.xrplAbandon12);
    await posteEnLigne.close();
  });

  test('« Terminer et effacer l\'écran » ne garde ni les mots ni l\'adresse', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.creer(12);
    await p.continuerSansFichier();
    await p.terminer();
    await expect(page.locator('#grille-mots li')).toHaveCount(0);
    await expect(page.locator('#contexte-compte')).toBeHidden();
    await expect(page.locator('#adresse-publique')).toBeEmpty();
  });
});

test.describe('Page 1 · nouvelle interface · restaurer et poste', () => {
  test('poste connecté : créer et restaurer bloqués, sauf dérogation explicite', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL', { enLigne: true });
    await expect(page.locator('#alarme')).toBeVisible();
    await expect(page.locator('#aller-creer')).toBeDisabled();
    await expect(page.locator('#aller-restaurer')).toBeDisabled();
    await page.check('#derogation');
    await expect(page.locator('#aller-creer')).toBeEnabled();
  });

  test('mot inconnu : position indiquée, correction proposée, restauration bloquée', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.allerRestaurer();
    await p.saisirMots(V.MOTS.abandon12.replace(/about$/, 'abuot'));
    await page.locator('#saisie-12').blur();
    expect(await p.erreurRestauration()).toBe('Mot n° 12 inconnu. Vouliez-vous dire « about » ?');
    expect(await p.restaurationPossible()).toBe(false);
    await page.fill('#saisie-12', 'about');
    expect(await p.restaurationPossible()).toBe(true);
  });

  test('coller les 24 mots dans la première case les répartit et ajuste la grille', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    await p.allerRestaurer();
    await p.collerMots(V.MOTS.abandon24);
    await expect(page.locator('#grille-saisie input')).toHaveCount(24);
    await page.click('#restaurer');
    await expect(page.locator('#vue-fichier')).toBeVisible();
    expect((await p.lire()).adresse).toBe(A.xrplAbandon24);
  });

  test('fichier wallet d\'une autre chaîne : refusé avec la chaîne à choisir', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    expect(await p.restaurerDepuisFichier(donnee('wallets/xlm-sep5test1.xlmwallet'), V.MOT_DE_PASSE)).toBe(false);
    expect(await p.erreurRestauration()).toContain('wallet Stellar');
  });

  test('ancien fichier wallet, en clair ou à l\'ancien chiffrement : refusé', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    const clair = JSON.stringify({ classicAddress: A.xrplAbandon12, seed: V.MOTS.abandon12 });
    expect(await p.restaurerDepuisFichier(fichierTemporaire('ancien.xrplwallet', clair), '')).toBe(false);
    expect(await p.erreurRestauration()).toContain('Mot de passe incorrect, ou fichier abîmé');
    await p.ouvrir('XRPL');
    expect(await p.restaurerDepuisFichier(donnee('wallets-ancien-format/xrpl-abandon12.xrplwallet'), V.MOT_DE_PASSE)).toBe(false);
    expect(await p.erreurRestauration()).toContain('Mot de passe incorrect, ou fichier abîmé');
  });

  test('mauvais mot de passe : le fichier reste choisi, seul le mot de passe est effacé', async ({ page }) => {
    const p = new PiloteCreer(page);
    await p.ouvrir('XRPL');
    expect(await p.restaurerDepuisFichier(donnee('wallets/xrpl-abandon12.xrplwallet'), 'pas-le-bon')).toBe(false);
    expect(await p.erreurRestauration()).toContain('Mot de passe incorrect');
    await expect(page.locator('#wallet-nom')).toHaveText('xrpl-abandon12.xrplwallet');
    await expect(page.locator('#mot-de-passe-wallet')).toHaveValue('');
    await page.fill('#mot-de-passe-wallet', V.MOT_DE_PASSE);
    await page.click('#restaurer');
    await expect(page.locator('#vue-fichier')).toBeVisible();
  });
});
