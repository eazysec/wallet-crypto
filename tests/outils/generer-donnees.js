// Génère les données de référence des tests à partir de la VERSION ACTUELLE des pages.
// À n'exécuter qu'une fois, avant la refonte : ces fichiers servent ensuite à vérifier
// que ce que produisait l'ancienne version reste lisible et signable.
//
// Usage : node tests/outils/generer-donnees.js
//
// Ce script pilote l'ANCIENNE interface : il ne fonctionne plus depuis la refonte. Il est
// gardé parce qu'il documente comment les fichiers de tests/donnees/ ont été produits.
// Pour le relancer, il faudrait revenir à l'ancienne page (étiquette git debut-refonte-ui,
// fichier OFFLINE_wallet/1.OFFLINE_wallet-generation.html) et adapter le chemin ci-dessous.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('@playwright/test');
const V = require('../donnees/vecteurs');

const racine = path.join(__dirname, '../..');
const sortie = path.join(__dirname, '../donnees');
const page1 = pathToFileURL(path.join(racine, 'hors-ligne/1-creer-wallet.html')).href;

async function surChaine(page, chaine) {
  await page.selectOption('#blockchain-select', chaine);
}

(async () => {
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ offline: true });
  const page = await contexte.newPage();
  await page.goto(page1);

  // Adresses XRPL relevées sur la version actuelle (caractérisation).
  await surChaine(page, 'XRPL');
  const xrpl12 = await page.evaluate(async (m) => (await NETWORK.recover(m)).classicAddress, V.MOTS.abandon12);
  const xrpl24 = await page.evaluate(async (m) => (await NETWORK.recover(m)).classicAddress, V.MOTS.abandon24);
  console.log('XRPL 12 mots :', xrpl12);
  console.log('XRPL 24 mots :', xrpl24);

  // Fichiers wallet chiffrés exactement comme le fait _offline_.saveWallet.
  fs.mkdirSync(path.join(sortie, 'wallets'), { recursive: true });
  const xrplWallet = await page.evaluate(async ({ m, p }) => {
    const w = await NETWORK.recover(m);
    return { nom: w.classicAddress + NETWORK.walletExtension, contenu: await woff_encrypt(JSON.stringify(w), p) };
  }, { m: V.MOTS.abandon12, p: V.MOT_DE_PASSE });
  fs.writeFileSync(path.join(sortie, 'wallets/xrpl-abandon12.xrplwallet'), xrplWallet.contenu);

  await surChaine(page, 'XLM');
  const xlmWallet = await page.evaluate(async ({ m, p }) => {
    const w = await NETWORK.recover(m);
    return { adresse: w.classicAddress, contenu: await woff_encrypt(JSON.stringify(w), p) };
  }, { m: V.MOTS.sep5test1, p: V.MOT_DE_PASSE });
  fs.writeFileSync(path.join(sortie, 'wallets/xlm-sep5test1.xlmwallet'), xlmWallet.contenu);
  console.log('XLM SEP-0005 test 1 :', xlmWallet.adresse);

  // Transactions à signer, au format produit par l'étape 2.
  fs.mkdirSync(path.join(sortie, 'transactions'), { recursive: true });
  const xrplTx = {
    TransactionType: 'Payment',
    Account: xrpl12,
    Destination: xrpl24,
    DestinationTag: 104557,
    Amount: '10000000',
    Fee: '12',
    Sequence: 1000,
    LastLedgerSequence: 2000,
    Flags: 0,
  };
  fs.writeFileSync(path.join(sortie, 'transactions/xrpl-paiement.tosign.json'), JSON.stringify(xrplTx, null, 3));

  const xlmTx = await page.evaluate(({ source, destination }) => {
    const { StellarSdk } = SecureWalletBundle;
    const compte = new StellarSdk.Account(source, '123456789');
    const reseau = StellarSdk.Networks.TESTNET;
    const tx = new StellarSdk.TransactionBuilder(compte, { fee: '100', networkPassphrase: reseau, timebounds: { minTime: 0, maxTime: 1893456000 } })
      .addOperation(StellarSdk.Operation.payment({ destination, asset: StellarSdk.Asset.native(), amount: '10' }))
      .addMemo(StellarSdk.Memo.text('104557'))
      .build();
    return { XDR: tx.toXDR(), Network: reseau };
  }, { source: V.ADRESSES.xlmSep5test1, destination: V.ADRESSES.xlmSep5test3 });
  fs.writeFileSync(path.join(sortie, 'transactions/xlm-paiement.tosign.json'), JSON.stringify(xlmTx, null, 3));

  await navigateur.close();
})();
