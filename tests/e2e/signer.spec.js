// @ts-check
// Page 3 · invariants : ils doivent rester vrais avant et après la refonte.
// Les signatures XRPL (secp256k1, RFC 6979) et Stellar (ed25519) sont déterministes :
// une même transaction signée par une même clé donne toujours le même résultat.
const { test, expect } = require('@playwright/test');
const { PiloteSigner } = require('./pilotes/signer');
const { donnee } = require('./outils');
const V = require('../donnees/vecteurs');
const ATTENDU = require('../donnees/attendus');

const TX_XRPL = donnee('transactions/xrpl-paiement.tosign.json');
const TX_XLM = donnee('transactions/xlm-paiement.tosign.json');

function decoderXrpl(page, blob) {
  return page.evaluate((b) => SecureWalletBundle.xrpl.decode(b), blob);
}

function verifierXlm(page, signee, clePublique) {
  return page.evaluate(({ s, cle }) => {
    const { StellarSdk } = SecureWalletBundle;
    const tx = StellarSdk.TransactionBuilder.fromXDR(s.XDR, s.Network);
    const paire = StellarSdk.Keypair.fromPublicKey(cle);
    return tx.signatures.length === 1 && paire.verify(tx.hash(), tx.signatures[0].signature());
  }, { s: signee, cle: clePublique });
}

test.describe('Page 3 · signer une transaction XRPL', () => {
  test('avec les mots : résultat attendu et contenu inchangé', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XRPL, 'XRPL');
    await p.signerAvecMots(V.MOTS.abandon12);
    const signee = await p.lire();

    expect(signee).toEqual(ATTENDU.xrplClePrincipale);
    const tx = await decoderXrpl(page, signee.tx_blob);
    expect(tx).toMatchObject({
      TransactionType: 'Payment',
      Account: V.ADRESSES.xrplAbandon12,
      Destination: V.ADRESSES.xrplAbandon24,
      DestinationTag: 104557,
      Amount: '10000000',
      Fee: '12',
      Sequence: 1000,
      LastLedgerSequence: 2000,
    });
    expect(tx.TxnSignature).toBeTruthy();
  });

  test('avec le fichier wallet chiffré : même résultat qu\'avec les mots', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XRPL, 'XRPL');
    await p.signerAvecFichier(donnee('wallets/xrpl-abandon12.xrplwallet'), V.MOT_DE_PASSE);
    expect(await p.lire()).toEqual(ATTENDU.xrplClePrincipale);
  });

  test('avec une autre clé : signature de signataire, frais doublés', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XRPL, 'XRPL');
    await p.signerAvecMots(V.MOTS.abandon24);
    const signee = await p.lire();

    expect(signee).toEqual(ATTENDU.xrplSignataire);
    const tx = await decoderXrpl(page, signee.tx_blob);
    expect(tx.Fee).toBe('24');
    expect(tx.SigningPubKey).toBe('');
    expect(tx.Signers).toHaveLength(1);
    expect(tx.Signers[0].Signer.Account).toBe(V.ADRESSES.xrplAbandon24);
  });

  test('le fichier enregistré contient la transaction signée affichée', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XRPL, 'XRPL');
    await p.signerAvecMots(V.MOTS.abandon12);
    const fichier = await p.enregistrer();
    expect(JSON.parse(fichier.contenu)).toEqual(await p.lire());
  });
});

test.describe('Page 3 · signer une transaction Stellar', () => {
  test('avec les mots : résultat attendu et signature valide', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XLM, 'XLM');
    await p.signerAvecMots(V.MOTS.sep5test1);
    const signee = await p.lire();

    expect(signee).toEqual(ATTENDU.xlmSimple);
    expect(await verifierXlm(page, signee, V.ADRESSES.xlmSep5test1)).toBe(true);
  });

  test('avec le fichier wallet chiffré : même résultat qu\'avec les mots', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XLM, 'XLM');
    await p.signerAvecFichier(donnee('wallets/xlm-sep5test1.xlmwallet'), V.MOT_DE_PASSE);
    expect(await p.lire()).toEqual(ATTENDU.xlmSimple);
  });
});
