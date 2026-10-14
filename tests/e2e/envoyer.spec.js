// @ts-check
// Page 4 · invariants : récapitulatif avant envoi et transaction réellement envoyée.
const { test, expect } = require('@playwright/test');
const { PiloteEnvoyer } = require('./pilotes/envoyer');
const { nouvelEtat } = require('./reseau');
const { ADRESSES: A } = require('../donnees/vecteurs');
const ATTENDU = require('../donnees/attendus');

// Les transactions signées de référence expirent au registre 2000 (LastLedgerSequence).
const AVANT_EXPIRATION = 1500;
const APRES_EXPIRATION = 2500;

async function ouvrirAvec(page, signee, chaine, options) {
  const etat = nouvelEtat(options);
  const p = new PiloteEnvoyer(page, etat);
  await p.ouvrir();
  await p.chargerTransactionSignee(signee, chaine);
  return { p, etat };
}

test.describe('Page 4 · récapitulatif avant envoi', () => {
  test('XRPL · paiement signé par la clé principale', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL');
    expect(await p.lireRecapitulatif()).toEqual({
      de: A.xrplAbandon12, vers: A.xrplAbandon24, tag: '104557',
      montant: '10', devise: 'XRP', frais: '0.000012', multisignature: false,
    });
  });

  test('XRPL · paiement signé par un signataire', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xrplSignataire, 'XRPL');
    expect(await p.lireRecapitulatif()).toEqual({
      de: A.xrplAbandon12, vers: A.xrplAbandon24, tag: '104557',
      montant: '10', devise: 'XRP', frais: '0.000024', multisignature: true,
    });
  });

  test('XLM · paiement', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM');
    expect(await p.lireRecapitulatif()).toEqual({
      de: A.xlmSep5test1, vers: A.xlmSep5test3, tag: '104557',
      montant: '10', devise: 'XLM', frais: '0.00001', multisignature: false,
    });
  });
});

test.describe('Page 4 · envoi', () => {
  test('XRPL · accepté : la transaction envoyée est celle qui a été signée', async ({ page }) => {
    const { p, etat } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: AVANT_EXPIRATION });
    expect((await p.envoyer()).reussi).toBe(true);
    expect(etat.xrpl.soumises).toEqual([ATTENDU.xrplClePrincipale.tx_blob]);
  });

  test('XRPL · refusé quand le délai de validité est dépassé', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: APRES_EXPIRATION });
    expect((await p.envoyer()).reussi).toBe(false);
  });

  // Bug de la version actuelle : la page annonce « Transaction réussie » et le code reste vide,
  // car le script écrit dans un <b> absent (le HTML contient un <strong>).
  // Quand la refonte l'aura corrigé, ce test passera : retirer alors test.fail.
  test('XRPL · le code de résultat du réseau est affiché', async ({ page }) => {
    test.fail(true, 'Bug existant : code tec non affiché, transaction annoncée comme réussie');
    const { p } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: AVANT_EXPIRATION, resultat: 'tecUNFUNDED_PAYMENT' });
    expect((await p.envoyer()).detail).toContain('tecUNFUNDED_PAYMENT');
  });

  test('XLM · accepté : la transaction envoyée est celle qui a été signée', async ({ page }) => {
    const { p, etat } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM');
    expect((await p.envoyer()).reussi).toBe(true);
    expect(etat.xlm.soumises).toEqual([ATTENDU.xlmSimple.XDR]);
  });

  test('XLM · refusé par le réseau : la raison est affichée', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM', { refus: 'tx_too_late' });
    const resultat = await p.envoyer();
    expect(resultat.reussi).toBe(false);
    expect(resultat.detail).toContain('tx_too_late');
  });
});
