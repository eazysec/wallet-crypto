const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../commun/transactions');
const { OPERATIONS } = require('../../commun/fichiers');

test('dropsEnXrp : conversion exacte, sans calcul en virgule flottante', () => {
  assert.equal(T.dropsEnXrp('10000000'), '10');
  assert.equal(T.dropsEnXrp('1250000000'), '1250');
  assert.equal(T.dropsEnXrp('12'), '0.000012');
  assert.equal(T.dropsEnXrp('1'), '0.000001');
  assert.equal(T.dropsEnXrp('1500001'), '1.500001');
  assert.equal(T.dropsEnXrp('0'), '0');
  assert.throws(() => T.dropsEnXrp('1.5'), RangeError);
});

test('stroopsEnXlm : 1 XLM = 10 000 000 stroops', () => {
  assert.equal(T.stroopsEnXlm('100'), '0.00001');
  assert.equal(T.stroopsEnXlm('10000000'), '1');
  assert.equal(T.stroopsEnXlm(200), '0.00002');
});

test('montantStellar retire les zéros inutiles', () => {
  assert.equal(T.montantStellar('10.0000000'), '10');
  assert.equal(T.montantStellar('25.5000000'), '25.5');
  assert.equal(T.montantStellar('0.0000000'), '0');
});

test('deviseLisible : code court, code long en hexadécimal, sans altérer la casse', () => {
  assert.equal(T.deviseLisible('USD'), 'USD');
  assert.equal(T.deviseLisible('534F4C4F00000000000000000000000000000000'), 'SOLO');
  assert.equal(T.deviseLisible('736F6C6F00000000000000000000000000000000'), 'solo');
});

test('deviseLisible : les caractères non imprimables sont retirés', () => {
  assert.equal(T.deviseLisible('41000A0D4200000000000000000000000000000000'.slice(0, 40)), 'AB');
});

test('un libellé en français existe pour chaque opération', () => {
  for (const operation of OPERATIONS) assert.ok(T.LIBELLES[operation], operation);
});

test('versionMultisignature (XRPL) : frais doublés, transaction d\'origine intacte', () => {
  const tx = { TransactionType: 'Payment', Account: 'rA', Fee: '12', Sequence: 5 };
  assert.deepEqual(T.versionMultisignature(tx), { ...tx, Fee: '24' });
  assert.equal(tx.Fee, '12');
  assert.equal(T.versionMultisignature({ Fee: '9007199254740993' }).Fee, '18014398509481986');
});
