const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../../commun/coffre');
const { ADRESSES, MOT_DE_PASSE } = require('../donnees/vecteurs');

const fichier = (nom) => fs.readFileSync(path.join(__dirname, '../donnees/wallets', nom), 'utf8');

test('un fichier wallet chiffré par l\'ancienne version se déchiffre', async () => {
  const { wallet, chiffre } = await C.lireFichierWallet(fichier('xrpl-abandon12.xrplwallet'), MOT_DE_PASSE);
  assert.equal(chiffre, true);
  assert.equal(wallet.classicAddress, ADRESSES.xrplAbandon12);
});

test('fichier Stellar de l\'ancienne version', async () => {
  const { wallet } = await C.lireFichierWallet(fichier('xlm-sep5test1.xlmwallet'), MOT_DE_PASSE);
  assert.equal(wallet.classicAddress, ADRESSES.xlmSep5test1);
});

test('mauvais mot de passe : erreur explicite, sans contenu', async () => {
  await assert.rejects(C.lireFichierWallet(fichier('xrpl-abandon12.xrplwallet'), 'pas-le-bon'), {
    name: 'ErreurMotDePasse',
    message: 'Mot de passe incorrect, ou fichier abîmé.',
  });
});

test('chiffrer puis lire redonne le wallet', async () => {
  const wallet = { classicAddress: 'rTest', privateKey: '00AB', seed: 'mots de test' };
  const texte = await C.chiffrerWallet(wallet, 'un-mot-de-passe');
  assert.throws(() => JSON.parse(texte), 'le fichier ne doit pas être en clair');
  assert.deepEqual((await C.lireFichierWallet(texte, 'un-mot-de-passe')).wallet, wallet);
});

test('un fichier en clair (ancien export sans mot de passe) est lu, et signalé comme non chiffré', async () => {
  const { wallet, chiffre } = await C.lireFichierWallet(JSON.stringify({ classicAddress: 'rTest' }), '');
  assert.equal(chiffre, false);
  assert.equal(wallet.classicAddress, 'rTest');
});

test('estChiffre distingue un fichier chiffré d\'un fichier en clair', () => {
  assert.equal(C.estChiffre(fichier('xrpl-abandon12.xrplwallet')), true);
  assert.equal(C.estChiffre('{"classicAddress":"rTest"}'), false);
});
