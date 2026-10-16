// Recrée les fichiers wallet de tests/donnees/wallets/ au format actuel (commun/coffre.js),
// à partir des wallets de l'ancien format conservés dans tests/donnees/wallets-ancien-format/.
// Le contenu (clés, adresse, mots) est inchangé ; seul le chiffrement change.
//
// Usage : node tests/outils/generer-wallets.js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Coffre = require('../../commun/coffre');
const { MOT_DE_PASSE } = require('../donnees/vecteurs');

const donnees = path.join(__dirname, '../donnees');

/** Ancien format : 32 caractères hexadécimaux (IV) puis le chiffré AES-CBC en base64 ; clé = SHA-256(mot de passe). */
function lireAncien(texte, motDePasse) {
  const cle = crypto.createHash('sha256').update(motDePasse).digest();
  const dechiffreur = crypto.createDecipheriv('aes-256-cbc', cle, Buffer.from(texte.slice(0, 32), 'hex'));
  return JSON.parse(Buffer.concat([dechiffreur.update(Buffer.from(texte.slice(32), 'base64')), dechiffreur.final()]).toString('utf8'));
}

(async () => {
  for (const nom of ['xrpl-abandon12.xrplwallet', 'xlm-sep5test1.xlmwallet']) {
    const wallet = lireAncien(fs.readFileSync(path.join(donnees, 'wallets-ancien-format', nom), 'utf8'), MOT_DE_PASSE);
    fs.writeFileSync(path.join(donnees, 'wallets', nom), await Coffre.chiffrerWallet(wallet, MOT_DE_PASSE));
    console.log(nom, wallet.classicAddress);
  }
})();
