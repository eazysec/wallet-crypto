// Essai sur XRPL Testnet (fonds fictifs) : paiement de jeton quand l'émetteur prend des frais
// de transfert (F-12). Relève, pour chaque envoi, le plafond de débit (SendMax), le montant
// réellement débité et le résultat, afin de fixer le calcul de SendMax et le montant maximum.
//
// Usage : node tests/outils/essai-frais-emetteur.js
// Crée 3 comptes neufs par le distributeur de Testnet ; n'utilise aucun wallet existant.
// Le bundle ne se charge pas dans Node : le script tourne dans Chromium (Playwright).
const path = require('node:path');
const { chromium } = require('@playwright/test');

const bundle = path.join(__dirname, '../../commun/securewalletbundle-2.5.4.js');

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  page.on('console', (m) => console.log(m.text()));
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: path.join(__dirname, '../../commun/transactions.js') });

  const bilan = await page.evaluate(async () => {
    const { xrpl } = window.SecureWalletBundle;
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();
    const log = (...a) => console.log(...a);

    const [{ wallet: emetteur }, { wallet: alice }, { wallet: bob }] = await Promise.all([client.fundWallet(), client.fundWallet(), client.fundWallet()]);
    log('émetteur', emetteur.classicAddress, '· alice', alice.classicAddress, '· bob', bob.classicAddress);
    const soumettre = async (wallet, tx) => {
      const r = await client.submitAndWait(tx, { wallet, autofill: true });
      return r.result;
    };

    // Émetteur : rippling par défaut (sinon Alice → Bob est impossible) et 0,5 % de frais.
    await soumettre(emetteur, { TransactionType: 'AccountSet', Account: emetteur.classicAddress, SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple });
    await soumettre(emetteur, { TransactionType: 'AccountSet', Account: emetteur.classicAddress, TransferRate: 1005000000 });
    const info = await client.request({ command: 'account_info', account: emetteur.classicAddress, ledger_index: 'validated' });
    log('TransferRate lu :', info.result.account_data.TransferRate);

    const EUR = { currency: 'EUR', issuer: emetteur.classicAddress };
    for (const w of [alice, bob]) await soumettre(w, { TransactionType: 'TrustSet', Account: w.classicAddress, LimitAmount: { ...EUR, value: '1000000' } });
    await soumettre(emetteur, { TransactionType: 'Payment', Account: emetteur.classicAddress, Destination: alice.classicAddress, Amount: { ...EUR, value: '1000' } });

    const solde = async (w) => {
      const r = await client.request({ command: 'account_lines', account: w.classicAddress, ledger_index: 'validated' });
      return r.result.lines.find((l) => l.currency === 'EUR')?.balance ?? '0';
    };

    // [montant, SendMax (null = absent), livraison partielle]
    const cas = [
      ['100', null, false],                       // sans SendMax : doit échouer
      ['100', '100.5', false],                    // plafond exact
      ['33.333333333333', '33.4999999999999', false], // plafond juste en dessous de montant × 1,005
      ['33.333333333333', '33.5', false],         // plafond arrondi vers le haut
      ['10', '20', false],                        // plafond large : débit réel ?
      ['100', null, true],                        // ancien comportement : livraison partielle
      ['0.000000000000001', '0.000000000000002', false], // très petit montant
    ];
    const resultats = [];
    for (const [montant, sendMax, partiel] of cas) {
      const avantA = await solde(alice);
      const avantB = await solde(bob);
      const tx = { TransactionType: 'Payment', Account: alice.classicAddress, Destination: bob.classicAddress, Amount: { ...EUR, value: montant } };
      if (sendMax) tx.SendMax = { ...EUR, value: sendMax };
      if (partiel) tx.Flags = xrpl.PaymentFlags.tfPartialPayment;
      let resultat;
      try {
        const r = await soumettre(alice, tx);
        resultat = r.meta.TransactionResult;
      } catch (e) {
        resultat = 'erreur : ' + (e.data?.engine_result || e.message);
      }
      const apresA = await solde(alice);
      const apresB = await solde(bob);
      resultats.push({ montant, sendMax, partiel, resultat, debiteAlice: String(Number(avantA) - Number(apresA)), recuBob: String(Number(apresB) - Number(avantB)), soldeAlice: apresA });
    }

    // Calculs de l'application (commun/transactions.js) : SendMax = debitJeton, maximum = montantMaxJeton.
    const T = window.Commun.Transactions;
    for (const montant of ['100', '33.333333333333', '0.000001', '12345.678901234']) {
      const tx = { TransactionType: 'Payment', Account: alice.classicAddress, Destination: bob.classicAddress, Amount: { ...EUR, value: montant }, SendMax: { ...EUR, value: T.debitJeton(montant, 1005000000) } };
      let resultat;
      try {
        resultat = (await soumettre(alice, tx)).meta.TransactionResult;
      } catch (e) {
        resultat = 'erreur : ' + (e.data?.engine_result || e.message);
      }
      resultats.push({ montant, sendMax: tx.SendMax.value, partiel: 'application', resultat, soldeAlice: await solde(alice) });
    }
    const soldeAvantMax = await solde(alice);
    const maxApplication = T.montantMaxJeton(soldeAvantMax, 1005000000);
    {
      const tx = { TransactionType: 'Payment', Account: alice.classicAddress, Destination: bob.classicAddress, Amount: { ...EUR, value: maxApplication }, SendMax: { ...EUR, value: T.debitJeton(maxApplication, 1005000000) } };
      let resultat;
      try {
        resultat = (await soumettre(alice, tx)).meta.TransactionResult;
      } catch (e) {
        resultat = 'erreur : ' + (e.data?.engine_result || e.message);
      }
      resultats.push({ montant: maxApplication, sendMax: tx.SendMax.value, partiel: 'application · max', resultat, soldeAlice: await solde(alice) });
    }

    // Tout le solde restant d'Alice, avec le maximum théorique solde ÷ 1,005.
    const reste = await solde(alice);
    const max = (Number(reste) / 1.005).toPrecision(15);
    for (const montant of [max, (Number(max) * 0.999999999).toPrecision(15)]) {
      const tx = { TransactionType: 'Payment', Account: alice.classicAddress, Destination: bob.classicAddress, Amount: { ...EUR, value: montant }, SendMax: { ...EUR, value: reste } };
      let resultat;
      try {
        resultat = (await soumettre(alice, tx)).meta.TransactionResult;
      } catch (e) {
        resultat = 'erreur : ' + (e.data?.engine_result || e.message);
      }
      resultats.push({ montant, sendMax: reste, partiel: false, resultat, soldeAlice: await solde(alice) });
      if (resultat === 'tesSUCCESS') break;
    }

    await client.disconnect();
    return resultats;
  });

  console.table(bilan);
  await navigateur.close();
})();
