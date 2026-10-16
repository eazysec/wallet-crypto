const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../../commun/coffre');
const { MOT_DE_PASSE } = require('../donnees/vecteurs');

// Format du fichier wallet (P0-1) :
// { format: 'securedwallet/wallet-v2',
//   kdf: { nom: 'PBKDF2-SHA-256', iterations, sel },   sel : 16 octets en base64
//   chiffrement: { nom: 'AES-256-GCM', iv },          iv : 12 octets en base64
//   chiffre }                                          chiffré + étiquette de 16 octets, en base64
// Données additionnelles authentifiées : JSON.stringify({ format, kdf: { nom, iterations, sel }, chiffrement: { nom, iv } }).

const ERREUR = { name: 'ErreurMotDePasse', message: 'Mot de passe incorrect, ou fichier abîmé.' };
const WALLET = { privateKey: '00AB', publicKey: 'ED01', classicAddress: 'rTest', seed: 'mots de test' };
const ancien = (nom) => fs.readFileSync(path.join(__dirname, '../donnees/wallets-ancien-format', nom), 'utf8');

/** Fabrique un fichier wallet avec le module crypto de Node, indépendamment de coffre.js. */
function fabriquer(wallet, motDePasse, { iterations = 1000000, sel = crypto.randomBytes(16), iv = crypto.randomBytes(12), aad } = {}) {
  const entete = {
    format: 'securedwallet/wallet-v2',
    kdf: { nom: 'PBKDF2-SHA-256', iterations, sel: sel.toString('base64') },
    chiffrement: { nom: 'AES-256-GCM', iv: iv.toString('base64') },
  };
  const cle = crypto.pbkdf2Sync(motDePasse, sel, iterations, 32, 'sha256');
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cle, iv);
  chiffreur.setAAD(Buffer.from(aad ?? JSON.stringify(entete)));
  const chiffre = Buffer.concat([chiffreur.update(JSON.stringify(wallet)), chiffreur.final(), chiffreur.getAuthTag()]);
  return { ...entete, chiffre: chiffre.toString('base64') };
}

test('chiffrer puis lire redonne le wallet', async () => {
  const texte = await C.chiffrerWallet(WALLET, 'un-mot-de-passe');
  assert.deepEqual((await C.lireFichierWallet(texte, 'un-mot-de-passe')).wallet, WALLET);
});

test('le fichier produit suit le format v2, sans aucun secret en clair', async () => {
  const texte = await C.chiffrerWallet(WALLET, 'un-mot-de-passe');
  const fichier = JSON.parse(texte);
  assert.deepEqual(Object.keys(fichier), ['format', 'kdf', 'chiffrement', 'chiffre']);
  assert.equal(fichier.format, 'securedwallet/wallet-v2');
  assert.deepEqual({ ...fichier.kdf, sel: undefined }, { nom: 'PBKDF2-SHA-256', iterations: 1000000, sel: undefined });
  assert.equal(Buffer.from(fichier.kdf.sel, 'base64').length, 16);
  assert.equal(fichier.chiffrement.nom, 'AES-256-GCM');
  assert.equal(Buffer.from(fichier.chiffrement.iv, 'base64').length, 12);
  assert.equal(Buffer.from(fichier.chiffre, 'base64').length, JSON.stringify(WALLET).length + 16);
  for (const secret of [WALLET.privateKey, WALLET.seed, 'un-mot-de-passe']) assert.ok(!texte.includes(secret));
});

test('deux chiffrements du même wallet ont un sel et un IV différents', async () => {
  const a = JSON.parse(await C.chiffrerWallet(WALLET, 'un-mot-de-passe'));
  const b = JSON.parse(await C.chiffrerWallet(WALLET, 'un-mot-de-passe'));
  assert.notEqual(a.kdf.sel, b.kdf.sel);
  assert.notEqual(a.chiffrement.iv, b.chiffrement.iv);
});

test('un fichier fabriqué selon la norme (crypto de Node) se lit : PBKDF2 et AES-GCM conformes', async () => {
  const fichier = fabriquer(WALLET, MOT_DE_PASSE, { sel: Buffer.alloc(16, 1), iv: Buffer.alloc(12, 2) });
  assert.deepEqual((await C.lireFichierWallet(JSON.stringify(fichier), MOT_DE_PASSE)).wallet, WALLET);
});

test('le nombre d\'itérations est lu dans le fichier', async () => {
  const fichier = fabriquer(WALLET, MOT_DE_PASSE, { iterations: 600000 });
  assert.deepEqual((await C.lireFichierWallet(JSON.stringify(fichier), MOT_DE_PASSE)).wallet, WALLET);
});

test('mauvais mot de passe : erreur explicite, sans contenu', async () => {
  const texte = await C.chiffrerWallet(WALLET, 'un-mot-de-passe');
  await assert.rejects(C.lireFichierWallet(texte, 'pas-le-bon'), ERREUR);
});

test('un octet du chiffré modifié est détecté', async () => {
  const fichier = fabriquer(WALLET, MOT_DE_PASSE);
  const octets = Buffer.from(fichier.chiffre, 'base64');
  octets[0] ^= 1;
  await assert.rejects(C.lireFichierWallet(JSON.stringify({ ...fichier, chiffre: octets.toString('base64') }), MOT_DE_PASSE), ERREUR);
});

test('l\'en-tête est authentifié : chiffré sans lui, ou avec un autre, le fichier est refusé', async () => {
  for (const aad of ['', JSON.stringify({ format: 'securedwallet/wallet-v2' })]) {
    await assert.rejects(C.lireFichierWallet(JSON.stringify(fabriquer(WALLET, MOT_DE_PASSE, { aad })), MOT_DE_PASSE), ERREUR);
  }
});

test('un en-tête modifié est détecté', async () => {
  const fichier = fabriquer(WALLET, MOT_DE_PASSE, { iv: Buffer.alloc(12, 2) });
  const autreIv = Buffer.alloc(12, 3).toString('base64');
  await assert.rejects(C.lireFichierWallet(JSON.stringify({ ...fichier, chiffrement: { ...fichier.chiffrement, iv: autreIv } }), MOT_DE_PASSE), ERREUR);
  const iterations = fichier.kdf.iterations + 1;
  await assert.rejects(C.lireFichierWallet(JSON.stringify({ ...fichier, kdf: { ...fichier.kdf, iterations } }), MOT_DE_PASSE), ERREUR);
});

test('itérations hors des bornes (600 000 à 10 000 000) : refusé sans calcul', async () => {
  for (const iterations of [599999, 10000001, 0, -1, 1.5, '1000000']) {
    const fichier = { ...fabriquer(WALLET, MOT_DE_PASSE, { iterations: 600000 }), kdf: { nom: 'PBKDF2-SHA-256', iterations, sel: Buffer.alloc(16).toString('base64') } };
    const debut = Date.now();
    await assert.rejects(C.lireFichierWallet(JSON.stringify(fichier), MOT_DE_PASSE), ERREUR, `itérations ${iterations}`);
    assert.ok(Date.now() - debut < 100, `itérations ${iterations} : refus immédiat`);
  }
});

test('algorithme, sel ou IV inattendus : refusé', async () => {
  const fichier = fabriquer(WALLET, MOT_DE_PASSE);
  const variantes = [
    { ...fichier, format: 'securedwallet/wallet-v3' },
    { ...fichier, kdf: { ...fichier.kdf, nom: 'SHA-256' } },
    { ...fichier, kdf: { ...fichier.kdf, sel: Buffer.alloc(8).toString('base64') } },
    { ...fichier, chiffrement: { ...fichier.chiffrement, nom: 'AES-CBC' } },
    { ...fichier, chiffrement: { ...fichier.chiffrement, iv: Buffer.alloc(16).toString('base64') } },
    { ...fichier, chiffre: '' },
    { ...fichier, chiffre: 'pas du base64 !' },
  ];
  for (const variante of variantes) await assert.rejects(C.lireFichierWallet(JSON.stringify(variante), MOT_DE_PASSE), ERREUR);
});

test('un fichier de l\'ancien format chiffré (SHA-256 + AES-CBC) est refusé, même avec le bon mot de passe', async () => {
  await assert.rejects(C.lireFichierWallet(ancien('xrpl-abandon12.xrplwallet'), MOT_DE_PASSE), ERREUR);
  await assert.rejects(C.lireFichierWallet(ancien('xlm-sep5test1.xlmwallet'), MOT_DE_PASSE), ERREUR);
});

test('un fichier en clair (ancien export sans mot de passe) est refusé', async () => {
  await assert.rejects(C.lireFichierWallet(JSON.stringify({ classicAddress: 'rTest', seed: 'mots' }), ''), ERREUR);
});

test('fichiers qui ne sont pas des wallets : refusés', async () => {
  for (const texte of ['', 'null', '[]', '"texte"', '{}', 'pas du JSON']) await assert.rejects(C.lireFichierWallet(texte, MOT_DE_PASSE), ERREUR);
});
