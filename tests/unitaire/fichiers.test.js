const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../commun/fichiers');

const XRPL = 'rLp8x2Q4mVZsE3fJ9uKc6TyWb7HdRgA5Nn';
const XLM = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';

test('nomFichierTransaction suit la convention', () => {
  assert.equal(F.nomFichierTransaction({
    chaine: 'XRPL', reseau: 'main', date: new Date(2026, 9, 14), operation: 'paiement',
    details: ['1250', 'XRP'], empreinte: '7f3a91c20b6e', etape: 'a-signer',
  }), 'xrpl-main_2026-10-14_paiement-1250-xrp_7f3a91.a-signer.json');
});

test('nomFichierTransaction : Stellar, testnet, transaction signée', () => {
  assert.equal(F.nomFichierTransaction({
    chaine: 'XLM', reseau: 'test', date: new Date(2026, 0, 5), operation: 'jeton-ajout',
    details: ['USD'], empreinte: 'C41E07A9D3B2', etape: 'signee',
  }), 'xlm-test_2026-01-05_jeton-ajout-usd_c41e07.signee.json');
});

test('nomFichierTransaction : décimales et caractères accentués', () => {
  assert.equal(F.nomFichierTransaction({
    chaine: 'XRPL', reseau: 'main', date: new Date(2026, 9, 14), operation: 'paiement',
    details: ['0.5', 'Éé'], empreinte: 'abcdef', etape: 'a-signer',
  }), 'xrpl-main_2026-10-14_paiement-0,5-ee_abcdef.a-signer.json');
});

test('nomFichierTransaction refuse une opération ou une étape inconnue', () => {
  const base = { chaine: 'XRPL', reseau: 'main', date: new Date(), details: [], empreinte: 'abcdef' };
  assert.throws(() => F.nomFichierTransaction({ ...base, operation: 'virement', etape: 'a-signer' }), RangeError);
  assert.throws(() => F.nomFichierTransaction({ ...base, operation: 'paiement', etape: 'brouillon' }), RangeError);
});

test('nomFichierWallet garde les 4 premiers et 4 derniers caractères de l\'adresse', () => {
  assert.equal(F.nomFichierWallet('XRPL', XRPL), 'xrpl_rLp8-A5Nn.xrplwallet');
  assert.equal(F.nomFichierWallet('XLM', XLM), 'xlm_GDRX-JUJ6.xlmwallet');
});

test('nomFichierAdressePublique', () => {
  assert.equal(F.nomFichierAdressePublique('XRPL', XRPL), 'xrpl_rLp8-A5Nn.adresse-publique.txt');
});

test('identifierTransaction : ancien format XRPL non signé', () => {
  const tx = { TransactionType: 'Payment', Account: XRPL, Fee: '12', Sequence: 1 };
  assert.deepEqual(F.identifierTransaction(tx), { chaine: 'XRPL', reseau: null, signee: false, transaction: tx, autorises: null });
});

test('identifierTransaction : ancien format XRPL signé', () => {
  const tx = { tx_blob: '1200', hash: 'AB' };
  assert.deepEqual(F.identifierTransaction(tx), { chaine: 'XRPL', reseau: null, signee: true, transaction: tx, autorises: null });
});

test('identifierTransaction : ancien format Stellar, réseau lu dans la phrase de réseau', () => {
  const test = { XDR: 'AAAA', Network: 'Test SDF Network ; September 2015' };
  const main = { XDR: 'AAAA', Network: 'Public Global Stellar Network ; September 2015' };
  assert.deepEqual(F.identifierTransaction(test), { chaine: 'XLM', reseau: 'test', signee: null, transaction: test, autorises: null });
  assert.equal(F.identifierTransaction(main).reseau, 'main');
});

test('identifierTransaction : contenu inconnu', () => {
  const inconnu = { chaine: null, reseau: null, signee: null, transaction: null, autorises: null };
  assert.deepEqual(F.identifierTransaction({ foo: 1 }), inconnu);
  assert.deepEqual(F.identifierTransaction(null), inconnu);
});

test('envelopperTransaction puis identifierTransaction : le réseau XRPL voyage avec la transaction', () => {
  const tx = { TransactionType: 'Payment', Account: XRPL, Fee: '12', Sequence: 1 };
  const enveloppe = F.envelopperTransaction({ chaine: 'XRPL', reseau: 'test', etape: 'a-signer', transaction: tx, autorises: [XRPL] });
  assert.equal(enveloppe.format, F.FORMAT_TRANSACTION);
  assert.deepEqual(F.identifierTransaction(JSON.parse(JSON.stringify(enveloppe))),
    { chaine: 'XRPL', reseau: 'test', signee: false, transaction: tx, autorises: [XRPL] });
});

test('identifierTransaction : enveloppe signée', () => {
  const tx = { tx_blob: '1200', hash: 'AB' };
  const enveloppe = F.envelopperTransaction({ chaine: 'XRPL', reseau: 'main', etape: 'signee', transaction: tx, autorises: [XRPL] });
  assert.equal(F.identifierTransaction(enveloppe).signee, true);
});

test('identifierTransaction : enveloppe incohérente, refusée', () => {
  const tx = { XDR: 'AAAA', Network: 'Test SDF Network ; September 2015' };
  const piege = { format: F.FORMAT_TRANSACTION, chaine: 'XLM', reseau: 'main', etape: 'a-signer', transaction: tx, autorises: [] };
  assert.equal(F.identifierTransaction(piege).chaine, null, 'le réseau annoncé contredit la transaction Stellar');
  const autre = { format: F.FORMAT_TRANSACTION, chaine: 'XRPL', reseau: 'ailleurs', etape: 'a-signer', transaction: { TransactionType: 'Payment' }, autorises: [] };
  assert.equal(F.identifierTransaction(autre).chaine, null, 'réseau inconnu');
});

test('envelopperTransaction refuse une étape ou un réseau inconnus', () => {
  assert.throws(() => F.envelopperTransaction({ chaine: 'XRPL', reseau: 'test', etape: 'brouillon', transaction: {} }), RangeError);
  assert.throws(() => F.envelopperTransaction({ chaine: 'XRPL', reseau: 'local', etape: 'a-signer', transaction: {} }), RangeError);
});

test('nomFichierTransaction : réseau inconnu (ancien format XRPL), le nom l\'omet', () => {
  assert.equal(F.nomFichierTransaction({
    chaine: 'XRPL', reseau: null, date: new Date(2026, 9, 14), operation: 'paiement',
    details: ['10', 'XRP'], empreinte: 'e1c6dd', etape: 'signee',
  }), 'xrpl_2026-10-14_paiement-10-xrp_e1c6dd.signee.json');
});
