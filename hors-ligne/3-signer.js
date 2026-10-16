// Étape 3 · vérifier puis signer une transaction, sur le poste hors ligne.
// On ne signe que ce qu'on sait traduire en clair, après l'avoir montré.
// Les secrets (mot de passe, mots) sont retirés des champs dès qu'ils ont servi.
(function () {
  'use strict';

  const { Format, Fichiers, Transactions, Bordereau, Coffre, Cles, Interface } = window.Commun;

  const parId = (id) => document.getElementById(id);
  const VUES = ['charger', 'verifier', 'cle', 'signer', 'enregistrer'];
  const AIDE = {
    charger: ['Charger la transaction', [
      "Le fichier .a-signer.json vient de l'étape 2, préparée sur le poste en ligne.",
      'Ce poste ne doit jamais être connecté à un réseau. Si un réseau est détecté, les clés et la signature sont bloquées.',
    ]],
    verifier: ['Vérifier', [
      "C'est ici, hors ligne, que vous validez ce que vous signez.",
      'Comparez avec ce que vous avez préparé : montant, destinataire en entier, tag.',
      "Pour XRPL, ce poste ne peut pas savoir si la transaction est pour Mainnet ou Testnet : vérifiez-la toujours comme si les fonds étaient réels.",
      "L'empreinte doit être la même qu'à l'étape 2.",
    ]],
    cle: ['Choisir la clé', [
      'Fichier wallet avec son mot de passe, ou vos mots.',
      'La page indique quelle clé signera. Une clé qui ne correspond pas au compte est refusée.',
    ]],
    signer: ['Signer', ["Maintenez le bouton enfoncé un peu plus d'une seconde. Relâcher avant la fin annule le geste."]],
    enregistrer: ['Enregistrer', [
      'Enregistrez le fichier .signee.json sur la clé USB.',
      "Chargez-le à l'étape 4, sur le poste en ligne, avant l'heure limite.",
    ]],
  };
  const LIBELLE_SIGNER = 'Maintenir pour signer';
  const etat = {};
  let walletChoisi = null; // contenu du fichier wallet déposé, gardé jusqu'au déverrouillage

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

  function adresseCourte(adresse) {
    return `${adresse.slice(0, 4)} … ${adresse.slice(-4)}`;
  }

  function montantLisible(montant) {
    try {
      return Format.formaterMontant(montant);
    } catch {
      return String(montant);
    }
  }

  // ---------- Poste connecté ? (constat F-07) ----------

  const poste = window.Commun.Poste.surveiller({
    etape: 'Étape 3 · Signer',
    blocage: 'clés et signature bloquées',
    auChangement: ({ connecte, bloque }) => {
      parId('ouvrir-fichier').disabled = bloque;
      parId('ouvrir-mots').disabled = bloque;
      parId('bouton-signer').disabled = bloque || !etat.cle;
      parId('bouton-signer').classList.toggle('est-risque', connecte);
    },
  });
  const posteBloque = poste.bloque;
  const actualiserPoste = poste.actualiser;

  // ---------- Vues ----------

  function afficherVue(vue) {
    etat.vue = vue;
    const rang = VUES.indexOf(vue);
    for (const v of VUES) parId(`vue-${v}`).hidden = v !== vue;
    for (const bouton of document.querySelectorAll('[data-etape]')) {
      const i = Number(bouton.dataset.etape);
      bouton.classList.toggle('est-fait', i < rang);
      if (i === rang) bouton.setAttribute('aria-current', 'step');
      else bouton.removeAttribute('aria-current');
      // Revenir en arrière n'a de sens qu'avant la signature.
      bouton.disabled = !(i < rang && rang < 4);
    }
    parId('contexte-vide').hidden = rang > 0;
    parId('contexte-conseils').hidden = rang !== 1;
    parId('contexte-recap').hidden = rang < 2;
    parId('contexte-titre').textContent = rang === 1 ? 'Comment vérifier' : 'Ce que vous signez';
    const [titre, paragraphes] = AIDE[vue];
    parId('tiroir-aide-titre').textContent = `Aide · ${titre}`;
    parId('tiroir-aide-corps').replaceChildren(...paragraphes.map((texte) => element('p', '', texte)));
    actualiserPoste();
  }

  function viderChampsSecrets() {
    for (const id of ['mot-de-passe', 'mots']) {
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

  function reinitialiser() {
    viderChampsSecrets();
    oublierWallet();
    for (const cle of Object.keys(etat)) delete etat[cle];
    parId('fichier').value = '';
    parId('contenu-colle').value = '';
    refuser('');
    montrer('erreur-cle', '');
    parId('cle-reconnue').hidden = true;
    parId('vers-signature').disabled = true;
    montrer('erreur-signature', '');
    remettreBoutonSigner();
    parId('reseau-lu').textContent = 'lu dans le fichier';
    parId('reseau-lu').classList.add('est-attente');
    parId('bandeau-testnet').hidden = true;
    parId('technique-contenu').textContent = '';
    document.title = '3 · Signer';
    afficherVue('charger');
  }

  // ---------- Chargement ----------

  function refuser(message, contenuBrut) {
    montrer('erreur-chargement', message);
    parId('contenu-refuse').hidden = !contenuBrut;
    parId('contenu-refuse-texte').textContent = contenuBrut || '';
  }

  async function charger(texte, nom) {
    refuser('');
    let objet;
    try {
      objet = JSON.parse(texte);
    } catch {
      refuser("Ce fichier n'est pas une transaction. S'il s'agit de votre fichier wallet, chargez-le à l'étape « Choisir la clé ».");
      return;
    }
    if (Fichiers.estFichierWallet(objet)) {
      refuser("Ce fichier est un wallet : chargez-le à l'étape « Choisir la clé ».");
      return;
    }
    const { chaine, reseau, signee, transaction, autorises } = Fichiers.identifierTransaction(objet);
    if (!chaine) {
      refuser("Ce fichier n'est pas une transaction, ou son contenu est incohérent.");
      return;
    }
    const dejaSignee = "Cette transaction est déjà signée. Ouvrez-la à l'étape 4, sur le poste en ligne.";
    if (signee === true) {
      refuser(dejaSignee);
      return;
    }
    let decodee;
    try {
      decodee = Transactions.decoder(chaine, transaction);
    } catch {
      refuser('Cette transaction est illisible : le fichier est peut-être abîmé.');
      return;
    }
    if (decodee.signee) {
      refuser(dejaSignee);
      return;
    }
    if (decodee.operation === 'inconnue') {
      refuser(`Signature impossible : cette page ne sait pas traduire cette transaction (${decodee.raison}). L'étape 2 ne prépare jamais ce type de transaction : ce fichier vient d'un autre outil, ou il a été modifié.`,
        JSON.stringify(decodee.brut, null, 2));
      return;
    }

    Object.assign(etat, { chaine, reseau, transaction, decodee, autorises, nom });
    etat.empreinte = await Transactions.empreinte(chaine, transaction);
    parId('fichier-nom').textContent = nom;
    parId('empreinte').textContent = Format.formaterEmpreinte(etat.empreinte);
    parId('recap-empreinte').textContent = Format.formaterEmpreinte(etat.empreinte);
    parId('technique-legende').textContent = 'Contenu décodé de la transaction à signer.';
    parId('technique-contenu').textContent = JSON.stringify(decodee.brut, null, 2);
    // T-08 : rien dans une transaction XRPL ne distingue Mainnet de Testnet, et le champ « reseau »
    // du fichier n'est pas protégé. On n'affiche donc le réseau que pour Stellar, où il est signé.
    etat.reseauAffiche = chaine === 'XLM' ? reseau : null;
    Bordereau.remplir(parId('bordereau'), decodee, etat.reseauAffiche, { sansReseau: !etat.reseauAffiche });
    const libelle = Transactions.libelleReseau(chaine, etat.reseauAffiche);
    parId('reseau-lu').textContent = etat.reseauAffiche ? `${libelle} · ${Transactions.libelleFonds(etat.reseauAffiche)}` : libelle;
    parId('reseau-lu').classList.remove('est-attente');
    parId('bandeau-testnet').hidden = etat.reseauAffiche !== 'test';
    parId('conseil-reseau').hidden = !etat.reseauAffiche;
    document.title = `3 · Signer · ${libelle}`;
    remplirRecapitulatif();
    afficherVue('verifier');
  }

  function remplirAdresse(id, adresse) {
    const noeud = parId(id);
    noeud.hidden = !adresse;
    if (!adresse) return;
    noeud.dataset.adresse = adresse;
    Interface.afficherAdresse(noeud);
  }

  function remplirRecapitulatif() {
    const d = etat.decodee;
    parId('recap-type').textContent = Transactions.LIBELLES[d.operation];
    const montant = parId('recap-montant');
    montant.hidden = !d.montant;
    if (d.montant) montant.replaceChildren(element('span', '', montantLisible(d.montant)), element('span', 'montant__devise', d.devise));
    remplirAdresse('recap-vers', d.vers);
  }

  // ---------- Clé ----------

  function choisirMethode(methode) {
    parId('bloc-fichier').hidden = methode !== 'fichier';
    parId('bloc-mots').hidden = methode !== 'mots';
    montrer('erreur-cle', '');
  }

  /**
   * Rôle de la clé ouverte : { role, texte, attention } ou { refus }.
   * Toute clé autre que celle du compte signe comme signataire (multisignature).
   */
  function reconnaitre(adresse) {
    const compte = etat.decodee.de;
    const autorises = etat.autorises; // null : ancien format, la liste n'est pas connue
    if (adresse === compte) {
      if (autorises && !autorises.includes(compte)) {
        return { refus: 'La clé principale de ce compte est désactivée : signez avec la clé du signataire.' };
      }
      return { role: 'principale', texte: `Clé reconnue : clé principale du compte ${adresseCourte(compte)}.` };
    }
    if (autorises) {
      if (autorises.includes(adresse)) return { role: 'signataire', texte: `Clé reconnue : signataire autorisé ${adresseCourte(adresse)}.` };
      return { refus: `Cette clé (${adresseCourte(adresse)}) ne correspond ni au compte ${adresseCourte(compte)}, ni à un signataire autorisé.` };
    }
    return {
      role: 'signataire',
      attention: true,
      texte: `Cette clé (${adresseCourte(adresse)}) n'est pas celle du compte : elle signera comme signataire. Le fichier n'indique pas les signataires autorisés : assurez-vous que ce compte l'est.`,
    };
  }

  /** source : { wallet } ou { mots }. indice : phrase ajoutée à un refus. */
  async function ouvrir(source, indice) {
    montrer('erreur-cle', '');
    parId('cle-reconnue').hidden = true;
    parId('vers-signature').disabled = true;
    etat.cle = null;
    try {
      const cle = await Cles.ouvrirCle(etat.chaine, source);
      const reconnaissance = reconnaitre(cle.adresse);
      if (reconnaissance.refus) {
        montrer('erreur-cle', `${reconnaissance.refus} ${indice || 'Vérifiez le fichier wallet ou les mots.'}`);
        return;
      }
      Object.assign(etat, { cle, role: reconnaissance.role });
      const ligne = parId('cle-reconnue');
      ligne.className = reconnaissance.attention ? 'message message--attention' : 'etat';
      ligne.textContent = reconnaissance.texte;
      ligne.hidden = false;
      parId('vers-signature').disabled = false;
    } catch {
      montrer('erreur-cle', `Impossible de retrouver la clé à partir de ces informations. ${indice || ''}`.trim());
    } finally {
      viderChampsSecrets();
      oublierWallet();
    }
  }

  async function ouvrirDepuisFichier() {
    if (posteBloque()) return;
    if (!walletChoisi) {
      montrer('erreur-cle', "Déposez d'abord votre fichier wallet.");
      return;
    }
    let wallet;
    try {
      ({ wallet } = await Coffre.lireFichierWallet(walletChoisi, parId('mot-de-passe').value));
    } catch (erreur) {
      // Le fichier reste choisi : seul le mot de passe est à ressaisir.
      viderChampsSecrets();
      montrer('erreur-cle', erreur instanceof Coffre.ErreurMotDePasse ? erreur.message : 'Ce fichier wallet est illisible.');
      return;
    }
    await ouvrir({ wallet });
  }

  async function ouvrirDepuisMots() {
    if (posteBloque()) return;
    const mots = parId('mots').value;
    const controle = Cles.verifierMots(mots);
    if (controle.inconnus.length) {
      // Les mots restent dans le champ (masqués) pour corriger la faute ; seule la position est montrée.
      const positions = mots.trim().toLowerCase().split(/\s+/)
        .map((mot, i) => (controle.inconnus.includes(mot) ? i + 1 : 0)).filter(Boolean);
      montrer('erreur-cle', `${positions.length === 1 ? 'Le mot n° ' : 'Les mots n° '}${positions.join(', ')} ${positions.length === 1 ? "n'existe" : "n'existent"} pas dans la liste officielle. Vérifiez l'orthographe.`);
      return;
    }
    await ouvrir({ mots }, controle.standard ? '' : "Ces mots ne forment pas une phrase standard : vérifiez leur ordre et qu'aucun ne manque.");
  }

  // ---------- Signature ----------

  function multisignatureXrpl() {
    return etat.chaine === 'XRPL' && etat.role === 'signataire';
  }

  function preparerSignature() {
    const d = etat.decodee;
    const resume = parId('resume-signature');
    resume.replaceChildren(`Vous signez : ${Transactions.LIBELLES[d.operation].toLowerCase()}`);
    if (d.montant) resume.append(' de ', element('b', '', `${montantLisible(d.montant)} ${d.devise}`));
    if (etat.reseauAffiche) resume.append(` sur ${Transactions.libelleReseau(etat.chaine, etat.reseauAffiche)}`);
    resume.append(d.vers ? ', vers :' : '.');
    remplirAdresse('resume-destinataire', d.vers);
    parId('note-frais').hidden = !multisignatureXrpl();
    if (multisignatureXrpl()) {
      const doubles = Transactions.versionMultisignature(etat.transaction).Fee;
      parId('note-frais').textContent = `Signature par un signataire : les frais passent de ${montantLisible(Transactions.dropsEnXrp(etat.transaction.Fee))} à ${montantLisible(Transactions.dropsEnXrp(doubles))} XRP, comme l'exige le réseau.`;
    }
    afficherVue('signer');
  }

  function remettreBoutonSigner() {
    const bouton = parId('bouton-signer');
    bouton.classList.remove('est-confirme', 'est-maintenu');
    bouton.querySelector('.bouton__libelle').textContent = LIBELLE_SIGNER;
  }

  async function signer() {
    montrer('erreur-signature', '');
    if (posteBloque() || !etat.cle) {
      remettreBoutonSigner();
      return;
    }
    try {
      const signee = etat.chaine === 'XRPL'
        ? etat.cle.signer(multisignatureXrpl() ? Transactions.versionMultisignature(etat.transaction) : { ...etat.transaction }, multisignatureXrpl())
        : etat.cle.signer(etat.transaction);
      etat.cle = null; // la clé ne sert plus
      const d = etat.decodee;
      const empreinte = await Transactions.empreinte(etat.chaine, signee);
      const details = d.operation === 'paiement' ? [d.montant, d.devise] : d.operation.startsWith('jeton-') ? [d.devise] : [];
      etat.nomSignee = Fichiers.nomFichierTransaction({
        chaine: etat.chaine, reseau: etat.reseau, date: new Date(), operation: d.operation, details, empreinte, etape: 'signee',
      });
      // Réseau inconnu (ancien fichier XRPL) : on garde l'ancien format, l'étape 4 demandera le réseau.
      etat.contenuSigne = etat.reseau
        ? Fichiers.envelopperTransaction({ chaine: etat.chaine, reseau: etat.reseau, etape: 'signee', transaction: signee, autorises: etat.autorises || [] })
        : signee;
      parId('nom-signee').textContent = etat.nomSignee;
      parId('empreinte-signee').textContent = Format.formaterEmpreinte(empreinte);
      parId('technique-legende').textContent = "Transaction signée, telle qu'elle sera enregistrée.";
      parId('technique-contenu').textContent = JSON.stringify(signee, null, 2);
      afficherVue('enregistrer');
    } catch (erreur) {
      remettreBoutonSigner();
      montrer('erreur-signature', `La signature a échoué : ${(erreur && erreur.message) || erreur}`);
    }
  }

  function enregistrer() {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([JSON.stringify(etat.contenuSigne, null, 2)], { type: 'application/json' }));
    lien.download = etat.nomSignee;
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
  }

  // ---------- Branchements ----------

  async function chargerFichier(fichier) {
    if (fichier) await charger(await fichier.text(), fichier.name);
  }

  parId('fichier').addEventListener('change', () => chargerFichier(parId('fichier').files[0]));
  parId('depot').addEventListener('dragover', (e) => e.preventDefault());
  parId('depot').addEventListener('drop', (e) => {
    e.preventDefault();
    chargerFichier(e.dataTransfer.files[0]);
  });
  parId('utiliser-colle').addEventListener('click', () => charger(parId('contenu-colle').value, 'contenu collé'));

  parId('pas-la-bonne').addEventListener('click', reinitialiser);
  parId('choisir-cle').addEventListener('click', () => afficherVue('cle'));
  parId('methode').addEventListener('change', (e) => choisirMethode(e.detail.valeur));
  parId('fichier-wallet').addEventListener('change', async () => {
    const fichier = parId('fichier-wallet').files[0];
    if (!fichier) return;
    walletChoisi = await fichier.text();
    parId('wallet-nom').textContent = fichier.name;
    parId('depot-wallet').className = 'depot depot--charge';
  });
  parId('ouvrir-fichier').addEventListener('click', ouvrirDepuisFichier);
  parId('mot-de-passe').addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrirDepuisFichier(); });
  parId('ouvrir-mots').addEventListener('click', ouvrirDepuisMots);
  parId('vers-signature').addEventListener('click', preparerSignature);
  parId('bouton-signer').addEventListener('confirme', signer);
  parId('enregistrer').addEventListener('click', enregistrer);
  parId('terminer').addEventListener('click', reinitialiser);
  for (const bouton of document.querySelectorAll('[data-etape]')) {
    bouton.addEventListener('click', () => {
      const cible = VUES[Number(bouton.dataset.etape)];
      if (cible === 'charger') reinitialiser();
      else afficherVue(cible);
    });
  }

  afficherVue('charger');
})();
