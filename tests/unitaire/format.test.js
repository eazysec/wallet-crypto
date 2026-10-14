const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../commun/format');

// Espace insécable ordinaire : l'espace fine (U+202F) ne fait que 2 px dans la police de texte,
// les milliers n'étaient plus visibles.
const FINE = '\u00a0';

test('groupesAdresse découpe par blocs de 4', () => {
  assert.deepEqual(F.groupesAdresse('rKt4WzP9bC7hN3qMvX8sJd2FgE6yRa5uTo'),
    ['rKt4', 'WzP9', 'bC7h', 'N3qM', 'vX8s', 'Jd2F', 'gE6y', 'Ra5u', 'To']);
});

test('groupesAdresse ignore les espaces autour et accepte une chaîne vide', () => {
  assert.deepEqual(F.groupesAdresse('  rKt4WzP9 '), ['rKt4', 'WzP9']);
  assert.deepEqual(F.groupesAdresse(''), []);
});

test('groupesAdresse couvre une adresse Stellar de 56 caractères', () => {
  const groupes = F.groupesAdresse('GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6');
  assert.equal(groupes.length, 14);
  assert.equal(groupes.join(''), 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6');
});

test('formaterMontant applique les conventions françaises', () => {
  assert.equal(F.formaterMontant('1250'), `1${FINE}250`);
  assert.equal(F.formaterMontant('0.000012'), '0,000012');
  assert.equal(F.formaterMontant('1250000.5'), `1${FINE}250${FINE}000,5`);
  assert.equal(F.formaterMontant('25'), '25');
  assert.equal(F.formaterMontant('0'), '0');
});

test('formaterMontant retire les zéros inutiles (montants Stellar à 7 décimales)', () => {
  assert.equal(F.formaterMontant('10.0000000'), '10');
  assert.equal(F.formaterMontant('1741.3000000'), `1${FINE}741,3`);
});

test('formaterMontant travaille sur le texte, sans erreur d\'arrondi', () => {
  assert.equal(F.formaterMontant('0.1000001'), '0,1000001');
  assert.equal(F.formaterMontant(12), '12');
});

test('formaterMontant refuse ce qui n\'est pas un montant', () => {
  assert.throws(() => F.formaterMontant('abc'), RangeError);
  assert.throws(() => F.formaterMontant('-5'), RangeError);
  assert.throws(() => F.formaterMontant('1,5'), RangeError);
});

test('formaterEmpreinte garde 12 caractères en majuscules, par blocs de 4', () => {
  assert.equal(F.formaterEmpreinte('7f3a91c20b6e5d48aabbccdd'), '7F3A 91C2 0B6E');
});

test('prefixeEmpreinte donne les 6 premiers caractères, en minuscules', () => {
  assert.equal(F.prefixeEmpreinte('7F3A91C20B6E5D48'), '7f3a91');
});

test('formaterDuree affiche minutes et secondes', () => {
  assert.equal(F.formaterDuree(700000), '11 min 40 s');
  assert.equal(F.formaterDuree(665000), '11 min 05 s');
  assert.equal(F.formaterDuree(59000), '59 s');
  assert.equal(F.formaterDuree(0), '0 s');
  assert.equal(F.formaterDuree(-3000), '0 s');
});

test('formaterDuree passe aux heures puis aux jours pour les longues échéances', () => {
  assert.equal(F.formaterDuree((3 * 3600 + 5 * 60 + 12) * 1000), '3 h 05 min');
  assert.equal(F.formaterDuree(50 * 3600 * 1000), '2 j 2 h');
  assert.equal(F.formaterDuree(3600 * 1000), '1 h 00 min');
});

test('formaterDuree approximative : en minutes, précédée de « environ »', () => {
  assert.equal(F.formaterDuree(900000, { approximatif: true }), 'environ 15 min');
  assert.equal(F.formaterDuree(665000, { approximatif: true }), 'environ 11 min');
  assert.equal(F.formaterDuree(3725000, { approximatif: true }), 'environ 1 h 02 min');
  assert.equal(F.formaterDuree(45000, { approximatif: true }), "moins d'une minute");
});

test('formaterHeure suit l\'usage français', () => {
  assert.equal(F.formaterHeure(new Date(2026, 9, 14, 10, 47)), '10 h 47');
  assert.equal(F.formaterHeure(new Date(2026, 9, 14, 9, 5)), '9 h 05');
});
