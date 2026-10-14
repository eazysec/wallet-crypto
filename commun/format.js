// Mise en forme des données affichées.
// Script classique (les modules ES ne se chargent pas en file://) : disponible dans les pages
// sous window.Commun.Format, et dans les tests Node via require().
(function (exporter) {
  'use strict';

  // Séparateur de milliers : espace insécable. L'espace fine (U+202F) ne fait que 2 px
  // dans la police de texte et rendait les milliers illisibles.
  const SEPARATEUR_MILLIERS = '\u00a0';

  /** Découpe une adresse en blocs de `taille` caractères, pour la relire bloc par bloc. */
  function groupesAdresse(adresse, taille = 4) {
    const texte = String(adresse || '').trim();
    const groupes = [];
    for (let i = 0; i < texte.length; i += taille) groupes.push(texte.slice(i, i + taille));
    return groupes;
  }

  /**
   * Montant décimal écrit avec un point (« 1250.5 », format des chaînes) vers l'usage français
   * (« 1 250,5 »). Travaille sur le texte pour éviter toute erreur d'arrondi.
   */
  function formaterMontant(valeur) {
    const texte = String(valeur).trim();
    const morceaux = texte.match(/^(\d+)(?:\.(\d+))?$/);
    if (!morceaux) throw new RangeError(`Montant invalide : ${texte}`);
    const entier = morceaux[1].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR_MILLIERS);
    const decimales = (morceaux[2] || '').replace(/0+$/, '');
    return decimales ? `${entier},${decimales}` : entier;
  }

  /** Empreinte affichée : 12 caractères hexadécimaux en majuscules, par blocs de 4. */
  function formaterEmpreinte(hex) {
    return String(hex).slice(0, 12).toUpperCase().match(/.{1,4}/g).join(' ');
  }

  /** Début de l'empreinte repris dans les noms de fichiers. */
  function prefixeEmpreinte(hex) {
    return String(hex).slice(0, 6).toLowerCase();
  }

  /**
   * Durée restante : « 59 s », « 11 min 05 s », « 3 h 05 min » ou « 2 j 2 h ».
   * approximatif : échéance estimée (registres XRPL), en minutes : « environ 15 min ».
   */
  function formaterDuree(millisecondes, { approximatif = false } = {}) {
    const deux = (n) => String(n).padStart(2, '0');
    const total = Math.max(0, Math.floor(millisecondes / 1000));
    if (approximatif) {
      if (total < 60) return "moins d'une minute";
      const minutes = Math.floor(total / 60);
      return minutes < 60 ? `environ ${minutes} min` : `environ ${Math.floor(minutes / 60)} h ${deux(minutes % 60)} min`;
    }
    const jours = Math.floor(total / 86400);
    const heures = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secondes = total % 60;
    if (jours > 0) return `${jours} j ${heures} h`;
    if (heures > 0) return `${heures} h ${deux(minutes)} min`;
    if (minutes > 0) return `${minutes} min ${deux(secondes)} s`;
    return `${secondes} s`;
  }

  /** Heure locale : « 10 h 47 ». */
  function formaterHeure(date) {
    return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
  }

  exporter('Format', { groupesAdresse, formaterMontant, formaterEmpreinte, prefixeEmpreinte, formaterDuree, formaterHeure });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
