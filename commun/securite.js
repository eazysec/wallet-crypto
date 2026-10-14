// Robustesse des mots de passe et empreintes.
// Script classique : window.Commun.Securite dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  // En dessous de 60 bits, l'enregistrement du fichier wallet est bloqué.
  const SEUIL_ACCEPTABLE = 60;
  const SEUIL_SOLIDE = 80;

  /**
   * Estimation simple : longueur × log2(taille de l'alphabet utilisé).
   * Elle ne détecte pas les mots du dictionnaire : c'est un plancher de sécurité,
   * pas une mesure exacte.
   */
  function robustesseMotDePasse(motDePasse) {
    const texte = String(motDePasse || '');
    let alphabet = 0;
    if (/[a-z]/.test(texte)) alphabet += 26;
    if (/[A-Z]/.test(texte)) alphabet += 26;
    if (/[0-9]/.test(texte)) alphabet += 10;
    if (/[^a-zA-Z0-9]/.test(texte)) alphabet += 33;
    const bits = alphabet ? Math.round(texte.length * Math.log2(alphabet)) : 0;
    let niveau = 'solide';
    if (bits === 0) niveau = 'vide';
    else if (bits < SEUIL_ACCEPTABLE) niveau = 'faible';
    else if (bits < SEUIL_SOLIDE) niveau = 'acceptable';
    return { bits, niveau, bloquant: bits < SEUIL_ACCEPTABLE };
  }

  /** SHA-256 d'un texte, en hexadécimal. */
  async function empreinteSha256(texte) {
    const octets = new TextEncoder().encode(texte);
    const hache = await globalThis.crypto.subtle.digest('SHA-256', octets);
    return Array.from(new Uint8Array(hache), (o) => o.toString(16).padStart(2, '0')).join('');
  }

  exporter('Securite', { robustesseMotDePasse, empreinteSha256 });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
