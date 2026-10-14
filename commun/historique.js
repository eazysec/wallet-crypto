// Historique local du poste en ligne : transactions préparées et destinataires déjà utilisés.
// Il ne contient que des données publiques (adresses, empreintes) et ne quitte jamais le poste.
// Ce qu'on y relit est traité comme non fiable : contrôlé, jamais interprété.
// Script classique : window.Commun.Historique dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  const CLES = {
    preparations: 'securedwallet.preparations',
    destinataires: 'securedwallet.destinataires',
    actif: 'securedwallet.historique-actif',
  };
  const MAX_PREPARATIONS = 50;
  const MAX_DESTINATAIRES = 500;

  function stockageEnMemoire() {
    const valeurs = new Map();
    return {
      getItem: (cle) => (valeurs.has(cle) ? valeurs.get(cle) : null),
      setItem: (cle, valeur) => valeurs.set(cle, String(valeur)),
      removeItem: (cle) => valeurs.delete(cle),
    };
  }

  /** stockage : un objet du type localStorage, ou null (l'historique vit alors en mémoire). */
  function creerHistorique(stockage) {
    const s = stockage || stockageEnMemoire();

    function lireListe(cle) {
      try {
        const valeur = JSON.parse(s.getItem(cle));
        return Array.isArray(valeur) ? valeur : [];
      } catch {
        return [];
      }
    }
    function ecrire(cle, valeur) {
      try {
        s.setItem(cle, JSON.stringify(valeur));
      } catch {
        // Stockage plein ou refusé : l'historique est une aide, pas une obligation.
      }
    }
    function actif() {
      try {
        return s.getItem(CLES.actif) !== 'non';
      } catch {
        return true;
      }
    }

    return {
      actif,

      activer(oui) {
        try { s.setItem(CLES.actif, oui ? 'oui' : 'non'); } catch { /* sans effet */ }
      },

      noterPreparation({ empreinte, chaine, reseau, operation, date = new Date() }) {
        if (!actif()) return;
        const liste = lireListe(CLES.preparations).filter((p) => p && p.empreinte !== empreinte);
        liste.unshift({ empreinte: String(empreinte), chaine: String(chaine), reseau: String(reseau), operation: String(operation), date: date.toISOString() });
        ecrire(CLES.preparations, liste.slice(0, MAX_PREPARATIONS));
      },

      /** La préparation de cette empreinte, ou null. */
      trouverPreparation(empreinte) {
        if (!actif()) return null;
        const trouvee = lireListe(CLES.preparations).find((p) => p && typeof p === 'object' && p.empreinte === empreinte);
        if (!trouvee) return null;
        const date = new Date(trouvee.date);
        return { empreinte: trouvee.empreinte, chaine: trouvee.chaine, reseau: trouvee.reseau, operation: trouvee.operation, date: isNaN(date) ? null : date };
      },

      noterDestinataire(chaine, reseau, adresse) {
        if (!actif()) return;
        const cle = `${chaine}:${reseau}:${adresse}`;
        const liste = lireListe(CLES.destinataires).filter((d) => d !== cle);
        liste.unshift(cle);
        ecrire(CLES.destinataires, liste.slice(0, MAX_DESTINATAIRES));
      },

      /** true ou false ; null si l'historique est désactivé (on ne signale alors rien). */
      destinataireConnu(chaine, reseau, adresse) {
        if (!actif()) return null;
        return lireListe(CLES.destinataires).includes(`${chaine}:${reseau}:${adresse}`);
      },

      effacer() {
        try {
          s.removeItem(CLES.preparations);
          s.removeItem(CLES.destinataires);
        } catch { /* sans effet */ }
      },
    };
  }

  /** Historique des pages : localStorage s'il est disponible, sinon en mémoire. */
  function historiqueDuNavigateur() {
    let stockage = null;
    try {
      stockage = window.localStorage;
      stockage.getItem(CLES.actif);
    } catch {
      stockage = null;
    }
    return creerHistorique(stockage);
  }

  exporter('Historique', { creerHistorique, historiqueDuNavigateur });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
