// Étape 4 · vérifier puis envoyer une transaction signée.
// La chaîne et le réseau sont lus dans le contenu du fichier, jamais dans son nom.
// Le texte est écrit avec textContent : rien de ce que contient le fichier n'est interprété.
(function () {
  'use strict';

  const { Format, Fichiers, Reseau, Transactions, Bordereau, Connexion, Historique } = window.Commun;
  const { StellarSdk } = window.SecureWalletBundle;
  const historique = Historique.historiqueDuNavigateur();

  const SECONDES_PAR_REGISTRE = 4;
  const VUES = ['charger', 'verifier', 'envoi', 'resultat'];
  const AIDE = {
    charger: ['Charger la transaction signée', [
      'Le fichier .signee.json vient de l\'étape 3, sur le poste hors ligne.',
      'La chaîne et le réseau sont lus dans le contenu du fichier.',
    ]],
    verifier: ['Dernière vérification', [
      'Relisez le montant, le destinataire en entier et le tag.',
      'L\'empreinte doit être la même qu\'aux étapes 2 et 3.',
      'Une fois validée par le réseau, une transaction ne peut plus être annulée.',
    ]],
    envoi: ['Envoi', ['La validation prend en général quelques secondes.']],
    resultat: ['Résultat', [
      'L\'explorateur montre la transaction telle que le réseau l\'a enregistrée.',
      'En cas de refus, aucun fonds n\'a bougé : la page donne la raison et la marche à suivre.',
    ]],
  };

  const parId = (id) => document.getElementById(id);
  const etat = {};

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined) noeud.textContent = texte;
    return noeud;
  }

  // ---------- Vues et progression ----------

  function afficherVue(vue) {
    etat.vue = vue;
    const rang = VUES.indexOf(vue);
    for (const v of VUES) parId(`vue-${v}`).hidden = v !== vue;
    for (const bouton of document.querySelectorAll('[data-etape]')) {
      const i = Number(bouton.dataset.etape);
      bouton.classList.toggle('est-fait', i < rang);
      if (i === rang) bouton.setAttribute('aria-current', 'step');
      else bouton.removeAttribute('aria-current');
      // Revenir en arrière n'a de sens qu'avant l'envoi.
      bouton.disabled = !(i < rang && rang < 2);
    }
    parId('contexte-vide').hidden = rang > 0;
    parId('contexte-recap').hidden = rang === 0;
    const [titre, paragraphes] = AIDE[vue];
    parId('tiroir-aide-titre').textContent = `Aide · ${titre}`;
    parId('tiroir-aide-corps').replaceChildren(...paragraphes.map((texte) => element('p', '', texte)));
    const courante = document.querySelector('[data-etape][aria-current]');
    if (courante) courante.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function reinitialiser() {
    clearInterval(etat.minuterie);
    for (const cle of Object.keys(etat)) delete etat[cle];
    parId('fichier').value = '';
    parId('contenu-colle').value = '';
    afficherErreur('');
    parId('reseau-lu').textContent = 'lu dans le fichier';
    parId('reseau-lu').classList.add('est-attente');
    parId('contexte-titre').textContent = 'Transaction à envoyer';
    parId('bandeau-testnet').hidden = true;
    parId('message-verification').hidden = true;
    parId('correspondance').hidden = true;
    parId('delai').hidden = true;
    parId('bouton-envoyer').disabled = true;
    for (const bouton of parId('choix-reseau').querySelectorAll('button')) bouton.setAttribute('aria-pressed', 'false');
    document.title = '4 · Envoyer';
    afficherVue('charger');
  }

  // ---------- Chargement ----------

  function afficherErreur(message) {
    parId('erreur-chargement').textContent = message;
    parId('erreur-chargement').hidden = !message;
  }

  async function charger(texte, nom) {
    afficherErreur('');
    let objet;
    try {
      objet = JSON.parse(texte);
    } catch {
      afficherErreur("Ce fichier n'est pas une transaction : son contenu n'est pas lisible.");
      return;
    }
    if (Fichiers.estFichierWallet(objet)) {
      afficherErreur("Ce fichier est un wallet : il contient une clé privée. Ne l'ouvrez jamais sur un poste en ligne.");
      return;
    }
    const { chaine, reseau, transaction } = Fichiers.identifierTransaction(objet);
    if (!chaine) {
      afficherErreur("Ce fichier n'est pas une transaction.");
      return;
    }
    let decodee;
    try {
      decodee = Transactions.decoder(chaine, transaction);
    } catch {
      afficherErreur('Cette transaction est illisible : le fichier est peut-être abîmé.');
      return;
    }
    if (!decodee.signee) {
      afficherErreur("Cette transaction n'est pas signée. Signez-la d'abord à l'étape 3, sur le poste hors ligne.");
      return;
    }
    if (decodee.operation === 'inconnue') {
      afficherErreur(`Cette page ne sait pas traduire cette transaction (${decodee.raison}). Elle ne l'enverra pas.`);
      return;
    }

    Object.assign(etat, { transaction, decodee, chaine, reseau, provenance: 'lu dans le fichier' });
    parId('fichier-nom').textContent = nom;
    parId('technique-contenu').textContent = JSON.stringify(decodee.brut, null, 2);
    remplirRecapitulatif();
    const empreinteHex = await Transactions.empreinte(chaine, transaction);
    const empreinte = Format.formaterEmpreinte(empreinteHex);
    parId('empreinte').textContent = empreinte;
    parId('recap-empreinte').textContent = empreinte;
    afficherCorrespondance(empreinteHex);
    afficherVue('verifier');

    if (reseau) {
      await reseauConnu();
    } else {
      parId('vue-verifier').dataset.etat = 'reseau-a-choisir';
      Bordereau.remplir(parId('bordereau'), decodee, null);
      parId('reseau-lu').textContent = `${Transactions.libelleReseau(chaine, null)} · à choisir`;
      parId('reseau-lu').classList.add('est-attente');
      parId('choix-reseau').hidden = false;
    }
  }

  // E-1 : la transaction signée est-elle celle qui a été préparée sur ce poste ?
  function afficherCorrespondance(empreinteHex) {
    const ligne = parId('correspondance');
    const preparation = historique.trouverPreparation(empreinteHex);
    if (preparation) {
      ligne.className = 'verifie';
      ligne.textContent = preparation.date
        ? `Identique à la transaction préparée sur ce poste à ${Format.formaterHeure(preparation.date)}.`
        : 'Identique à une transaction préparée sur ce poste.';
    } else {
      ligne.className = 'doux petit';
      ligne.textContent = "Introuvable dans l'historique de ce poste : comparez l'empreinte avec celle affichée à l'étape 2.";
    }
    ligne.hidden = !preparation && !historique.actif();
  }

  function remplirRecapitulatif() {
    const d = etat.decodee;
    parId('recap-type').textContent = Transactions.LIBELLES[d.operation];
    const montant = parId('recap-montant');
    montant.hidden = !d.montant;
    if (d.montant) {
      let texte = d.montant;
      try { texte = Format.formaterMontant(d.montant); } catch { /* montant affiché tel quel */ }
      montant.replaceChildren(element('span', '', texte), element('span', 'montant__devise', d.devise));
    }
    const vers = parId('recap-vers');
    vers.hidden = !d.vers;
    if (d.vers) {
      vers.dataset.adresse = d.vers;
      window.Commun.Interface.afficherAdresse(vers);
    }
  }

  // ---------- Réseau et délai de validité ----------

  async function reseauConnu() {
    const { chaine, reseau, decodee } = etat;
    parId('vue-verifier').dataset.etat = 'calcul';
    parId('choix-reseau').hidden = etat.provenance === 'lu dans le fichier';
    const libelle = Transactions.libelleReseau(chaine, reseau);
    parId('reseau-lu').textContent = `${libelle} · ${Transactions.libelleFonds(reseau)}`;
    parId('reseau-lu').classList.remove('est-attente');
    parId('bandeau-testnet').hidden = reseau !== 'test';
    document.title = `4 · Envoyer · ${libelle}`;
    Bordereau.remplir(parId('bordereau'), decodee, reseau);
    await calculerEcheance();
    parId('vue-verifier').dataset.etat = 'pret';
  }

  function connecterXrpl() {
    return Connexion.clientXrpl(etat.reseau);
  }

  async function calculerEcheance() {
    clearInterval(etat.minuterie);
    const echeance = Transactions.echeance(etat.chaine, etat.transaction);
    etat.approximatif = false;
    try {
      if (echeance.date) {
        etat.limite = echeance.date;
      } else if (echeance.registre) {
        const actuel = await (await connecterXrpl()).getLedgerIndex();
        etat.limite = new Date(Date.now() + (echeance.registre - actuel) * SECONDES_PAR_REGISTRE * 1000);
        etat.approximatif = true;
      } else {
        etat.limite = null;
      }
    } catch {
      etat.limite = null;
      montrerMessage('Délai de validité non vérifiable : la connexion au réseau a échoué.');
    }
    actualiserDelai();
    if (etat.limite) etat.minuterie = setInterval(actualiserDelai, 1000);
  }

  function actualiserDelai() {
    const delai = parId('delai');
    if (!etat.limite) {
      delai.hidden = true;
      parId('bouton-envoyer').disabled = !etat.reseau;
      return;
    }
    const reste = etat.limite.getTime() - Date.now();
    if (reste <= 0) {
      clearInterval(etat.minuterie);
      delai.hidden = true;
      const refus = Reseau.expliquerRefus(etat.chaine === 'XRPL' ? 'tefMAX_LEDGER' : 'tx_too_late');
      montrerMessage(`${refus.raison} ${refus.conseil}`);
      parId('bouton-envoyer').disabled = true;
      return;
    }
    delai.hidden = false;
    delai.textContent = `Valable encore ${Format.formaterDuree(reste, { approximatif: etat.approximatif })}`;
    parId('bouton-envoyer').disabled = false;
  }

  function montrerMessage(texte) {
    parId('message-verification').textContent = texte;
    parId('message-verification').hidden = false;
  }

  // ---------- Envoi ----------

  async function envoyerXrpl() {
    const client = await connecterXrpl();
    const reponse = await client.submitAndWait(etat.transaction.tx_blob);
    const code = reponse.result.meta.TransactionResult;
    return { reussi: Reseau.estReussite(code), code, hash: reponse.result.hash || etat.transaction.hash, registre: reponse.result.ledger_index };
  }

  async function envoyerStellar() {
    const serveur = Connexion.serveurStellar(etat.reseau);
    const reponse = await serveur.submitTransaction(StellarSdk.TransactionBuilder.fromXDR(etat.transaction.XDR, etat.transaction.Network));
    return { reussi: true, hash: reponse.hash, registre: reponse.ledger };
  }

  function codeErreur(erreur) {
    const codes = erreur && erreur.response && erreur.response.data && erreur.response.data.extras && erreur.response.data.extras.result_codes;
    if (codes) return (codes.operations || []).find((code) => code !== 'op_success') || codes.transaction;
    if (/LastLedgerSequence/.test(String(erreur && erreur.message))) return 'tefMAX_LEDGER';
    return (erreur && erreur.data && erreur.data.engine_result) || null;
  }

  async function envoyer() {
    clearInterval(etat.minuterie);
    parId('delai').hidden = true;
    afficherVue('envoi');
    let resultat;
    try {
      resultat = etat.chaine === 'XRPL' ? await envoyerXrpl() : await envoyerStellar();
    } catch (erreur) {
      resultat = { reussi: false, code: codeErreur(erreur), message: String((erreur && erreur.message) || erreur) };
    }
    afficherResultat(resultat);
  }

  function afficherResultat(resultat) {
    const titre = parId('titre-resultat');
    const details = parId('resultat-details');
    const lien = parId('lien-explorateur');
    const d = etat.decodee;
    parId('vue-resultat').dataset.reussi = resultat.reussi ? 'oui' : 'non';
    parId('contexte-titre').textContent = resultat.reussi ? 'Transaction envoyée' : 'Transaction à envoyer';

    if (resultat.reussi) {
      titre.textContent = 'Transaction validée par le réseau';
      titre.className = 'titre-page titre-reussite';
      const liste = element('dl', 'cles-valeurs');
      const ajouter = (cle, valeur) => { if (valeur) liste.append(element('dt', '', cle), element('dd', '', valeur)); };
      ajouter('Opération', Transactions.LIBELLES[d.operation]);
      if (d.montant) {
        let montant = d.montant;
        try { montant = Format.formaterMontant(d.montant); } catch { /* montant affiché tel quel */ }
        ajouter('Montant', `${montant} ${d.devise}`);
      }
      if (d.vers) {
        const adresse = element('dd');
        adresse.dataset.adresse = d.vers;
        window.Commun.Interface.afficherAdresse(adresse);
        liste.append(element('dt', '', 'Destinataire'), adresse);
      }
      if (resultat.registre) ajouter('Registre', `n° ${resultat.registre}`);
      details.replaceChildren(liste);
      lien.hidden = !resultat.hash;
      if (resultat.hash) lien.href = Connexion.lienExplorateur(etat.chaine, etat.reseau, resultat.hash);
    } else {
      titre.textContent = 'Le réseau a refusé la transaction';
      titre.className = 'titre-page titre-danger';
      const contenu = [];
      if (resultat.code) {
        const refus = Reseau.expliquerRefus(resultat.code);
        const raison = element('p');
        raison.append(element('b', '', 'Raison : '), refus.raison);
        const conseil = element('p');
        conseil.append(element('b', '', 'Que faire : '), refus.conseil);
        contenu.push(raison, conseil,
          element('p', '', refus.fraisPreleves ? "Aucun fonds n'a bougé, mais les frais de réseau ont été prélevés." : "Aucun fonds n'a bougé."),
          element('p', 'petit doux', `Code renvoyé par le réseau : ${resultat.code}`));
      } else {
        contenu.push(element('p', '', "La transaction n'a pas pu être envoyée."), element('p', 'petit doux', resultat.message));
      }
      details.replaceChildren(...contenu);
      lien.hidden = true;
    }
    afficherVue('resultat');
  }

  // ---------- Branchements ----------

  parId('fichier').addEventListener('change', async () => {
    const fichier = parId('fichier').files[0];
    if (fichier) await charger(await fichier.text(), fichier.name);
  });

  const depot = parId('depot');
  depot.addEventListener('dragover', (e) => e.preventDefault());
  depot.addEventListener('drop', async (e) => {
    e.preventDefault();
    const fichier = e.dataTransfer.files[0];
    if (fichier) await charger(await fichier.text(), fichier.name);
  });

  parId('utiliser-colle').addEventListener('click', () => charger(parId('contenu-colle').value, 'contenu collé'));

  parId('choix-reseau').querySelector('.choix').addEventListener('change', (e) => {
    etat.reseau = e.detail.valeur;
    etat.provenance = 'choisi';
    reseauConnu();
  });

  parId('bouton-envoyer').addEventListener('click', envoyer);
  parId('pas-la-bonne').addEventListener('click', reinitialiser);
  parId('autre-transaction').addEventListener('click', reinitialiser);
  for (const bouton of document.querySelectorAll('[data-etape]')) {
    bouton.addEventListener('click', () => { if (Number(bouton.dataset.etape) === 0) reinitialiser(); });
  }

  parId('hors-ligne').hidden = navigator.onLine !== false;
  afficherVue('charger');
})();
