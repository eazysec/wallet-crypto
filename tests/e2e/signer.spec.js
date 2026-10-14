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

// ---------- Nouvelle interface (lot 6) ----------

const fs = require('node:fs');
const { envelopperTransaction } = require('../../commun/fichiers');

const PAIEMENT_XRPL = JSON.parse(fs.readFileSync(TX_XRPL, 'utf8'));
const A = V.ADRESSES;

/** Fichier .a-signer.json tel que l'écrit l'étape 2. */
function aSigner(transaction = PAIEMENT_XRPL, { chaine = 'XRPL', reseau = 'test', autorises = [A.xrplAbandon12] } = {}) {
  return JSON.stringify(envelopperTransaction({ chaine, reseau, etape: 'a-signer', transaction, autorises }));
}

test.describe('Page 3 · nouvelle interface', () => {
  test('la transaction est montrée en clair avant toute clé', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    expect(await p.lireBordereau()).toMatchObject({ de: A.xrplAbandon12, vers: A.xrplAbandon24, tag: '104557', montant: '10', devise: 'XRP' });
    expect(await p.empreinte()).toMatch(/^[0-9A-F]{4,}/i);
  });

  // T-08 : rien dans une transaction XRPL ne distingue Mainnet de Testnet, et le champ « reseau »
  // du fichier n'est pas protégé. Hors ligne, la page n'affiche donc pas de réseau XRPL : une
  // étiquette « fonds fictifs » falsifiée endormirait la vigilance.
  for (const [libelle, contenu] of [['Testnet', () => aSigner()], ['Mainnet', () => aSigner(PAIEMENT_XRPL, { reseau: 'main' })], ['ancien format', () => TX_XRPL]]) {
    test(`XRPL ${libelle} : aucun réseau affiché, pas de bandeau Testnet`, async ({ page }) => {
      const p = new PiloteSigner(page);
      await p.ouvrir();
      await p.chargerTransaction(contenu());
      expect(await p.reseauAffiche()).toBe('XRPL');
      expect(await p.bordereauReseau()).toBe('XRPL');
      expect(await p.bandeauTestnet()).toBe(false);
      await expect(page.locator('#contexte-conseils')).not.toContainText('Mainnet', { useInnerText: true });
      await p.ouvrirAvecMots(V.MOTS.abandon12);
      await p.cleReconnue();
      await p.allerSignature();
      await expect(page.locator('#resume-signature')).not.toContainText(/Mainnet|Testnet/);
    });
  }

  test('Stellar Testnet : le réseau est garanti par la signature, il est affiché', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(TX_XLM);
    expect(await p.reseauAffiche()).toBe('Stellar Testnet · fonds fictifs');
    expect(await p.bordereauReseau()).toBe('Stellar Testnet · fonds fictifs');
    expect(await p.bandeauTestnet()).toBe(true);
  });

  test('poste connecté : clés et signature bloquées, sauf dérogation explicite', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir({ enLigne: true });
    expect(await p.alarmeReseau()).toBe(true);
    await p.chargerTransaction(aSigner());
    await p.choisirCle();
    expect(await p.ouvertureBloquee()).toBe(true);

    await p.accepterPosteConnecte();
    expect(await p.ouvertureBloquee()).toBe(false);
    await p.ouvrirAvecMots(V.MOTS.abandon12);
    await p.cleReconnue();
    await p.allerSignature();
    expect(await p.signaturePossible()).toBe(true);
  });

  test('le blocage se lève dès que le réseau est coupé', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir({ enLigne: true });
    await p.chargerTransaction(aSigner());
    await p.choisirCle();
    expect(await p.ouvertureBloquee()).toBe(true);
    await page.context().setOffline(true);
    await expect.poll(() => p.alarmeReseau()).toBe(false);
    expect(await p.ouvertureBloquee()).toBe(false);
  });

  test('type de transaction inconnu : signature refusée, contenu montré tel quel', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.deposer(aSigner({ ...PAIEMENT_XRPL, TransactionType: 'OfferCreate', TakerGets: '1', TakerPays: '1' }));
    expect(await p.erreurChargement()).toContain('Signature impossible');
    expect(await p.contenuRefuse()).toContain('OfferCreate');
    expect(await p.enVerification()).toBe(false);
  });

  test('champ inattendu dans un paiement : signature refusée', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.deposer(aSigner({ ...PAIEMENT_XRPL, SendMax: '99000000' }));
    expect(await p.erreurChargement()).toContain('champ inattendu : SendMax');
  });

  test('du HTML dans le fichier est affiché comme du texte, jamais interprété', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    const piege = '<img src=x onerror=window.pirate=1>';
    await p.deposer(aSigner({ ...PAIEMENT_XRPL, TransactionType: piege }));
    expect(await p.erreurChargement()).toContain(piege);
    expect(await p.contenuRefuse()).toContain(piege);
    expect(await page.evaluate(() => window.pirate)).toBeUndefined();
    expect(await page.locator('img').count()).toBe(0);
  });

  test('transaction déjà signée : renvoyée vers l\'étape 4', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.deposer(JSON.stringify(ATTENDU.xrplClePrincipale));
    expect(await p.erreurChargement()).toContain('déjà signée');
  });

  test('fichier wallet déposé à la place de la transaction : orienté vers « Choisir la clé »', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.deposer(donnee('wallets/xrpl-abandon12.xrplwallet'));
    expect(await p.erreurChargement()).toContain('Choisir la clé');
  });

  test('clé qui n\'est ni le compte ni un signataire autorisé : refusée', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.ouvrirAvecMots(V.MOTS.abandon24);
    expect(await p.erreurCle()).toContain('ne correspond ni au compte');
    await expect(page.locator('#vers-signature')).toBeDisabled();
  });

  test('clé principale désactivée : refusée, il faut la clé du signataire', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner(PAIEMENT_XRPL, { autorises: [A.xrplAbandon24] }));
    await p.ouvrirAvecMots(V.MOTS.abandon12);
    expect(await p.erreurCle()).toContain('clé principale de ce compte est désactivée');
  });

  test('signataire autorisé : reconnu, frais de multisignature annoncés puis appliqués, même empreinte', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner(PAIEMENT_XRPL, { autorises: [A.xrplAbandon12, A.xrplAbandon24] }));
    const avant = await p.empreinte();
    await p.ouvrirAvecMots(V.MOTS.abandon24);
    expect(await p.cleReconnue()).toContain('signataire autorisé rKxp');
    await p.allerSignature();
    expect(await p.noteFrais()).toContain('de 0,000012 à 0,000024 XRP');
    await p.maintenirSigner();
    expect(await p.lire()).toEqual(ATTENDU.xrplSignataire);
    // Les frais doublés ne changent pas l'empreinte : l'utilisateur retrouve celle de l'étape 2.
    expect(await p.empreinteSignee()).toBe(avant);
  });

  test('clé principale : pas de note de frais, empreinte identique avant et après signature', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    const avant = await p.empreinte();
    await p.ouvrirAvecMots(V.MOTS.abandon12);
    await p.cleReconnue();
    await p.allerSignature();
    expect(await p.noteFrais()).toBeNull();
    await p.maintenirSigner();
    expect(await p.empreinteSignee()).toBe(avant);
  });

  test('les mots sont retirés du champ dès que la clé est ouverte', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.ouvrirAvecMots(V.MOTS.abandon12);
    await p.cleReconnue();
    expect(await p.champsSecrets()).toEqual({ motDePasse: '', mots: '' });
  });

  test('mot de passe faux : message clair, mot de passe effacé, fichier wallet gardé', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.ouvrirAvecFichier(donnee('wallets/xrpl-abandon12.xrplwallet'), 'pas le bon');
    expect(await p.erreurCle()).toContain('Mot de passe incorrect');
    expect(await p.champsSecrets()).toEqual({ motDePasse: '', mots: '' });
    await expect(page.locator('#wallet-nom')).toHaveText('xrpl-abandon12.xrplwallet');

    await page.fill('#mot-de-passe', V.MOT_DE_PASSE);
    await page.click('#ouvrir-fichier');
    expect(await p.cleReconnue()).toContain('clé principale du compte rHsM');
    expect(await p.champsSecrets()).toEqual({ motDePasse: '', mots: '' });
  });

  test('mot mal orthographié : sa position est indiquée, sans afficher le mot', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.ouvrirAvecMots(V.MOTS.abandon12.replace('abandon about', 'abandon abuot'));
    const message = await p.erreurCle();
    expect(message).toContain('Le mot n° 12 n\'existe pas');
    expect(message).not.toContain('abuot');
  });

  test('fichier signé : nom conventionnel, enveloppe « signee » avec réseau et comptes autorisés', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.signerAvecMots(V.MOTS.abandon12);
    const fichier = await p.enregistrer();
    expect(fichier.nom).toBe(await p.nomPropose());
    expect(fichier.nom).toMatch(/^xrpl-test_\d{4}-\d\d-\d\d_paiement-10-xrp_[0-9a-f]{6}\.signee\.json$/);
    expect(JSON.parse(fichier.contenu)).toMatchObject({
      format: 'securedwallet/transaction-v1', chaine: 'XRPL', reseau: 'test', etape: 'signee',
      autorises: [A.xrplAbandon12], transaction: ATTENDU.xrplClePrincipale,
    });
  });

  test('« Terminer et effacer l\'écran » ramène au début sans rien garder', async ({ page }) => {
    const p = new PiloteSigner(page);
    await p.ouvrir();
    await p.chargerTransaction(aSigner());
    await p.signerAvecMots(V.MOTS.abandon12);
    await p.terminer();
    expect(await page.locator('#technique-contenu').textContent()).toBe('');
    expect(await p.reseauAffiche()).toBe('lu dans le fichier');
  });
});
