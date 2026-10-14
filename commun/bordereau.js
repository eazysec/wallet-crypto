// Rendu du bordereau d'une transaction en clair (pages 3 et 4).
// Construit le contenu élément par élément, en texte seulement (aucun HTML interprété).
// Chaque champ porte data-champ="…" : c'est le repère stable des pilotes de test.
(function () {
  'use strict';

  const { Format, Transactions, Interface } = window.Commun;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function montantLisible(montant) {
    try {
      return Format.formaterMontant(montant);
    } catch {
      return String(montant);
    }
  }

  function ddAdresse(adresse) {
    const dd = element('dd');
    dd.dataset.adresse = adresse;
    Interface.afficherAdresse(dd);
    return dd;
  }

  function ddMontant(montant, devise, grand) {
    const dd = element('dd', grand ? 'montant' : 'valeur');
    dd.append(element('span', '', montantLisible(montant)), element('span', grand ? 'montant__devise' : '', grand ? devise : ` ${devise}`));
    return dd;
  }

  function champ(nom, libelle, dd, disposition) {
    const bloc = element('div', disposition || '');
    bloc.dataset.champ = nom;
    bloc.append(element('dt', '', libelle), dd);
    return bloc;
  }

  function champsDe(d) {
    const fraisDevise = d.chaine === 'XRPL' ? 'XRP' : 'XLM';
    const frais = champ('frais', 'Frais réseau', ddMontant(d.frais, fraisDevise, false));
    const tag = champ('tag', d.chaine === 'XRPL' ? 'Tag de destination' : 'Mémo', element('dd', 'valeur', d.tag === null ? 'Aucun' : d.tag));
    const depuis = (libelle) => champ('de', libelle, ddAdresse(d.de), 'large');

    switch (d.operation) {
      case 'paiement':
        return [
          champ('montant', 'Montant', ddMontant(d.montant, d.devise, true), 'large'),
          champ('vers', 'Destinataire', ddAdresse(d.vers), 'large'),
          ...(d.emetteur ? [champ('emetteur', 'Émetteur du jeton', ddAdresse(d.emetteur), 'large')] : []),
          tag,
          Object.assign(frais, { className: 'droite' }),
          depuis('Depuis le compte'),
        ];
      case 'jeton-ajout':
      case 'jeton-retrait':
        return [
          champ('devise', 'Jeton', element('dd', 'valeur', d.devise)),
          champ('plafond', 'Plafond accepté', element('dd', 'valeur', montantLisible(d.plafond)), 'droite'),
          champ('emetteur', 'Émetteur du jeton', ddAdresse(d.emetteur), 'large'),
          depuis('Compte'),
          frais,
        ];
      case 'suppression-compte':
        return [
          champ('vers', 'Le solde restant part vers', ddAdresse(d.vers), 'large'),
          tag,
          Object.assign(frais, { className: 'droite' }),
          depuis('Compte supprimé'),
        ];
      case 'signataire-ajout':
      case 'signataire-retrait':
        return [
          ...(d.signataire ? [champ('signataire', 'Signataire', ddAdresse(d.signataire), 'large')] : []),
          depuis('Compte'),
          frais,
        ];
      default:
        return [depuis('Compte'), frais];
    }
  }

  /**
   * Remplit `conteneur` avec le bordereau de la transaction décodée `d`.
   * reseau : 'main', 'test' ou null (pas encore connu).
   * options.sansReseau : n'afficher que la chaîne (réseau non vérifiable, page 3).
   */
  function remplir(conteneur, d, reseau, options = {}) {
    const tete = element('div', 'bordereau__tete');
    const titre = element('h2', 'bordereau__type', Transactions.LIBELLES[d.operation] || 'Transaction');
    titre.append(element('span', 'bordereau__technique', d.technique));
    const ligneReseau = element('span', 'bordereau__reseau');
    if (options.sansReseau) {
      ligneReseau.append(Transactions.libelleReseau(d.chaine, null));
    } else if (reseau) {
      ligneReseau.append(Transactions.libelleReseau(d.chaine, reseau), element('span', '', ` · ${Transactions.libelleFonds(reseau)}`));
    } else {
      ligneReseau.append(Transactions.libelleReseau(d.chaine, null), element('span', '', ' · réseau à choisir'));
    }
    tete.append(titre, ligneReseau);

    const liste = element('dl', 'champs');
    liste.append(...champsDe(d));

    const notes = [];
    if (d.creationCompte) notes.push(element('p', 'message', "Le compte destinataire n'existe pas encore : ce paiement le crée."));
    if (d.livraisonPartielle) {
      const note = element('p', 'message message--attention');
      note.append(element('b', '', 'Livraison partielle autorisée.'), ' Le destinataire peut recevoir moins que ce montant.');
      notes.push(note);
    }
    if (d.multisignature) {
      const note = element('p', 'etat', d.chaine === 'XRPL'
        ? "Signée par un signataire, pas par la clé principale du compte : frais doublés, comme l'exige le réseau."
        : 'Signée par un signataire, pas par la clé principale du compte.');
      note.dataset.multisignature = '';
      notes.push(note);
    }

    conteneur.classList.add('bordereau');
    conteneur.replaceChildren(tete, liste, ...notes);
  }

  (window.Commun = window.Commun || {}).Bordereau = { remplir };
})();
