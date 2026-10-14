// État du poste hors ligne (constat F-07), commun aux pages 1 et 3.
// Un réseau détecté bloque tout ce qui touche aux secrets, sauf dérogation explicite.
// La page fournit les éléments #bande, #bande-lieu, #etat-poste, #alarme,
// #alarme-message et #derogation.
(function () {
  'use strict';

  const parId = (id) => document.getElementById(id);

  function texte(balise, contenu) {
    const noeud = document.createElement(balise);
    noeud.textContent = contenu;
    return noeud;
  }

  /**
   * etape : libellé de la bande (« Étape 3 · Signer ») ; blocage : ce qui est bloqué
   * (« clés et signature bloquées »).
   * auChangement({ connecte, bloque }) : appelée à chaque actualisation.
   * Renvoie { bloque(), actualiser() }.
   */
  function surveiller({ etape, blocage, auChangement }) {
    const connecte = () => navigator.onLine !== false;
    const bloque = () => connecte() && !parId('derogation').checked;

    function actualiser() {
      const etat = { connecte: connecte(), bloque: bloque() };
      const lieu = document.createElement('span');
      if (etat.connecte) lieu.append(texte('b', 'Réseau détecté'), etat.bloque ? ` · ${blocage}` : ' · poste exposé');
      else lieu.append(texte('b', 'Hors ligne'), ' · Zone privée');
      parId('bande-lieu').replaceChildren(lieu, texte('span', etape));
      parId('bande').classList.toggle('bande--alarme', etat.connecte);
      parId('etat-poste').textContent = etat.connecte ? 'Réseau détecté' : 'Aucun réseau détecté';
      parId('etat-poste').classList.toggle('est-alerte', etat.connecte);
      parId('alarme').hidden = !etat.connecte;
      // Rouge tant que c'est bloquant ; jaune une fois la dérogation acceptée.
      parId('alarme-message').className = `message ${etat.bloque ? 'message--danger' : 'message--attention'}`;
      auChangement(etat);
    }

    parId('derogation').addEventListener('change', actualiser);
    window.addEventListener('online', actualiser);
    window.addEventListener('offline', actualiser);
    return { bloque, actualiser };
  }

  (window.Commun = window.Commun || {}).Poste = { surveiller };
})();
