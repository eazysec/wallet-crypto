const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../commun/securite');

test('robustesse : mot de passe vide', () => {
  assert.deepEqual(S.robustesseMotDePasse(''), { bits: 0, niveau: 'vide', bloquant: true });
});

test('robustesse : trop faible, donc bloquant', () => {
  const r = S.robustesseMotDePasse('abc123');
  assert.equal(r.niveau, 'faible');
  assert.equal(r.bloquant, true);
});

test('robustesse : acceptable entre 60 et 80 bits', () => {
  const r = S.robustesseMotDePasse('Velours-1987'); // 12 caractères, 4 familles
  assert.equal(r.niveau, 'acceptable');
  assert.equal(r.bloquant, false);
});

test('robustesse : solide au-delà de 80 bits', () => {
  const r = S.robustesseMotDePasse('Lampe-Orage-Velours-1987!');
  assert.equal(r.niveau, 'solide');
  assert.equal(r.bloquant, false);
});

test('empreinteSha256 : vecteur de référence', async () => {
  assert.equal(await S.empreinteSha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
