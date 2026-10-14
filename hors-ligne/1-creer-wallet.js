// Étape 1 · créer ou restaurer un wallet, sur le poste hors ligne.
// Les mots ne s'affichent qu'à la demande, sans bouton Copier, et la copie est vérifiée.
// Le fichier wallet est toujours chiffré (constat F-04) ; la clé privée n'est jamais affichée (F-03).
(function () {
  'use strict';

  const { Fichiers, Securite, Coffre, Cles, Interface, Poste } = window.Commun;

  const parId = (id) => document.getElementById(id);
  const VUES = ['choisir', 'preparer', 'mots', 'verifier', 'restaurer', 'fichier', 'termine'];
  const PARCOURS = {
    creer: ['choisir', 'preparer', 'mots', 'verifier', 'fichier', 'termine'],
    restaurer: ['choisir', 'restaurer', 'fichier', 'termine'],
  };
  const CHAINES = { XRPL: 'XRPL', XLM: 'Stellar' };
  const ALGORITHMES = { XRPL: 'secp256k1', XLM: 'ed25519' };
  const JAUGE = {
    vide: 'Saisissez un mot de passe.',
    faible: 'Trop faible : enregistrement bloqué. Ajoutez des mots ou des caractères.',
    acceptable: 'Acceptable. Un mot de plus le rendrait solide.',
    solide: 'Solide.',
  };
  const AIDE = {
    choisir: ['Créer ou restaurer', [
      'Ce poste doit rester hors ligne : câble débranché, Wi-Fi coupé.',
      'Choisissez le réseau (XRPL ou Stellar) en haut de la page. Les mêmes clés servent sur Mainnet et sur Testnet : le choix entre les deux se fait à l\'étape 2.',
      'Créer : la page tire au hasard une liste de mots. Ces mots sont votre wallet : qui les connaît possède les fonds.',
      'Restaurer : retrouvez un wallet à partir de ses mots, de ses numéros secrets Xaman ou de son fichier.',
    ]],
    preparer: ['Se préparer', [
      'Ayez une feuille et un stylo. Ni photo, ni capture d\'écran, ni fichier texte.',
      '24 mots est le format le plus courant. Les numéros secrets ne servent que pour Xaman (XRPL).',
    ]],
    mots: ['Écrire les mots', [
      'Écrivez chaque mot avec son numéro, dans l\'ordre.',
      '« Masquer les mots » les cache si quelqu\'un entre dans la pièce.',
    ]],
    verifier: ['Vérifier la copie', ['Une copie fausse se découvre ici, plutôt que le jour où vous en aurez besoin.']],
    restaurer: ['Restaurer', [
      'Saisissez les mots dans l\'ordre, une case par mot. Chaque mot est contrôlé dans la liste officielle.',
      'Un fichier wallet s\'ouvre avec le mot de passe choisi lors de son enregistrement.',
    ]],
    fichier: ['Fichier chiffré', [
      'Le fichier évite de retaper les mots à l\'étape 3. Il est chiffré avec votre mot de passe.',
      'Le mot de passe ne se récupère pas : s\'il est perdu, seuls vos mots permettent de retrouver le wallet.',
      'Sans fichier, vous signerez avec vos mots.',
    ]],
    termine: ['Terminé', [
      'L\'adresse publique se partage sans risque : c\'est elle qu\'on utilise à l\'étape 2.',
      'Le fichier d\'adresse publique ne contient aucun secret : il évite de recopier l\'adresse sur le poste en ligne.',
    ]],
  };
  const NUMEROS = /^[0-9]{6}$/;

  // Les secrets (mots, contenu du fichier wallet) restent en mémoire jusqu'à l'écran « Terminé ».
  const etat = { chaine: 'XRPL', parcours: 'creer' };
  let walletChoisi = null;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined) noeud.textContent = texte;
    return noeud;
  }

  function montrer(id, texte) {
    parId(id).textContent = texte;
    parId(id).hidden = !texte;
  }

  function presser(groupe, valeur) {
    for (const bouton of parId(groupe).querySelectorAll('button')) {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.valeur === valeur));
    }
  }

  function valeurPressee(groupe) {
    const bouton = parId(groupe).querySelector('[aria-pressed="true"]');
    return bouton ? bouton.dataset.valeur : null;
  }

  /** Champ contenant un secret : ni correcteur, ni majuscule automatique, ni mémorisation. */
  function secretiser(saisie) {
    saisie.setAttribute('autocomplete', 'off');
    saisie.setAttribute('spellcheck', 'false');
    saisie.setAttribute('autocapitalize', 'off');
    saisie.dataset.secret = '';
  }

  function telecharger(nom, contenu) {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/plain' }));
    lien.download = nom;
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
  }

  // ---------- Poste connecté ? ----------

  function actualiserBoutons() {
    const bloque = poste.bloque();
    for (const id of ['aller-creer', 'aller-restaurer', 'afficher-mots']) parId(id).disabled = bloque;
    const pret = etat.methode === 'fichier' ? !!walletChoisi : !!etat.saisieComplete;
    parId('restaurer').disabled = bloque || !pret;
    parId('enregistrer-wallet').disabled = bloque || !etat.motDePasseValable;
  }

  const poste = Poste.surveiller({
    etape: 'Étape 1 · Créer le wallet',
    blocage: 'création et restauration bloquées',
    auChangement: actualiserBoutons,
  });

  // ---------- Vues ----------

  function afficherVue(vue) {
    etat.vue = vue;
    for (const v of VUES) parId(`vue-${v}`).hidden = v !== vue;
    // Changer de réseau en cours de route rendrait faux les mots affichés.
    parId('reseau').disabled = vue !== 'choisir';
    const etapes = PARCOURS[etat.parcours];
    const rang = etapes.indexOf(vue);
    for (const li of document.querySelectorAll('.rail li[data-parcours]')) li.hidden = li.dataset.parcours !== etat.parcours;
    for (const bouton of document.querySelectorAll('[data-etape]')) {
      const i = etapes.indexOf(bouton.dataset.etape);
      bouton.classList.toggle('est-fait', i >= 0 && i < rang);
      if (i === rang) bouton.setAttribute('aria-current', 'step');
      else bouton.removeAttribute('aria-current');
    }
    const [titre, paragraphes] = AIDE[vue];
    parId('tiroir-aide-titre').textContent = `Aide · ${titre}`;
    parId('tiroir-aide-corps').replaceChildren(...paragraphes.map((texte) => element('p', '', texte)));
    poste.actualiser();
  }

  function choisirChaine(chaine) {
    etat.chaine = chaine;
    parId('reseau').value = chaine;
    parId('contexte-chaine').textContent = `Réseau : ${CHAINES[chaine]}`;
    document.title = `1 · Créer le wallet · ${CHAINES[chaine]}`;
    const xrpl = chaine === 'XRPL';
    parId('format-xaman').hidden = !xrpl;
    parId('methode-xaman').hidden = !xrpl;
    parId('format-aide').textContent = xrpl
      ? '24 et 12 mots se restaurent dans la plupart des wallets. Les numéros secrets (8 séries de 6 chiffres) servent pour Xaman.'
      : '24 et 12 mots se restaurent dans la plupart des wallets.';
    parId('restaurer-texte').textContent = xrpl
      ? "À partir de vos mots, de vos numéros secrets Xaman ou d'un fichier wallet."
      : "À partir de vos mots ou d'un fichier wallet.";
    if (!xrpl && valeurPressee('format') === 'xaman') presser('format', '24');
    actualiserBoutonAfficher();
  }

  function montrerAdresse(adresse) {
    parId('contexte-vide').hidden = !!adresse;
    parId('contexte-compte').hidden = !adresse;
    if (!adresse) return;
    parId('contexte-adresse').dataset.adresse = adresse;
    Interface.afficherAdresse(parId('contexte-adresse'));
  }

  function viderMotsDePasse() {
    for (const id of ['mot-de-passe', 'mot-de-passe-2', 'mot-de-passe-wallet']) {
      parId(id).value = '';
      parId(id).type = 'password';
    }
    for (const bouton of document.querySelectorAll('[data-basculer-secret]')) bouton.textContent = 'Afficher';
  }

  function oublierWallet() {
    walletChoisi = null;
    parId('fichier-wallet').value = '';
    parId('wallet-nom').textContent = 'Déposez ici votre fichier wallet';
    parId('depot-wallet').className = 'depot';
  }

  /** Efface l'écran et la mémoire de la page. La chaîne choisie est gardée. */
  function reinitialiser() {
    for (const cle of Object.keys(etat)) if (cle !== 'chaine') delete etat[cle];
    etat.parcours = 'creer';
    oublierWallet();
    viderMotsDePasse();
    parId('grille-mots').replaceChildren();
    parId('verifications-copie').replaceChildren();
    parId('grille-saisie').replaceChildren();
    parId('longueur-libre').value = '';
    parId('nombre-libre').value = '';
    presser('format', '24');
    montrer('erreur-restauration', '');
    parId('bilan').replaceChildren();
    parId('adresse-publique').replaceChildren();
    parId('algorithme').textContent = '';
    parId('cle-publique').textContent = '';
    montrerAdresse(null);
    choisirChaine(etat.chaine);
    afficherVue('choisir');
  }

  // ---------- Créer : format et affichage des mots ----------

  /** Nombre de mots choisi, ou 'xaman'. La longueur libre l'emporte si elle est valable. */
  function formatChoisi() {
    const libre = Number(parId('longueur-libre').value);
    if (Number.isInteger(libre) && libre >= 12 && libre <= 48) return libre;
    if (!valeurPressee('format')) presser('format', '24');
    const valeur = valeurPressee('format');
    return valeur === 'xaman' ? 'xaman' : Number(valeur);
  }

  function actualiserBoutonAfficher() {
    const format = formatChoisi();
    parId('afficher-mots').textContent = `Personne ne voit mon écran : ${format === 'xaman' ? 'afficher les numéros' : `afficher les ${format} mots`}`;
  }

  function dessinerMots() {
    const liste = etat.mots.split(' ');
    const grille = parId('grille-mots');
    grille.className = `mots${liste.length <= 8 ? ' mots--4-rangs' : liste.length <= 12 ? ' mots--6-rangs' : ''}`;
    grille.replaceChildren(...liste.map((mot, i) => {
      const li = element('li');
      li.append(element('span', 'mots__numero', String(i + 1)), element('span', 'mots__mot', etat.masque ? '•••••' : mot));
      return li;
    }));
    parId('masquer-mots').textContent = etat.masque ? 'Afficher les mots' : 'Masquer les mots';
  }

  async function afficherMots() {
    if (poste.bloque()) return;
    const format = formatChoisi();
    etat.xaman = format === 'xaman';
    etat.mots = etat.xaman ? Cles.genererNumerosXaman() : Cles.genererMots(format);
    etat.wallet = await Cles.creerWallet(etat.chaine, etat.mots);
    etat.masque = false;
    parId('titre-mots').textContent = etat.xaman ? 'Écrivez ces 8 séries de chiffres à la main' : `Écrivez ces ${format} mots à la main`;
    dessinerMots();
    montrerAdresse(etat.wallet.classicAddress);
    afficherVue('mots');
  }

  // ---------- Créer : vérification de la copie ----------

  function tirerPositions(total, combien) {
    const positions = new Set();
    const hasard = new Uint32Array(1);
    while (positions.size < Math.min(combien, total)) {
      globalThis.crypto.getRandomValues(hasard);
      positions.add(hasard[0] % total);
    }
    return [...positions].sort((a, b) => a - b);
  }

  function preparerVerification() {
    const libelle = etat.xaman ? 'Série' : 'Mot';
    const lignes = tirerPositions(etat.mots.split(' ').length, 3).map((position) => {
      const ligne = element('label', 'copie');
      const saisie = element('input', 'saisie saisie--donnees');
      saisie.type = 'text';
      saisie.dataset.position = String(position);
      saisie.setAttribute('aria-label', `${libelle} n° ${position + 1}`);
      if (etat.xaman) saisie.inputMode = 'numeric';
      secretiser(saisie);
      saisie.addEventListener('input', controlerCopie);
      const marque = element('span', 'copie__marque', '✓');
      marque.setAttribute('aria-hidden', 'true');
      ligne.append(element('span', '', `${libelle} n° ${position + 1}`), saisie, marque);
      return ligne;
    });
    parId('verifications-copie').replaceChildren(...lignes);
    parId('copie-verifiee').disabled = true;
    afficherVue('verifier');
    lignes[0].querySelector('input').focus();
  }

  function controlerCopie() {
    const liste = etat.mots.split(' ');
    let toutJuste = true;
    for (const saisie of parId('verifications-copie').querySelectorAll('input')) {
      const juste = saisie.value.trim().toLowerCase() === liste[Number(saisie.dataset.position)];
      saisie.nextElementSibling.classList.toggle('est-juste', juste);
      toutJuste = toutJuste && juste;
    }
    parId('copie-verifiee').disabled = !toutJuste;
  }

  // ---------- Restaurer ----------

  function nombreDeCases() {
    if (etat.methode === 'xaman') return 8;
    const choix = valeurPressee('nombre-mots');
    parId('bloc-nombre-libre').hidden = choix !== 'autre';
    if (choix !== 'autre') return Number(choix);
    const libre = Number(parId('nombre-libre').value);
    return Number.isInteger(libre) && libre >= 12 && libre <= 48 ? libre : null;
  }

  function construireSaisie() {
    const nombre = nombreDeCases();
    if (!nombre) return;
    const libelle = etat.methode === 'xaman' ? 'Série' : 'Mot';
    parId('grille-saisie').replaceChildren(...Array.from({ length: nombre }, (_, i) => {
      const case_ = element('label');
      const saisie = element('input', 'saisie saisie--donnees');
      saisie.type = 'text';
      saisie.id = `saisie-${i + 1}`;
      saisie.setAttribute('aria-label', `${libelle} n° ${i + 1}`);
      if (etat.methode === 'xaman') {
        saisie.inputMode = 'numeric';
        saisie.maxLength = 6;
      }
      secretiser(saisie);
      saisie.addEventListener('input', () => validerSaisie(saisie));
      saisie.addEventListener('change', () => validerSaisie());
      saisie.addEventListener('paste', (e) => coller(e, i));
      case_.append(element('span', 'mots__numero', String(i + 1)), saisie);
      return case_;
    }));
    validerSaisie();
  }

  function casesSaisie() {
    return [...parId('grille-saisie').querySelectorAll('input')];
  }

  /** Coller toute la phrase dans une case la répartit dans les cases suivantes. */
  function coller(evenement, depart) {
    const morceaux = (evenement.clipboardData.getData('text') || '').trim().split(/\s+/).filter(Boolean);
    if (morceaux.length < 2) return;
    evenement.preventDefault();
    if (etat.methode === 'mots' && depart === 0 && morceaux.length !== casesSaisie().length && morceaux.length >= 12 && morceaux.length <= 48) {
      const choix = morceaux.length === 12 || morceaux.length === 24 ? String(morceaux.length) : 'autre';
      presser('nombre-mots', choix);
      if (choix === 'autre') parId('nombre-libre').value = String(morceaux.length);
      construireSaisie();
    }
    const cases = casesSaisie();
    morceaux.forEach((morceau, i) => { if (cases[depart + i]) cases[depart + i].value = morceau.toLowerCase(); });
    validerSaisie();
  }

  /** Contrôle chaque case. enCours : la case en train d'être tapée, pas encore jugée. */
  function validerSaisie(enCours) {
    const liste = etat.methode === 'mots' ? Cles.listeMots() : null;
    const connus = liste ? new Set(liste) : null;
    const valable = (valeur) => (connus ? connus.has(valeur) : NUMEROS.test(valeur));
    const erreurs = [];
    casesSaisie().forEach((saisie, i) => {
      const valeur = saisie.value.trim().toLowerCase();
      const juste = !valeur || valable(valeur);
      if (saisie === enCours && !saisie.classList.contains('est-invalide')) return;
      saisie.classList.toggle('est-invalide', !juste);
      if (juste) return;
      if (connus) {
        const suggestion = Cles.suggererMot(valeur, liste);
        erreurs.push(`Mot n° ${i + 1} inconnu.${suggestion ? ` Vouliez-vous dire « ${suggestion} » ?` : ''}`);
      } else {
        erreurs.push(`Série n° ${i + 1} : 6 chiffres attendus.`);
      }
    });
    montrer('erreur-restauration', erreurs.join(' '));
    etat.saisieComplete = casesSaisie().length > 0 && casesSaisie().every((saisie) => valable(saisie.value.trim().toLowerCase()));
    actualiserBoutons();
  }

  function choisirMethode(methode) {
    etat.methode = methode;
    presser('methode', methode);
    parId('bloc-saisie').hidden = methode === 'fichier';
    parId('bloc-fichier').hidden = methode !== 'fichier';
    parId('nombre-mots').hidden = methode === 'xaman';
    parId('saisie-aide').textContent = methode === 'xaman'
      ? 'Une série de 6 chiffres par case. Vous pouvez coller les 8 séries d\'un coup dans la première case.'
      : 'Vous pouvez coller tous les mots d\'un coup dans la première case.';
    montrer('erreur-restauration', '');
    if (methode === 'fichier') parId('grille-saisie').replaceChildren();
    else construireSaisie();
    actualiserBoutons();
  }

  async function restaurerDepuisSaisie() {
    const secret = casesSaisie().map((saisie) => saisie.value.trim().toLowerCase()).join(' ');
    let wallet;
    try {
      wallet = await Cles.creerWallet(etat.chaine, secret);
    } catch {
      montrer('erreur-restauration', etat.methode === 'xaman'
        ? 'Ces numéros ne correspondent à aucun wallet : vérifiez chaque série.'
        : 'Impossible de retrouver un wallet à partir de ces mots.');
      return;
    }
    Object.assign(etat, {
      mots: secret, wallet, xaman: etat.methode === 'xaman',
      nonStandard: !Cles.verifierMots(secret).standard,
      source: etat.methode === 'xaman' ? 'Wallet retrouvé à partir de vos numéros secrets' : 'Wallet retrouvé à partir de vos mots',
    });
    for (const saisie of casesSaisie()) saisie.value = '';
    parId('grille-saisie').replaceChildren();
    afficherFichier();
  }

  async function restaurerDepuisFichier() {
    const nom = parId('wallet-nom').textContent;
    let lu;
    try {
      lu = await Coffre.lireFichierWallet(walletChoisi, parId('mot-de-passe-wallet').value);
    } catch (erreur) {
      // Le fichier reste choisi : seul le mot de passe est à ressaisir.
      montrer('erreur-restauration', erreur instanceof Coffre.ErreurMotDePasse ? erreur.message : 'Ce fichier wallet est illisible.');
      return;
    } finally {
      viderMotsDePasse();
    }
    const contenu = lu.wallet;
    if (!contenu || typeof contenu.seed !== 'string') {
      montrer('erreur-restauration', 'Ce fichier wallet est illisible.');
      return;
    }
    const chaineFichier = contenu.seedHex ? 'XLM' : 'XRPL';
    if (chaineFichier !== etat.chaine) {
      montrer('erreur-restauration', `Ce fichier est un wallet ${CHAINES[chaineFichier]} : choisissez ${CHAINES[chaineFichier]} à l'écran précédent.`);
      return;
    }
    let wallet;
    try {
      wallet = await Cles.creerWallet(etat.chaine, contenu.seed);
    } catch {
      montrer('erreur-restauration', 'Ce fichier wallet est illisible.');
      return;
    }
    if (contenu.classicAddress && contenu.classicAddress !== wallet.classicAddress) {
      montrer('erreur-restauration', "Ce fichier wallet est incohérent : ses mots ne donnent pas l'adresse qu'il indique.");
      return;
    }
    Object.assign(etat, {
      mots: contenu.seed, wallet, xaman: /^[0-9 ]+$/.test(contenu.seed),
      nonStandard: !Cles.verifierMots(contenu.seed).standard,
      enClair: !lu.chiffre, source: `Wallet retrouvé à partir du fichier ${nom}`,
    });
    oublierWallet();
    afficherFichier();
  }

  async function restaurer() {
    if (poste.bloque()) return;
    montrer('erreur-restauration', '');
    if (etat.methode === 'fichier') await restaurerDepuisFichier();
    else await restaurerDepuisSaisie();
  }

  // ---------- Fichier chiffré ----------

  function afficherFichier() {
    montrerAdresse(etat.wallet.classicAddress);
    parId('note-en-clair').hidden = !etat.enClair;
    parId('note-non-standard').hidden = !(etat.parcours === 'restaurer' && etat.nonStandard);
    parId('nom-wallet').textContent = Fichiers.nomFichierWallet(etat.chaine, etat.wallet.classicAddress);
    viderMotsDePasse();
    controlerMotDePasse();
    afficherVue('fichier');
  }

  function controlerMotDePasse() {
    const motDePasse = parId('mot-de-passe').value;
    const confirmation = parId('mot-de-passe-2').value;
    const { niveau, bloquant } = Securite.robustesseMotDePasse(motDePasse);
    parId('jauge').dataset.niveau = niveau;
    parId('jauge-texte').textContent = JAUGE[niveau];
    const identiques = motDePasse === confirmation;
    const correspondance = parId('correspondance');
    correspondance.textContent = !confirmation ? '' : identiques ? 'Les deux mots de passe correspondent.' : 'Les deux mots de passe sont différents.';
    correspondance.className = confirmation && !identiques ? 'champ__erreur' : 'champ__aide';
    etat.motDePasseValable = !bloquant && identiques;
    actualiserBoutons();
  }

  async function enregistrerWallet() {
    if (poste.bloque() || !etat.motDePasseValable) return;
    const nom = Fichiers.nomFichierWallet(etat.chaine, etat.wallet.classicAddress);
    const contenu = await Coffre.chiffrerWallet(etat.wallet, parId('mot-de-passe').value);
    viderMotsDePasse();
    telecharger(nom, contenu);
    etat.fichierWallet = nom;
    afficherTermine();
  }

  // ---------- Terminé ----------

  function afficherTermine() {
    viderMotsDePasse();
    const { classicAddress: adresse, publicKey } = etat.wallet;
    const creation = etat.parcours === 'creer';
    parId('titre-termine').textContent = creation ? 'Wallet prêt' : 'Wallet retrouvé';
    const bilan = [];
    if (creation) bilan.push(element('li', '', etat.xaman ? 'Numéros secrets écrits et vérifiés' : `${etat.mots.split(' ').length} mots écrits et vérifiés`));
    else bilan.push(element('li', '', etat.source));
    bilan.push(etat.fichierWallet
      ? element('li', '', `Fichier chiffré enregistré : ${etat.fichierWallet}`)
      : element('li', 'est-neutre', 'Pas de fichier wallet : vous signerez avec vos mots.'));
    parId('bilan').replaceChildren(...bilan);
    parId('libelle-adresse').textContent = `Adresse publique ${CHAINES[etat.chaine]}`;
    parId('adresse-publique').dataset.adresse = adresse;
    Interface.afficherAdresse(parId('adresse-publique'));
    parId('algorithme').textContent = ALGORITHMES[etat.chaine];
    parId('cle-publique').textContent = publicKey;
    parId('nom-adresse').textContent = Fichiers.nomFichierAdressePublique(etat.chaine, adresse);
    // Les secrets ne servent plus : seule l'adresse publique est gardée.
    etat.adresse = adresse;
    etat.mots = null;
    etat.wallet = null;
    afficherVue('termine');
  }

  function enregistrerAdresse() {
    telecharger(Fichiers.nomFichierAdressePublique(etat.chaine, etat.adresse), `${etat.adresse}\n`);
  }

  // ---------- Branchements ----------

  parId('reseau').addEventListener('change', () => choisirChaine(parId('reseau').value));
  parId('aller-creer').addEventListener('click', () => {
    if (poste.bloque()) return;
    etat.parcours = 'creer';
    afficherVue('preparer');
  });
  parId('aller-restaurer').addEventListener('click', () => {
    if (poste.bloque()) return;
    etat.parcours = 'restaurer';
    presser('nombre-mots', '12');
    choisirMethode('mots');
    afficherVue('restaurer');
  });
  for (const bouton of document.querySelectorAll('[data-retour]')) bouton.addEventListener('click', reinitialiser);

  parId('format').addEventListener('change', () => {
    parId('longueur-libre').value = '';
    actualiserBoutonAfficher();
  });
  parId('longueur-libre').addEventListener('input', () => {
    const libre = Number(parId('longueur-libre').value);
    if (Number.isInteger(libre) && libre >= 12 && libre <= 48) presser('format', null);
    actualiserBoutonAfficher();
  });
  parId('afficher-mots').addEventListener('click', afficherMots);
  parId('masquer-mots').addEventListener('click', () => {
    etat.masque = !etat.masque;
    dessinerMots();
  });
  parId('mots-ecrits').addEventListener('click', preparerVerification);
  parId('revoir-mots').addEventListener('click', () => {
    parId('verifications-copie').replaceChildren();
    afficherVue('mots');
  });
  parId('copie-verifiee').addEventListener('click', () => {
    parId('verifications-copie').replaceChildren();
    afficherFichier();
  });

  parId('methode').addEventListener('change', (e) => choisirMethode(e.detail.valeur));
  parId('nombre-mots').addEventListener('change', construireSaisie);
  parId('nombre-libre').addEventListener('input', construireSaisie);
  parId('fichier-wallet').addEventListener('change', async () => {
    const fichier = parId('fichier-wallet').files[0];
    if (!fichier) return;
    walletChoisi = await fichier.text();
    parId('wallet-nom').textContent = fichier.name;
    parId('depot-wallet').className = 'depot depot--charge';
    montrer('erreur-restauration', '');
    actualiserBoutons();
  });
  parId('mot-de-passe-wallet').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !parId('restaurer').disabled) restaurer(); });
  parId('restaurer').addEventListener('click', restaurer);

  parId('mot-de-passe').addEventListener('input', controlerMotDePasse);
  parId('mot-de-passe-2').addEventListener('input', controlerMotDePasse);
  parId('enregistrer-wallet').addEventListener('click', enregistrerWallet);
  parId('sans-fichier').addEventListener('click', () => {
    etat.fichierWallet = null;
    afficherTermine();
  });

  parId('enregistrer-adresse').addEventListener('click', enregistrerAdresse);
  parId('terminer').addEventListener('click', reinitialiser);

  choisirChaine('XRPL');
  afficherVue('choisir');
})();
