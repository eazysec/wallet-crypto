// Étape 2 · préparer une transaction sur le poste en ligne, puis l'exporter pour la signer hors ligne.
// Le fichier exporté porte la chaîne, le réseau et les comptes dont la clé peut signer.
// Le texte est écrit avec textContent : rien de ce que renvoie le réseau n'est interprété.
(function () {
  'use strict';

  const { Format, Fichiers, Reseau, Transactions, Bordereau, Connexion, Historique, Interface } = window.Commun;
  const { xrpl, StellarSdk } = window.SecureWalletBundle;
  const historique = Historique.historiqueDuNavigateur();

  const parId = (id) => document.getElementById(id);
  const etat = { chaine: 'XRPL', reseau: 'main', compte: null, preparation: null, operation: 'envoyer' };

  const VUES = ['compte', 'envoyer', 'jeton-ajout', 'jeton-retrait', 'signataires', 'suppression', 'verifier', 'exporte'];
  const AIDE = {
    compte: ['Votre compte', [
      "Saisissez l'adresse publique du compte, ou chargez le fichier d'adresse publique créé à l'étape 1.",
      "Cette page ne demande jamais de mots ni de mot de passe : il n'y a aucun secret sur ce poste.",
    ]],
    envoyer: ['Envoyer des fonds', [
      "Le tag de destination identifie votre compte chez une plateforme d'échange. Sans lui, les fonds arrivent sur la plateforme mais ne sont pas crédités sur votre compte.",
      "La réserve est une petite somme bloquée par le réseau tant que le compte existe. Elle n'est pas dépensable.",
      'Une adresse jamais utilisée depuis ce poste est signalée. Vérifiez-la en entier : les adresses pièges imitent le début et la fin.',
    ]],
    'jeton-ajout': ['Autoriser un jeton', [
      "L'autorisation permet à votre compte de recevoir ce jeton, jusqu'au plafond choisi.",
      "Vérifiez l'adresse de l'émetteur auprès d'une source fiable.",
    ]],
    'jeton-retrait': ['Retirer un jeton', ['Un jeton ne peut être retiré que si son solde est à zéro.']],
    signataires: ['Signataires et clé principale', [
      'Un signataire est un autre compte autorisé à signer pour celui-ci.',
      'Testez une signature avec le signataire avant de désactiver la clé principale.',
    ]],
    suppression: ['Supprimer le compte', [
      'La suppression est définitive : le compte disparaît du réseau.',
      'Les jetons doivent être retirés avant.',
    ]],
    verifier: ['Vérifier avant d\'exporter', [
      "L'empreinte permet de reconnaître la même transaction aux étapes 3 et 4.",
      "Passé l'heure limite, le réseau refuse la transaction. Il suffit alors de la préparer à nouveau.",
    ]],
    exporte: ['Après l\'export', ["Copiez le fichier sur la clé USB, puis ouvrez l'étape 3 sur le poste hors ligne."]],
  };

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined) noeud.textContent = texte;
    return noeud;
  }

  function lisible(montant) {
    try {
      return Format.formaterMontant(montant);
    } catch {
      return String(montant);
    }
  }

  // ---------- Montants exacts (entiers) ----------

  function enEntier(montant, decimales) {
    const [entier, fraction = ''] = String(montant).split('.');
    return BigInt(entier + fraction.padEnd(decimales, '0').slice(0, decimales));
  }

  function depuisEntier(valeur, decimales) {
    const entier = valeur < 0n ? 0n : valeur;
    return decimales === 6 ? Transactions.dropsEnXrp(String(entier)) : Transactions.stroopsEnXlm(String(entier));
  }

  // ---------- Particularités des chaînes ----------

  const CHAINES = {
    XRPL: {
      devise: 'XRP', decimales: 6, fraisEstimes: 12n, libelleTag: 'Tag de destination',
      adresseValide: (a) => xrpl.isValidClassicAddress(a),
      tagValide: (t) => /^(0|[1-9]\d{0,9})$/.test(t) && Number(t) <= 4294967295,
      erreurTag: 'Le tag est un nombre entier, sans espace.',
    },
    XLM: {
      devise: 'XLM', decimales: 7, fraisEstimes: 100n, libelleTag: 'Mémo',
      adresseValide: (a) => StellarSdk.StrKey.isValidEd25519PublicKey(a),
      tagValide: (t) => new TextEncoder().encode(t).length <= 28,
      erreurTag: 'Le mémo ne doit pas dépasser 28 caractères.',
    },
  };
  const chaine = () => CHAINES[etat.chaine];

  // ---------- Lecture du compte ----------

  async function lireCompteXrpl(adresse) {
    const client = await Connexion.clientXrpl(etat.reseau);
    const info = await client.request({ command: 'account_info', account: adresse, ledger_index: 'validated', signer_lists: true });
    const serveur = await client.request({ command: 'server_info' });
    const lignes = await client.request({ command: 'account_lines', account: adresse, ledger_index: 'validated' });
    const registre = serveur.result.info.validated_ledger;
    const donnees = info.result.account_data;
    // T-02 : la réserve compte les objets du compte (OwnerCount).
    const reserve = BigInt(Math.round((registre.reserve_base_xrp + (donnees.OwnerCount || 0) * registre.reserve_inc_xrp) * 1e6));
    const solde = BigInt(donnees.Balance);
    const listes = info.result.signer_lists || donnees.signer_lists || [];
    const signataires = listes.length ? listes[0].SignerEntries.map((e) => e.SignerEntry.Account) : [];
    const drapeaux = info.result.account_flags;
    const principaleActive = drapeaux ? !drapeaux.disableMasterKey : (donnees.Flags & 0x00100000) === 0;
    return {
      adresse, signataires, principaleActive, sequence: donnees.Sequence, registre: registre.seq,
      solde: depuisEntier(solde, 6), reserve: depuisEntier(reserve, 6), disponible: depuisEntier(solde - reserve, 6),
      jetons: lignes.result.lines.map((l) => ({ code: Transactions.deviseLisible(l.currency), codeBrut: l.currency, emetteur: l.account, solde: l.balance })),
      // La clé ordinaire (RegularKey) n'est pas prise en charge : l'étape 3 signe toute autre clé en multisignature.
      autorises: [...(principaleActive ? [adresse] : []), ...signataires],
    };
  }

  async function lireCompteStellar(adresse) {
    const compte = await Connexion.serveurStellar(etat.reseau).loadAccount(adresse);
    const natif = compte.balances.find((b) => b.asset_type === 'native');
    const solde = enEntier(natif.balance, 7);
    const reserve = 5000000n * BigInt(2 + compte.subentry_count); // 0,5 XLM par entrée
    const principale = compte.signers.find((s) => s.key === adresse);
    const principaleActive = !principale || principale.weight > 0;
    const signataires = compte.signers.filter((s) => s.key !== adresse && s.weight > 0).map((s) => s.key);
    return {
      adresse, signataires, principaleActive,
      solde: depuisEntier(solde, 7), reserve: depuisEntier(reserve, 7), disponible: depuisEntier(solde - reserve, 7),
      jetons: compte.balances.filter((b) => b.asset_type !== 'native' && b.asset_code)
        .map((b) => ({ code: b.asset_code, codeBrut: b.asset_code, emetteur: b.asset_issuer, solde: Transactions.montantStellar(b.balance) })),
      autorises: [...(principaleActive ? [adresse] : []), ...signataires],
    };
  }

  function messageErreur(erreur) {
    if (!erreur) return 'erreur inconnue';
    const donnees = erreur.response && erreur.response.data;
    if (donnees && donnees.extras && donnees.extras.result_codes) return JSON.stringify(donnees.extras.result_codes);
    if (donnees && donnees.title) return donnees.title;
    return String(erreur.message || erreur);
  }

  function compteAbsent(erreur) {
    return (erreur && erreur.data && erreur.data.error === 'actNotFound')
      || (erreur && erreur.response && erreur.response.status === 404)
      || (erreur && erreur.name === 'NotFoundError');
  }

  // ---------- Préparation ----------

  async function preparerXrpl(transaction) {
    const client = await Connexion.clientXrpl(etat.reseau);
    const preparee = await client.autofill({ Account: etat.compte.adresse, ...transaction });
    const indice = await client.getLedgerIndex();
    preparee.LastLedgerSequence = indice + Reseau.registresPourDuree(Reseau.DUREE_VALIDITE_SECONDES);
    return preparee;
  }

  async function preparerStellar(operation, memo) {
    const serveur = Connexion.serveurStellar(etat.reseau);
    const compte = await serveur.loadAccount(etat.compte.adresse);
    const frais = await serveur.fetchBaseFee();
    const phrase = etat.reseau === 'main' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;
    let constructeur = new StellarSdk.TransactionBuilder(compte, { fee: frais, networkPassphrase: phrase })
      .addOperation(operation)
      .setTimeout(Reseau.DUREE_VALIDITE_SECONDES);
    if (memo) constructeur = constructeur.addMemo(StellarSdk.Memo.text(memo));
    return { XDR: constructeur.build().toXDR(), Network: phrase };
  }

  async function stellarExiste(adresse) {
    try {
      await Connexion.serveurStellar(etat.reseau).loadAccount(adresse);
      return true;
    } catch (erreur) {
      if (compteAbsent(erreur)) return false;
      throw erreur;
    }
  }

  /** Code de jeton XRPL : 3 caractères tels quels, 40 hexadécimaux tels quels, sinon converti en hexadécimal. */
  function codeJetonXrpl(code) {
    if (code.length === 3 || /^[0-9A-F]{40}$/i.test(code)) return code;
    return Array.from(code, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(40, '0').toUpperCase();
  }

  const PREPARATIONS = {
    XRPL: {
      envoyer: ({ vers, tag, montant, jeton }) => {
        const tx = { TransactionType: 'Payment', Destination: vers };
        if (jeton) {
          // T-06 : le montant est transmis tel quel (l'ancienne page retirait aussi les zéros sans virgule).
          tx.Amount = { currency: jeton.codeBrut, value: montant, issuer: jeton.emetteur };
          tx.Flags = xrpl.PaymentFlags.tfPartialPayment;
        } else {
          tx.Amount = xrpl.xrpToDrops(montant);
        }
        if (tag) tx.DestinationTag = Number(tag);
        return preparerXrpl(tx);
      },
      'jeton-ajout': ({ code, emetteur, plafond }) => preparerXrpl({ TransactionType: 'TrustSet', LimitAmount: { currency: codeJetonXrpl(code), issuer: emetteur, value: plafond } }),
      'jeton-retrait': ({ jeton }) => preparerXrpl({
        TransactionType: 'TrustSet',
        LimitAmount: { currency: jeton.codeBrut, issuer: jeton.emetteur, value: '0' },
        Flags: xrpl.TrustSetFlags.tfClearFreeze | xrpl.TrustSetFlags.tfSetNoRipple,
      }),
      suppression: ({ vers, tag }) => preparerXrpl({ TransactionType: 'AccountDelete', Destination: vers, ...(tag ? { DestinationTag: Number(tag) } : {}) }),
      'signataire-ajout': ({ signataire }) => preparerXrpl({ TransactionType: 'SignerListSet', SignerQuorum: 1, SignerEntries: [{ SignerEntry: { Account: signataire, SignerWeight: 1 } }] }),
      'signataire-retrait': () => preparerXrpl({ TransactionType: 'SignerListSet', SignerQuorum: 0 }),
      'cle-maitre-desactivation': () => preparerXrpl({ TransactionType: 'AccountSet', SetFlag: xrpl.AccountSetAsfFlags.asfDisableMaster }),
      'cle-maitre-activation': () => preparerXrpl({ TransactionType: 'AccountSet', ClearFlag: xrpl.AccountSetAsfFlags.asfDisableMaster }),
    },
    XLM: {
      envoyer: async ({ vers, tag, montant, jeton }) => {
        if (await stellarExiste(vers)) {
          const actif = jeton ? new StellarSdk.Asset(jeton.code, jeton.emetteur) : StellarSdk.Asset.native();
          return preparerStellar(StellarSdk.Operation.payment({ destination: vers, asset: actif, amount: montant }), tag);
        }
        if (jeton) throw new Error("le compte destinataire n'existe pas : il ne peut pas recevoir de jeton");
        return preparerStellar(StellarSdk.Operation.createAccount({ destination: vers, startingBalance: montant }), tag);
      },
      'jeton-ajout': ({ code, emetteur, plafond }) => preparerStellar(StellarSdk.Operation.changeTrust({ asset: new StellarSdk.Asset(code, emetteur), limit: plafond })),
      'jeton-retrait': ({ jeton }) => preparerStellar(StellarSdk.Operation.changeTrust({ asset: new StellarSdk.Asset(jeton.code, jeton.emetteur), limit: '0' })),
      suppression: ({ vers, tag }) => preparerStellar(StellarSdk.Operation.accountMerge({ destination: vers }), tag),
      'signataire-ajout': ({ signataire }) => preparerStellar(StellarSdk.Operation.setOptions({ signer: { ed25519PublicKey: signataire, weight: 1 } })),
      'signataire-retrait': () => preparerStellar(StellarSdk.Operation.setOptions({ signer: { ed25519PublicKey: etat.compte.signataires[0], weight: 0 } })),
      'cle-maitre-desactivation': () => preparerStellar(StellarSdk.Operation.setOptions({ masterWeight: 0 })),
      'cle-maitre-activation': () => preparerStellar(StellarSdk.Operation.setOptions({ masterWeight: 1 })),
    },
  };

  // ---------- Vues ----------

  function afficherVue(vue) {
    for (const v of VUES) parId(`vue-${v}`).hidden = v !== vue;
    const operationCourante = ['verifier', 'exporte'].includes(vue) ? etat.operation : vue;
    for (const bouton of document.querySelectorAll('[data-operation]')) {
      bouton.disabled = !etat.compte;
      if (etat.compte && bouton.dataset.operation === operationCourante) bouton.setAttribute('aria-current', 'page');
      else bouton.removeAttribute('aria-current');
    }
    const [titre, paragraphes] = AIDE[vue];
    parId('tiroir-aide-titre').textContent = `Aide · ${titre}`;
    parId('tiroir-aide-corps').replaceChildren(...paragraphes.map((texte) => element('p', '', texte)));
    window.scrollTo(0, 0);
  }

  function montrerErreur(id, texte) {
    parId(id).textContent = texte;
    parId(id).hidden = !texte;
  }

  // ---------- Réseau ----------

  function choisirReseau(valeur) {
    const [nouvelleChaine, nouveauReseau] = valeur.split(':');
    etat.chaine = nouvelleChaine;
    etat.reseau = nouveauReseau;
    const libelle = Transactions.libelleReseau(etat.chaine, etat.reseau);
    parId('bandeau-testnet').hidden = etat.reseau !== 'test';
    document.title = `2 · Préparer · ${libelle}`;
    parId('envoi-tag-libelle').textContent = chaine().libelleTag;
    parId('suppression-tag-libelle').textContent = `${chaine().libelleTag}, si demandé`;
    parId('ajout-code-aide').textContent = etat.chaine === 'XRPL'
      ? '3 caractères, ou un code plus long converti automatiquement.'
      : "1 à 12 lettres ou chiffres, tel qu'indiqué par l'émetteur.";
    // Un autre réseau, c'est un autre registre : le compte doit être vérifié à nouveau.
    oublierCompte();
  }

  // ---------- Compte ----------

  function oublierCompte() {
    etat.compte = null;
    etat.preparation = null;
    clearInterval(etat.minuterie);
    parId('contexte-vide').hidden = false;
    parId('contexte-compte').hidden = true;
    parId('contexte-encours').hidden = true;
    montrerErreur('erreur-compte', '');
    parId('compte-absent').hidden = true;
    afficherVue('compte');
  }

  /** Compte pas encore créé : situation normale pour un wallet neuf, pas une erreur. */
  function montrerCompteAbsent() {
    const ici = Transactions.libelleReseau(etat.chaine, etat.reseau);
    const ailleurs = Transactions.libelleReseau(etat.chaine, etat.reseau === 'test' ? 'main' : 'test');
    const test = etat.reseau === 'test';
    parId('compte-absent-titre').textContent = `Ce compte n'existe pas encore sur ${ici}.`;
    parId('compte-absent-texte').textContent = `${test
      ? 'Il sera créé à la réception de son premier dépôt : demandez des fonds de test à la fontaine, puis vérifiez à nouveau.'
      : "Il sera créé à la réception de son premier dépôt, d'au moins la réserve du réseau : envoyez-lui des fonds depuis un autre compte ou une plateforme d'échange, puis vérifiez à nouveau."
    } Si votre compte existe sur ${ailleurs}, choisissez l'autre réseau en haut de la page.`;
    const fontaine = parId('compte-absent-fontaine');
    fontaine.hidden = !test;
    fontaine.href = Connexion.FONTAINES_TESTNET[etat.chaine];
    parId('compte-absent').hidden = false;
  }

  async function verifierCompte() {
    const adresse = parId('compte-adresse').value.trim();
    montrerErreur('erreur-compte', '');
    parId('compte-absent').hidden = true;
    if (!chaine().adresseValide(adresse)) {
      montrerErreur('erreur-compte', `Cette adresse n'est pas une adresse ${Transactions.libelleReseau(etat.chaine, null)} valide.`);
      return;
    }
    const bouton = parId('verifier-compte');
    bouton.disabled = true;
    try {
      etat.compte = etat.chaine === 'XRPL' ? await lireCompteXrpl(adresse) : await lireCompteStellar(adresse);
      afficherCompte();
      ouvrirOperation('envoyer');
    } catch (erreur) {
      if (compteAbsent(erreur)) montrerCompteAbsent();
      else montrerErreur('erreur-compte', `La vérification a échoué : ${messageErreur(erreur)}`);
    } finally {
      bouton.disabled = false;
    }
  }

  function afficherCompte() {
    const c = etat.compte;
    const devise = chaine().devise;
    const adresse = parId('compte-affiche');
    adresse.dataset.adresse = c.adresse;
    Interface.afficherAdresse(adresse);
    parId('compte-verifie').textContent = `Vérifié sur le réseau à ${Format.formaterHeure(new Date())}`;
    parId('compte-disponible').textContent = `${lisible(c.disponible)} ${devise}`;
    parId('compte-reserve').textContent = `${lisible(c.reserve)} ${devise}`;
    parId('compte-solde').textContent = `${lisible(c.solde)} ${devise}`;
    parId('compte-jetons').replaceChildren(...c.jetons.flatMap((j) => [element('dt', '', j.code), element('dd', '', lisible(j.solde))]));
    const fontaine = parId('lien-fontaine');
    fontaine.hidden = etat.reseau !== 'test';
    fontaine.href = Connexion.FONTAINES_TESTNET[etat.chaine];
    parId('contexte-vide').hidden = true;
    parId('contexte-compte').hidden = false;
  }

  // ---------- Opérations ----------

  function ouvrirOperation(operation) {
    etat.operation = operation;
    if (operation === 'envoyer') remplirEnvoi();
    if (operation === 'jeton-retrait') remplirRetrait();
    if (operation === 'signataires') remplirSignataires();
    if (operation === 'suppression') remplirSuppression();
    afficherVue(operation);
  }

  function jetonChoisi(groupe) {
    const bouton = parId(groupe).querySelector('[aria-pressed="true"]');
    return bouton && bouton.dataset.indice !== undefined && bouton.dataset.indice !== '' ? etat.compte.jetons[Number(bouton.dataset.indice)] : null;
  }

  function remplirEnvoi() {
    const actifs = parId('envoi-actifs');
    const natif = element('button', '', chaine().devise);
    natif.type = 'button';
    natif.setAttribute('aria-pressed', 'true');
    natif.dataset.valeur = chaine().devise;
    natif.dataset.indice = '';
    const jetons = etat.compte.jetons.map((j, i) => ({ j, i })).filter(({ j }) => Number(j.solde) > 0).map(({ j, i }) => {
      const bouton = element('button', '', `${j.code} · émis par ${j.emetteur.slice(0, 4)} … ${j.emetteur.slice(-4)}`);
      bouton.type = 'button';
      bouton.setAttribute('aria-pressed', 'false');
      bouton.dataset.valeur = j.code;
      bouton.dataset.indice = String(i);
      return bouton;
    });
    actifs.replaceChildren(natif, ...jetons);
    actualiserDisponible();
    actualiserDestinataire();
  }

  function actualiserDisponible() {
    const jeton = jetonChoisi('envoi-actifs');
    parId('envoi-disponible').textContent = jeton
      ? `Disponible : ${lisible(jeton.solde)} ${jeton.code}.`
      : `Disponible : ${lisible(etat.compte.disponible)} ${chaine().devise}. Frais réseau : environ ${lisible(depuisEntier(chaine().fraisEstimes, chaine().decimales))} ${chaine().devise}.`;
  }

  function actualiserDestinataire() {
    const vers = parId('envoi-vers').value.trim();
    const apercu = parId('envoi-vers-apercu');
    const valide = !!etat.compte && chaine().adresseValide(vers);
    apercu.hidden = !valide;
    if (valide) {
      apercu.dataset.adresse = vers;
      Interface.afficherAdresse(apercu);
    }
    parId('envoi-premiere-fois').hidden = !(valide && historique.destinataireConnu(etat.chaine, etat.reseau, vers) === false);
  }

  function montantMax() {
    const jeton = jetonChoisi('envoi-actifs');
    if (jeton) return jeton.solde;
    const d = chaine().decimales;
    return depuisEntier(enEntier(etat.compte.disponible, d) - chaine().fraisEstimes, d);
  }

  /** Erreur de saisie d'un montant, ou chaîne vide. */
  function erreurMontant(montant, decimalesMax, plafond) {
    const morceaux = /^(\d+)(?:\.(\d+))?$/.exec(montant);
    if (!morceaux) return 'Le montant doit être un nombre, avec un point pour les décimales (exemple : 12.5).';
    if ((morceaux[2] || '').length > decimalesMax) return `Le montant a trop de décimales (${decimalesMax} au plus).`;
    if (enEntier(montant, 15) === 0n) return 'Le montant doit être supérieur à zéro.';
    if (plafond !== undefined && enEntier(montant, 15) > enEntier(plafond, 15)) return 'Le montant dépasse le disponible.';
    return '';
  }

  function erreurDestinataire(adresse) {
    if (!chaine().adresseValide(adresse)) return `Le destinataire n'est pas une adresse ${Transactions.libelleReseau(etat.chaine, null)} valide.`;
    if (adresse === etat.compte.adresse) return 'Le destinataire est votre propre compte.';
    return '';
  }

  async function preparerEnvoi() {
    const vers = parId('envoi-vers').value.trim();
    const tag = parId('envoi-tag').value.trim();
    const montant = parId('envoi-montant').value.trim();
    const jeton = jetonChoisi('envoi-actifs');
    const erreur = erreurDestinataire(vers)
      || (tag && !chaine().tagValide(tag) ? chaine().erreurTag : '')
      || erreurMontant(montant, jeton ? 15 : chaine().decimales, jeton ? jeton.solde : etat.compte.disponible);
    if (erreur) return montrerErreur('envoi-erreur', erreur);
    await preparer('envoyer', 'envoi-preparer', 'envoi-erreur', { vers, tag, montant, jeton });
  }

  async function preparerAjout() {
    const code = parId('ajout-code').value.trim();
    const emetteur = parId('ajout-emetteur').value.trim();
    const plafond = parId('ajout-plafond').value.trim();
    const codeValide = etat.chaine === 'XRPL'
      ? (code.length >= 3 && code.length <= 20 && code.toUpperCase() !== 'XRP') || /^[0-9A-F]{40}$/i.test(code)
      : /^[A-Za-z0-9]{1,12}$/.test(code);
    const erreur = (!codeValide ? "Ce code de jeton n'est pas valide." : '')
      || (!chaine().adresseValide(emetteur) ? "L'émetteur n'est pas une adresse valide." : '')
      || erreurMontant(plafond, 15).replace('Le montant', 'Le plafond');
    if (erreur) return montrerErreur('ajout-erreur', erreur);
    await preparer('jeton-ajout', 'ajout-preparer', 'ajout-erreur', { code, emetteur, plafond });
  }

  function remplirRetrait() {
    const retirables = [];
    const bloques = [];
    etat.compte.jetons.forEach((j, i) => {
      const nom = `${j.code} · émis par ${j.emetteur.slice(0, 4)} … ${j.emetteur.slice(-4)}`;
      if (Number(j.solde) === 0) {
        const bouton = element('button', '', nom);
        bouton.type = 'button';
        bouton.setAttribute('aria-pressed', 'false');
        bouton.dataset.indice = String(i);
        bouton.dataset.emetteur = j.emetteur;
        retirables.push(bouton);
      } else {
        const ligne = element('li', 'champ__erreur', `${nom} : solde de ${lisible(j.solde)}. Transférez-le avant de retirer ce jeton.`);
        bloques.push(ligne);
      }
    });
    parId('retrait-jetons').replaceChildren(...retirables);
    parId('retrait-bloques').replaceChildren(...bloques);
    parId('retrait-aucun').hidden = etat.compte.jetons.length > 0;
    parId('retrait-preparer').disabled = true;
    montrerErreur('retrait-erreur', '');
  }

  function remplirSignataires() {
    const c = etat.compte;
    const liste = parId('signataires-etat');
    liste.replaceChildren(element('dt', '', 'Signataire'), element('dd', '', c.signataires.length ? '' : 'Aucun'),
      element('dt', '', 'Clé principale'), element('dd', '', c.principaleActive ? 'Active' : 'Désactivée'));
    if (c.signataires.length) {
      const dd = liste.querySelector('dd');
      dd.dataset.adresse = c.signataires[0];
      Interface.afficherAdresse(dd);
    }
    parId('bloc-retrait-signataire').hidden = !(c.signataires.length && c.principaleActive);
    parId('cle-desactiver').hidden = !(c.principaleActive && c.signataires.length);
    parId('cle-reactiver').hidden = c.principaleActive;
    parId('cle-titre').textContent = c.principaleActive ? 'Désactiver la clé principale' : 'Réactiver la clé principale';
    parId('cle-titre').className = c.principaleActive ? 'titre-section titre-danger' : 'titre-section';
    parId('cle-explication').textContent = c.principaleActive
      ? (c.signataires.length
        ? 'Ensuite, seul le signataire pourra signer pour ce compte.'
        : 'Possible seulement quand un signataire est actif.')
      : 'La clé principale pourra de nouveau signer pour ce compte.';
    montrerErreur('signataires-erreur', '');
  }

  function remplirSuppression() {
    const c = etat.compte;
    const conditions = [[c.jetons.length === 0, 'Aucun jeton détenu', "Le compte détient encore des jetons : retirez-les d'abord."]];
    if (etat.chaine === 'XRPL') {
      conditions.push([c.sequence + 256 <= c.registre, 'Compte assez ancien pour être supprimé', 'Compte trop récent pour être supprimé : réessayez plus tard.']);
    } else {
      conditions.push([c.signataires.length === 0, 'Aucun signataire actif', "Un signataire est actif : retirez-le d'abord."]);
    }
    etat.suppressionPossible = conditions.every(([ok]) => ok);
    parId('suppression-conditions').replaceChildren(...conditions.map(([ok, siOui, siNon]) => element('li', ok ? '' : 'est-manquant', ok ? siOui : siNon)));
    parId('suppression-confirmation-libelle').textContent = `Pour confirmer, tapez les 4 derniers caractères du compte à supprimer (${c.adresse.slice(0, 4)} … ${c.adresse.slice(-4)})`;
    actualiserSuppression();
  }

  function actualiserSuppression() {
    const vers = parId('suppression-vers').value.trim();
    const confirmation = parId('suppression-confirmation').value.trim();
    parId('suppression-preparer').disabled = !(etat.suppressionPossible
      && !erreurDestinataire(vers)
      && confirmation === etat.compte.adresse.slice(-4));
  }

  async function preparerSuppression() {
    const vers = parId('suppression-vers').value.trim();
    const tag = parId('suppression-tag').value.trim();
    if (tag && !chaine().tagValide(tag)) return montrerErreur('suppression-erreur', chaine().erreurTag);
    await preparer('suppression', 'suppression-preparer', 'suppression-erreur', { vers, tag });
  }

  async function preparerSignataire(operation) {
    let donnees = {};
    if (operation === 'signataire-ajout') {
      const signataire = parId('signataire-adresse').value.trim();
      const erreur = !chaine().adresseValide(signataire) ? "Le signataire n'est pas une adresse valide."
        : signataire === etat.compte.adresse ? 'Le signataire doit être un autre compte.' : '';
      if (erreur) return montrerErreur('signataires-erreur', erreur);
      donnees = { signataire };
    }
    const boutons = { 'signataire-ajout': 'signataire-ajouter', 'signataire-retrait': 'signataire-retirer', 'cle-maitre-desactivation': 'cle-desactiver', 'cle-maitre-activation': 'cle-reactiver' };
    await preparer(operation, boutons[operation], 'signataires-erreur', donnees);
  }

  // ---------- Préparer, vérifier, exporter ----------

  async function preparer(operation, idBouton, idErreur, donnees) {
    montrerErreur(idErreur, '');
    const bouton = parId(idBouton);
    bouton.disabled = true;
    try {
      const preparee = await PREPARATIONS[etat.chaine][operation](donnees);
      await afficherVerification(preparee);
    } catch (erreur) {
      montrerErreur(idErreur, `La préparation a échoué : ${messageErreur(erreur)}`);
    } finally {
      bouton.disabled = false;
      if (idBouton === 'suppression-preparer') actualiserSuppression();
      if (idBouton === 'retrait-preparer') bouton.disabled = !jetonChoisi('retrait-jetons');
    }
  }

  async function afficherVerification(preparee) {
    const decodee = Transactions.decoder(etat.chaine, preparee);
    if (decodee.operation === 'inconnue') throw new Error(`transaction non traduisible (${decodee.raison})`);
    const empreinte = await Transactions.empreinte(etat.chaine, preparee);
    const echeance = Transactions.echeance(etat.chaine, preparee);
    const limite = echeance.date || new Date(Date.now() + Reseau.DUREE_VALIDITE_SECONDES * 1000);
    etat.preparation = { preparee, decodee, empreinte, limite, approximatif: !echeance.date };
    Bordereau.remplir(parId('bordereau'), decodee, etat.reseau);
    parId('empreinte').textContent = Format.formaterEmpreinte(empreinte);
    parId('technique-contenu').textContent = JSON.stringify(decodee.brut, null, 2);
    parId('heure-limite').textContent = `Valable jusqu'à ${etat.preparation.approximatif ? 'environ ' : ''}${Format.formaterHeure(limite)}, soit ${etat.preparation.approximatif ? 'environ ' : ''}${Math.round((limite.getTime() - Date.now()) / 60000)} minutes pour signer puis envoyer.`;
    afficherVue('verifier');
  }

  function telecharger(nom, contenu) {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    lien.download = nom;
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
  }

  function exporter() {
    const { preparee, decodee, empreinte, limite } = etat.preparation;
    const details = decodee.operation === 'paiement' ? [decodee.montant, decodee.devise]
      : decodee.operation.startsWith('jeton-') ? [decodee.devise] : [];
    const nom = Fichiers.nomFichierTransaction({
      chaine: etat.chaine, reseau: etat.reseau, date: new Date(), operation: decodee.operation, details, empreinte, etape: 'a-signer',
    });
    const enveloppe = Fichiers.envelopperTransaction({
      chaine: etat.chaine, reseau: etat.reseau, etape: 'a-signer', transaction: preparee, autorises: etat.compte.autorises,
    });
    telecharger(nom, JSON.stringify(enveloppe, null, 2));
    historique.noterPreparation({ empreinte, chaine: etat.chaine, reseau: etat.reseau, operation: decodee.operation });
    if (decodee.operation === 'paiement') historique.noterDestinataire(etat.chaine, etat.reseau, decodee.vers);

    parId('export-nom').textContent = nom;
    parId('encours-resume').textContent = decodee.montant
      ? `${Transactions.LIBELLES[decodee.operation]} · ${lisible(decodee.montant)} ${decodee.devise}`
      : Transactions.LIBELLES[decodee.operation];
    parId('encours-empreinte').textContent = Format.formaterEmpreinte(empreinte);
    parId('contexte-encours').hidden = false;
    clearInterval(etat.minuterie);
    const actualiser = () => {
      const reste = limite.getTime() - Date.now();
      parId('encours-delai').textContent = reste > 0 ? `Expire dans ${Format.formaterDuree(reste, { approximatif: etat.preparation.approximatif })}` : 'Délai dépassé : préparez-la à nouveau.';
      if (reste <= 0) clearInterval(etat.minuterie);
    };
    actualiser();
    etat.minuterie = setInterval(actualiser, 1000);
    afficherVue('exporte');
  }

  // ---------- Branchements ----------

  parId('reseau').addEventListener('change', (e) => choisirReseau(e.target.value));
  parId('verifier-compte').addEventListener('click', verifierCompte);
  parId('compte-adresse').addEventListener('keydown', (e) => { if (e.key === 'Enter') verifierCompte(); });
  parId('fichier-adresse').addEventListener('change', async () => {
    const fichier = parId('fichier-adresse').files[0];
    if (!fichier) return;
    const adresse = (await fichier.text()).trim().split(/\s+/)[0] || '';
    parId('compte-adresse').value = adresse;
    parId('fichier-adresse').value = '';
    montrerErreur('erreur-compte', chaine().adresseValide(adresse) ? '' : "Ce fichier ne contient pas une adresse publique valide.");
  });
  parId('changer-compte').addEventListener('click', oublierCompte);

  for (const bouton of document.querySelectorAll('[data-operation]')) {
    bouton.addEventListener('click', () => ouvrirOperation(bouton.dataset.operation));
  }

  parId('envoi-actifs').addEventListener('change', actualiserDisponible);
  parId('envoi-vers').addEventListener('input', actualiserDestinataire);
  parId('envoi-max').addEventListener('click', () => { parId('envoi-montant').value = montantMax(); });
  parId('envoi-preparer').addEventListener('click', preparerEnvoi);
  parId('ajout-preparer').addEventListener('click', preparerAjout);
  parId('retrait-jetons').addEventListener('change', () => { parId('retrait-preparer').disabled = !jetonChoisi('retrait-jetons'); });
  parId('retrait-preparer').addEventListener('click', () => preparer('jeton-retrait', 'retrait-preparer', 'retrait-erreur', { jeton: jetonChoisi('retrait-jetons') }));
  parId('signataire-ajouter').addEventListener('click', () => preparerSignataire('signataire-ajout'));
  parId('signataire-retirer').addEventListener('click', () => preparerSignataire('signataire-retrait'));
  parId('cle-desactiver').addEventListener('click', () => preparerSignataire('cle-maitre-desactivation'));
  parId('cle-reactiver').addEventListener('click', () => preparerSignataire('cle-maitre-activation'));
  for (const id of ['suppression-vers', 'suppression-confirmation']) parId(id).addEventListener('input', actualiserSuppression);
  parId('suppression-preparer').addEventListener('click', preparerSuppression);

  parId('modifier').addEventListener('click', () => afficherVue(etat.operation));
  parId('exporter').addEventListener('click', exporter);
  parId('autre-preparation').addEventListener('click', () => {
    for (const id of ['envoi-vers', 'envoi-tag', 'envoi-montant']) parId(id).value = '';
    ouvrirOperation('envoyer');
  });

  const caseHistorique = parId('historique-actif');
  caseHistorique.checked = historique.actif();
  caseHistorique.addEventListener('change', () => historique.activer(caseHistorique.checked));
  parId('historique-effacer').addEventListener('click', () => {
    historique.effacer();
    parId('historique-efface').hidden = false;
  });

  parId('hors-ligne').hidden = navigator.onLine !== false;
  choisirReseau(parId('reseau').value);
})();
