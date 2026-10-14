// @ts-check
// Page 4 · invariants : récapitulatif avant envoi et transaction réellement envoyée.
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { PiloteEnvoyer } = require('./pilotes/envoyer');
const { nouvelEtat } = require('./reseau');
const { ADRESSES: A, CLES } = require('../donnees/vecteurs');
const { donnee } = require('./outils');
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

  // Correction de T-01 : l'ancienne version annonçait « Transaction réussie » avec un code vide.
  test('XRPL · un rejet du réseau est présenté comme un refus, raison et code affichés', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: AVANT_EXPIRATION, resultat: 'tecUNFUNDED_PAYMENT' });
    const resultat = await p.envoyer();
    expect(resultat.reussi).toBe(false);
    expect(resultat.detail).toContain('Fonds insuffisants');
    expect(resultat.detail).toContain('tecUNFUNDED_PAYMENT');
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

test.describe('Page 4 · nouvelle interface', () => {
  // Correction de T-04 : l'ancienne version envoyait vers le mainnet par défaut.
  test('XRPL · le réseau n\'est jamais choisi par défaut', async ({ page }) => {
    const p = new PiloteEnvoyer(page, nouvelEtat({ registre: AVANT_EXPIRATION }));
    await p.ouvrir();
    await p.chargerContenu(JSON.stringify(ATTENDU.xrplClePrincipale), 'transaction.signee.json');
    expect(await p.demandeReseau()).toBe(true);
    expect(await p.envoiPossible()).toBe(false);
    await p.choisirReseau('test');
    expect(await p.envoiPossible()).toBe(true);
    expect(await p.reseauAffiche()).toContain('XRPL Testnet');
  });

  test('Stellar · le réseau est lu dans le fichier, le testnet est signalé', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM');
    expect(await p.demandeReseau()).toBe(false);
    expect(await p.reseauAffiche()).toContain('Stellar Testnet');
    expect(await p.bandeauTestnet()).toBe(true);
  });

  test('une transaction non signée est refusée, avec la marche à suivre', async ({ page }) => {
    const p = new PiloteEnvoyer(page, nouvelEtat());
    await p.ouvrir();
    await p.chargerContenu(fs.readFileSync(donnee('transactions/xrpl-paiement.tosign.json'), 'utf8'), 'transaction.a-signer.json');
    expect(await p.erreurChargement()).toContain('pas signée');
  });

  test('un fichier qui n\'est pas une transaction est refusé', async ({ page }) => {
    const p = new PiloteEnvoyer(page, nouvelEtat());
    await p.ouvrir();
    await p.chargerContenu(fs.readFileSync(donnee('wallets/xrpl-abandon12.xrplwallet'), 'utf8'), 'xrpl-abandon12.xrplwallet');
    expect(await p.erreurChargement()).toContain('pas une transaction');
  });

  test('le délai de validité est affiché', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM');
    expect(await p.delaiAffiche()).toMatch(/^Valable encore \d/);
  });

  test('XRPL · le délai, estimé d\'après les registres, est donné en minutes avec « environ »', async ({ page }) => {
    const { p } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: 1800 });
    expect(await p.delaiAffiche()).toBe('Valable encore environ 13 min');
  });

  test('XRPL · délai dépassé : l\'envoi est bloqué avant de partir, avec l\'explication', async ({ page }) => {
    const { p, etat } = await ouvrirAvec(page, ATTENDU.xrplClePrincipale, 'XRPL', { registre: APRES_EXPIRATION });
    expect(await p.envoiPossible()).toBe(false);
    expect(await p.messageVerification()).toContain('délai de validité est dépassé');
    expect(etat.xrpl.soumises).toEqual([]);
  });

  // Correction de T-05 : l'ancienne version insérait le mémo en HTML.
  test('un mémo piégé s\'affiche comme du texte et n\'est jamais exécuté', async ({ page }) => {
    const p = new PiloteEnvoyer(page, nouvelEtat());
    await p.ouvrir();
    const piege = '<img src=x onerror=top.p=1>';
    const signee = await page.evaluate(({ secret, destination, memo }) => {
      const { StellarSdk } = SecureWalletBundle;
      const paire = StellarSdk.Keypair.fromSecret(secret);
      const compte = new StellarSdk.Account(paire.publicKey(), '1');
      const tx = new StellarSdk.TransactionBuilder(compte, { fee: '100', networkPassphrase: StellarSdk.Networks.TESTNET, timebounds: { minTime: 0, maxTime: 1893456000 } })
        .addOperation(StellarSdk.Operation.payment({ destination, asset: StellarSdk.Asset.native(), amount: '1' }))
        .addMemo(StellarSdk.Memo.text(memo))
        .build();
      tx.sign(paire);
      return { XDR: tx.toXDR(), Network: StellarSdk.Networks.TESTNET };
    }, { secret: CLES.xlmSep5test1, destination: A.xlmSep5test3, memo: piege });
    await p.chargerTransactionSignee(signee, 'XLM');
    expect((await p.lireRecapitulatif()).tag).toBe(piege);
    expect(await page.evaluate(() => window.p)).toBeUndefined();
  });

  test('une transaction à plusieurs opérations est refusée : rien ne doit rester caché', async ({ page }) => {
    const p = new PiloteEnvoyer(page, nouvelEtat());
    await p.ouvrir();
    const signee = await page.evaluate(({ secret, destination }) => {
      const { StellarSdk } = SecureWalletBundle;
      const paire = StellarSdk.Keypair.fromSecret(secret);
      const compte = new StellarSdk.Account(paire.publicKey(), '1');
      const tx = new StellarSdk.TransactionBuilder(compte, { fee: '200', networkPassphrase: StellarSdk.Networks.TESTNET, timebounds: { minTime: 0, maxTime: 1893456000 } })
        .addOperation(StellarSdk.Operation.payment({ destination, asset: StellarSdk.Asset.native(), amount: '1' }))
        .addOperation(StellarSdk.Operation.payment({ destination, asset: StellarSdk.Asset.native(), amount: '900' }))
        .build();
      tx.sign(paire);
      return { XDR: tx.toXDR(), Network: StellarSdk.Networks.TESTNET };
    }, { secret: CLES.xlmSep5test1, destination: A.xlmSep5test3 });
    await p.chargerContenu(JSON.stringify(signee), 'transaction.signee.json');
    expect(await p.erreurChargement()).toContain('ne sait pas traduire');
  });

  test('aucune requête ne sort vers internet', async ({ page }) => {
    const { p, etat } = await ouvrirAvec(page, ATTENDU.xlmSimple, 'XLM');
    await p.envoyer();
    expect(etat.bloquees).toEqual([]);
  });
});
