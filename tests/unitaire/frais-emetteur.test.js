// F-12 : paiement de jeton XRPL quand l'émetteur prend des frais de transfert.
// Valeurs de référence relevées sur XRPL Testnet (tests/outils/essai-frais-emetteur.js, 2026-10-16) :
// avec TransferRate 1005000000 (0,5 %), 100 envoyés coûtent 100,5 ; sans SendMax, le paiement échoue ;
// envoyer « solde ÷ 1,005 » arrondi au plus proche échoue, une valeur un peu inférieure passe.
const { test } = require('node:test');
const assert = require('node:assert/strict');

globalThis.SecureWalletBundle = globalThis.SecureWalletBundle || {};
const T = require('../../commun/transactions');

const DEMI_POURCENT = 1005000000;
const ALICE = 'rawuQCMvjtvTMG5GJmRVhJpgr12ow2yqDN';
const BOB = 'rDfDC1hvBwnFD64sWHcM3wvd7riQnwJ4or';
const EMETTEUR = 'rBQPrJYM5BJjV6sPbEUpkVpbZRaP5fCcY9';
const EUR = (value) => ({ currency: 'EUR', issuer: EMETTEUR, value });
const paiement = (champs) => ({
  TransactionType: 'Payment', Account: ALICE, Destination: BOB, Amount: EUR('100'),
  Fee: '12', Sequence: 1, LastLedgerSequence: 100, ...champs,
});

test('tauxFraisEmetteur : pourcentage lisible, ou null sans frais', () => {
  assert.equal(T.tauxFraisEmetteur(undefined), null);
  assert.equal(T.tauxFraisEmetteur(0), null);
  assert.equal(T.tauxFraisEmetteur(1000000000), null);
  assert.equal(T.tauxFraisEmetteur(DEMI_POURCENT), '0.5');
  assert.equal(T.tauxFraisEmetteur(1002000000), '0.2');
  assert.equal(T.tauxFraisEmetteur(2000000000), '100');
  assert.equal(T.tauxFraisEmetteur(1000000001), '0.0000001');
});

test('debitJeton : montant × taux, arrondi vers le haut à 15 chiffres significatifs', () => {
  assert.equal(T.debitJeton('100', DEMI_POURCENT), '100.5');
  assert.equal(T.debitJeton('10', DEMI_POURCENT), '10.05');
  assert.equal(T.debitJeton('33.333333333333', DEMI_POURCENT), '33.4999999999997');
  assert.equal(T.debitJeton('0.000001', DEMI_POURCENT), '0.000001005');
  assert.equal(T.debitJeton('100', undefined), '100');
});

test('montantMaxJeton : solde ÷ taux, arrondi vers le bas à 6 décimales', () => {
  assert.equal(T.montantMaxJeton('100', DEMI_POURCENT), '99.502487');
  // Relevé sur Testnet : 718.855721393036 échouait, 718.855720674180 passait.
  assert.equal(T.montantMaxJeton('722.4500000000006', DEMI_POURCENT), '718.855721');
  assert.ok(BigInt(T.debitJeton(T.montantMaxJeton('722.4500000000006', DEMI_POURCENT), DEMI_POURCENT).replace('.', '').padEnd(20, '0'))
    <= BigInt('722.4500000000006'.replace('.', '').padEnd(20, '0')));
  assert.equal(T.montantMaxJeton('250', undefined), '250');
  assert.equal(T.montantMaxJeton('0.0000001', DEMI_POURCENT), '0');
});

test('les montants en notation scientifique, renvoyés par le nœud pour les très petites valeurs, sont compris', () => {
  assert.equal(T.montantMaxJeton('7.224497e-7', undefined), '7.224497e-7');
  assert.equal(T.debitJeton('1e-6', DEMI_POURCENT), '0.000001005');
});

test('décodage : SendMax du même jeton → débit et frais de l\'émetteur affichables', () => {
  const d = T.decoder('XRPL', paiement({ SendMax: EUR('100.5') }));
  assert.equal(d.operation, 'paiement');
  assert.equal(d.montant, '100');
  assert.equal(d.debit, '100.5');
  assert.equal(d.fraisEmetteur, '0.5');
});

test('décodage : sans SendMax, ni débit ni frais d\'émetteur', () => {
  const d = T.decoder('XRPL', paiement({}));
  assert.equal(d.operation, 'paiement');
  assert.equal(d.debit, null);
  assert.equal(d.fraisEmetteur, null);
});

test('décodage : livraison partielle refusée (F-12)', () => {
  const d = T.decoder('XRPL', paiement({ Flags: 0x00020000 }));
  assert.equal(d.operation, 'inconnue');
  assert.match(d.raison, /livraison partielle/);
});

test('décodage : autre option de paiement refusée, option de signature canonique acceptée', () => {
  for (const Flags of [0x00010000, 0x00040000]) assert.equal(T.decoder('XRPL', paiement({ Flags })).operation, 'inconnue');
  assert.equal(T.decoder('XRPL', paiement({ Flags: 0x80000000 })).operation, 'paiement');
  assert.equal(T.decoder('XRPL', paiement({ Flags: 0 })).operation, 'paiement');
});

test('décodage : SendMax incohérent refusé (autre jeton, autre émetteur, inférieur au montant, ou paiement en XRP)', () => {
  const cas = [
    paiement({ SendMax: { ...EUR('101'), currency: 'USD' } }),
    paiement({ SendMax: { ...EUR('101'), issuer: BOB } }),
    paiement({ SendMax: EUR('99') }),
    paiement({ Amount: '1000000', SendMax: '2000000' }),
    paiement({ SendMax: '2000000' }),
  ];
  for (const tx of cas) assert.equal(T.decoder('XRPL', tx).operation, 'inconnue', JSON.stringify(tx.SendMax));
});
