// Comportements d'interface partagés, déclarés par attributs data-* dans le HTML.
// Dépend de commun/format.js. Le texte est toujours écrit avec textContent, jamais innerHTML.
//
//   data-adresse="…"            adresse affichée par blocs de 4, extrémités marquées
//   data-montant="1250.5"       montant affiché selon l'usage français
//   .choix > button[aria-pressed]   choix segmenté ; événement « change » (detail.valeur)
//   button[data-maintenir]      action confirmée par un appui maintenu ; événement « confirme »
//   [data-tiroir="id"]          ouvre le <dialog id="id"> ; [data-fermer] le referme
//   [data-basculer-secret="id"] affiche ou masque le champ secret id
(function () {
  'use strict';

  const Format = window.Commun.Format;
  // Même valeur que --duree-maintien dans commun.css.
  const DUREE_MAINTIEN = 1200;
  const CONSIGNE_MAINTIEN = "Maintenez appuyé jusqu'au bout";

  function afficherAdresse(element) {
    const groupes = Format.groupesAdresse(element.dataset.adresse);
    element.classList.add('adresse');
    element.replaceChildren(...groupes.map((groupe, i) => {
      const bloc = document.createElement('span');
      bloc.textContent = groupe;
      bloc.className = i === 0 || i === groupes.length - 1 ? 'adresse__bout' : 'adresse__milieu';
      return bloc;
    }));
  }

  function afficherMontant(element) {
    element.textContent = Format.formaterMontant(element.dataset.montant);
  }

  function brancherChoix(groupe) {
    groupe.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button');
      if (!bouton || !groupe.contains(bouton)) return;
      for (const autre of groupe.querySelectorAll('button')) {
        autre.setAttribute('aria-pressed', String(autre === bouton));
      }
      groupe.dispatchEvent(new CustomEvent('change', { detail: { valeur: bouton.dataset.valeur || bouton.textContent } }));
    });
  }

  function brancherMaintien(bouton) {
    const libelle = bouton.querySelector('.bouton__libelle') || bouton;
    let minuterie = null;
    let rappel = null;
    let texteInitial = null;

    function retablirLibelle() {
      clearTimeout(rappel);
      rappel = null;
      if (texteInitial !== null && !bouton.classList.contains('est-confirme')) libelle.textContent = texteInitial;
      texteInitial = null;
    }

    // Un simple clic ne fait rien : on dit pourquoi, sinon le bouton paraît en panne.
    function rappelerConsigne() {
      if (texteInitial === null) texteInitial = libelle.textContent;
      libelle.textContent = CONSIGNE_MAINTIEN;
      clearTimeout(rappel);
      rappel = setTimeout(retablirLibelle, 2500);
    }

    function commencer() {
      if (bouton.disabled || bouton.classList.contains('est-confirme') || minuterie) return;
      retablirLibelle();
      bouton.classList.add('est-maintenu');
      minuterie = setTimeout(() => {
        minuterie = null;
        bouton.classList.remove('est-maintenu');
        bouton.classList.add('est-confirme');
        if (bouton.dataset.texteConfirme) libelle.textContent = bouton.dataset.texteConfirme;
        bouton.dispatchEvent(new CustomEvent('confirme', { bubbles: true }));
      }, DUREE_MAINTIEN);
    }
    function arreter() {
      const tropTot = minuterie !== null;
      if (minuterie) clearTimeout(minuterie);
      minuterie = null;
      bouton.classList.remove('est-maintenu');
      if (tropTot) rappelerConsigne();
    }

    bouton.addEventListener('pointerdown', commencer);
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) bouton.addEventListener(type, arreter);
    bouton.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); commencer(); }
    });
    bouton.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') arreter(); });
    bouton.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function brancherTiroir(declencheur) {
    declencheur.addEventListener('click', () => {
      const tiroir = document.getElementById(declencheur.dataset.tiroir);
      if (tiroir && !tiroir.open) tiroir.showModal();
    });
  }

  function brancherDialogue(dialogue) {
    for (const fermer of dialogue.querySelectorAll('[data-fermer]')) {
      fermer.addEventListener('click', () => dialogue.close());
    }
    // Un clic sur le fond assombri (hors du contenu) referme le tiroir.
    dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
  }

  function brancherSecret(bouton) {
    bouton.addEventListener('click', () => {
      const saisie = document.getElementById(bouton.dataset.basculerSecret);
      const afficher = saisie.type === 'password';
      saisie.type = afficher ? 'text' : 'password';
      bouton.textContent = afficher ? 'Masquer' : 'Afficher';
    });
  }

  /** Applique les comportements aux éléments de `racine` qui ne les ont pas encore. */
  function initialiser(racine = document) {
    const une = (selecteur, action) => {
      for (const element of racine.querySelectorAll(selecteur)) {
        if (element.dataset.initialise) continue;
        element.dataset.initialise = '1';
        action(element);
      }
    };
    une('[data-adresse]', afficherAdresse);
    une('[data-montant]', afficherMontant);
    une('.choix', brancherChoix);
    une('button[data-maintenir]', brancherMaintien);
    une('[data-tiroir]', brancherTiroir);
    une('dialog.tiroir', brancherDialogue);
    une('[data-basculer-secret]', brancherSecret);
  }

  (window.Commun = window.Commun || {}).Interface = { initialiser, afficherAdresse, afficherMontant };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initialiser());
  else initialiser();
})();
