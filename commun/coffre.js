// Fichiers wallet : chiffrement et lecture.
// Format securedwallet/wallet-v2 (P0-1) : clé dérivée du mot de passe par PBKDF2-HMAC-SHA-256
// (sel aléatoire, nombre d'itérations écrit dans le fichier), contenu chiffré en AES-256-GCM,
// en-tête authentifié. Les anciens fichiers (SHA-256 + AES-CBC, ou en clair) ne sont plus lus.
// Script classique : window.Commun.Coffre dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  class ErreurMotDePasse extends Error {
    constructor() {
      super('Mot de passe incorrect, ou fichier abîmé.');
      this.name = 'ErreurMotDePasse';
    }
  }

  const FORMAT = 'securedwallet/wallet-v2';
  const KDF = 'PBKDF2-SHA-256';
  const CHIFFREMENT = 'AES-256-GCM';
  const ITERATIONS = 1000000;
  // Bornes acceptées à la lecture : en dessous, trop faible ; au-dessus, la page resterait figée.
  const ITERATIONS_MIN = 600000;
  const ITERATIONS_MAX = 10000000;
  const TAILLE_SEL = 16;
  const TAILLE_IV = 12;
  const TAILLE_ETIQUETTE = 16;

  const subtil = () => globalThis.crypto.subtle;
  const aleatoire = (taille) => globalThis.crypto.getRandomValues(new Uint8Array(taille));
  const versBase64 = (octets) => btoa(String.fromCharCode(...octets));

  /** Base64 strict : rejette tout autre texte. */
  function depuisBase64(texte) {
    if (typeof texte !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(texte)) throw new ErreurMotDePasse();
    return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));
  }

  /** En-tête dans un ordre fixe : c'est aussi la donnée authentifiée par AES-GCM. */
  function entete(iterations, sel, iv) {
    return {
      format: FORMAT,
      kdf: { nom: KDF, iterations, sel: versBase64(sel) },
      chiffrement: { nom: CHIFFREMENT, iv: versBase64(iv) },
    };
  }

  async function cle(motDePasse, sel, iterations, usage) {
    const base = await subtil().importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveKey']);
    return subtil().deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      [usage],
    );
  }

  async function chiffrerWallet(wallet, motDePasse) {
    const sel = aleatoire(TAILLE_SEL);
    const iv = aleatoire(TAILLE_IV);
    const tete = entete(ITERATIONS, sel, iv);
    const chiffre = await subtil().encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(tete)) },
      await cle(motDePasse, sel, ITERATIONS, 'encrypt'),
      new TextEncoder().encode(JSON.stringify(wallet)),
    );
    return JSON.stringify({ ...tete, chiffre: versBase64(new Uint8Array(chiffre)) });
  }

  /** Lit l'en-tête ; tout écart au format est refusé avant le moindre calcul. */
  function lireEntete(texte) {
    const fichier = JSON.parse(texte);
    const { kdf, chiffrement } = fichier || {};
    if (fichier?.format !== FORMAT || kdf?.nom !== KDF || chiffrement?.nom !== CHIFFREMENT) throw new ErreurMotDePasse();
    const { iterations } = kdf;
    if (!Number.isInteger(iterations) || iterations < ITERATIONS_MIN || iterations > ITERATIONS_MAX) throw new ErreurMotDePasse();
    const sel = depuisBase64(kdf.sel);
    const iv = depuisBase64(chiffrement.iv);
    const chiffre = depuisBase64(fichier.chiffre);
    if (sel.length !== TAILLE_SEL || iv.length !== TAILLE_IV || chiffre.length <= TAILLE_ETIQUETTE) throw new ErreurMotDePasse();
    return { iterations, sel, iv, chiffre };
  }

  /** Renvoie { wallet }. Rejette avec ErreurMotDePasse si le fichier est illisible ou le mot de passe faux. */
  async function lireFichierWallet(texte, motDePasse) {
    try {
      const { iterations, sel, iv, chiffre } = lireEntete(texte);
      const clair = await subtil().decrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(entete(iterations, sel, iv))) },
        await cle(motDePasse, sel, iterations, 'decrypt'),
        chiffre,
      );
      return { wallet: JSON.parse(new TextDecoder().decode(clair)) };
    } catch {
      throw new ErreurMotDePasse();
    }
  }

  exporter('Coffre', { ErreurMotDePasse, chiffrerWallet, lireFichierWallet });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
