const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../commun/reseau');

test('durée de validité : 15 minutes pour les deux chaînes', () => {
  assert.equal(R.DUREE_VALIDITE_SECONDES, 900);
});

test('registresPourDuree : 4 secondes par registre XRPL, arrondi au-dessus', () => {
  assert.equal(R.registresPourDuree(900), 225);
  assert.equal(R.registresPourDuree(901), 226);
});

test('expliquerRefus : délai dépassé, sur les deux chaînes', () => {
  for (const code of ['tefMAX_LEDGER', 'tx_too_late']) {
    const r = R.expliquerRefus(code);
    assert.equal(r.raison, 'Le délai de validité est dépassé.');
    assert.match(r.conseil, /étape 2/);
    assert.equal(r.fraisPreleves, false);
  }
});

test('expliquerRefus : fonds insuffisants, frais prélevés quand la transaction est entrée au registre', () => {
  assert.equal(R.expliquerRefus('tecUNFUNDED_PAYMENT').raison, 'Fonds insuffisants sur le compte.');
  assert.equal(R.expliquerRefus('tecUNFUNDED_PAYMENT').fraisPreleves, true);
  assert.equal(R.expliquerRefus('op_underfunded').raison, 'Fonds insuffisants sur le compte.');
  assert.equal(R.expliquerRefus('op_underfunded').fraisPreleves, true);
});

test('expliquerRefus : code inconnu, le code reste visible', () => {
  const r = R.expliquerRefus('tecFOO');
  assert.equal(r.raison, 'Le réseau a refusé la transaction (code tecFOO).');
  assert.equal(r.fraisPreleves, true);
  assert.ok(r.conseil.length > 0);
});

test('estReussite', () => {
  assert.equal(R.estReussite('tesSUCCESS'), true);
  assert.equal(R.estReussite('tecUNFUNDED_PAYMENT'), false);
  assert.equal(R.estReussite(undefined), false);
});
