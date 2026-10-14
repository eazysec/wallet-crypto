// Fichiers wallet : lecture et chiffrement, au format de la version actuelle.
// ATTENTION : ce format reprend tel quel le chiffrement existant, qui est faible
// (clé = SHA-256 du mot de passe, sans sel ni dérivation ; AES-CBC sans authentification :
// constats F-01 et F-02). Sa correction (P0-1) est prévue hors de la refonte de l'interface ;
// elle ne touchera que ce fichier.
// Script classique : window.Commun.Coffre dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  class ErreurMotDePasse extends Error {
    constructor() {
      super('Mot de passe incorrect, ou fichier abîmé.');
      this.name = 'ErreurMotDePasse';
    }
  }

  const subtil = () => globalThis.crypto.subtle;
  const hexa = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');

  async function cle(motDePasse, usage) {
    const empreinte = await subtil().digest('SHA-256', new TextEncoder().encode(motDePasse));
    return subtil().importKey('raw', empreinte, { name: 'AES-CBC' }, false, [usage]);
  }

  /** Un fichier en clair est du JSON ; un fichier chiffré ne l'est pas. */
  function estChiffre(texte) {
    try {
      JSON.parse(texte);
      return false;
    } catch {
      return true;
    }
  }

  /** Format : 32 caractères hexadécimaux (vecteur d'initialisation) puis le chiffré en base64. */
  async function chiffrerWallet(wallet, motDePasse) {
    const vecteur = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const chiffre = await subtil().encrypt({ name: 'AES-CBC', iv: vecteur }, await cle(motDePasse, 'encrypt'), new TextEncoder().encode(JSON.stringify(wallet)));
    return hexa(vecteur) + btoa(String.fromCharCode(...new Uint8Array(chiffre)));
  }

  /** Renvoie { wallet, chiffre }. Rejette avec ErreurMotDePasse si le déchiffrement échoue. */
  async function lireFichierWallet(texte, motDePasse) {
    if (!estChiffre(texte)) return { wallet: JSON.parse(texte), chiffre: false };
    try {
      const vecteur = new Uint8Array(texte.slice(0, 32).match(/.{2}/g).map((o) => parseInt(o, 16)));
      const octets = Uint8Array.from(atob(texte.slice(32)), (c) => c.charCodeAt(0));
      const clair = await subtil().decrypt({ name: 'AES-CBC', iv: vecteur }, await cle(motDePasse, 'decrypt'), octets);
      return { wallet: JSON.parse(new TextDecoder().decode(clair)), chiffre: true };
    } catch {
      throw new ErreurMotDePasse();
    }
  }

  exporter('Coffre', { ErreurMotDePasse, estChiffre, chiffrerWallet, lireFichierWallet });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
