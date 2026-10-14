// Noms des fichiers produits et identification de leur contenu.
// Le nom sert aux humains ; l'application lit toujours la chaîne et le réseau dans le contenu.
// Script classique : window.Commun.Fichiers dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  const OPERATIONS = [
    'paiement', 'jeton-ajout', 'jeton-retrait', 'suppression-compte',
    'signataire-ajout', 'signataire-retrait', 'cle-maitre-activation', 'cle-maitre-desactivation',
  ];
  const ETAPES = ['a-signer', 'signee'];
  const EXTENSIONS_WALLET = { XRPL: '.xrplwallet', XLM: '.xlmwallet' };
  const RESEAUX_STELLAR = {
    'Public Global Stellar Network ; September 2015': 'main',
    'Test SDF Network ; September 2015': 'test',
  };

  /** Minuscules ASCII et tirets ; le point décimal devient une virgule. */
  function simplifier(texte) {
    return String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/\./g, ',').replace(/[^a-z0-9,]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function dateIso(date) {
    const deux = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
  }

  function adresseCourte(adresse) {
    return `${adresse.slice(0, 4)}-${adresse.slice(-4)}`;
  }

  /** Exemple : xrpl-main_2026-10-14_paiement-1250-xrp_7f3a91.a-signer.json */
  function nomFichierTransaction({ chaine, reseau, date, operation, details = [], empreinte, etape }) {
    if (!OPERATIONS.includes(operation)) throw new RangeError(`Opération inconnue : ${operation}`);
    if (!ETAPES.includes(etape)) throw new RangeError(`Étape inconnue : ${etape}`);
    const quoi = [operation, ...details.map(simplifier)].filter(Boolean).join('-');
    const prefixe = String(empreinte).slice(0, 6).toLowerCase();
    const lieu = reseau ? `${chaine.toLowerCase()}-${reseau}` : chaine.toLowerCase();
    return `${lieu}_${dateIso(date)}_${quoi}_${prefixe}.${etape}.json`;
  }

  /** Exemple : xrpl_rLp8-A5Nn.xrplwallet */
  function nomFichierWallet(chaine, adresse) {
    return `${chaine.toLowerCase()}_${adresseCourte(adresse)}${EXTENSIONS_WALLET[chaine]}`;
  }

  /** Exemple : xrpl_rLp8-A5Nn.adresse-publique.txt */
  function nomFichierAdressePublique(chaine, adresse) {
    return `${chaine.toLowerCase()}_${adresseCourte(adresse)}.adresse-publique.txt`;
  }

  // ---------- Format des fichiers de transaction ----------

  const FORMAT_TRANSACTION = 'securedwallet/transaction-v1';
  const CHAINES = ['XRPL', 'XLM'];
  const RESEAUX = ['main', 'test'];
  const INCONNU = { chaine: null, reseau: null, signee: null, transaction: null, autorises: null };

  /**
   * Enveloppe écrite par les étapes 2 et 3 : la transaction, plus ce qu'elle ne dit pas
   * elle-même (le réseau XRPL, l'étape, les comptes dont la clé peut signer).
   */
  function envelopperTransaction({ chaine, reseau, etape, transaction, autorises = [], creee = new Date() }) {
    if (!CHAINES.includes(chaine)) throw new RangeError(`Chaîne inconnue : ${chaine}`);
    if (!RESEAUX.includes(reseau)) throw new RangeError(`Réseau inconnu : ${reseau}`);
    if (!ETAPES.includes(etape)) throw new RangeError(`Étape inconnue : ${etape}`);
    return { format: FORMAT_TRANSACTION, chaine, reseau, etape, creee: creee.toISOString(), autorises, transaction };
  }

  /** Ancien format : la transaction seule. */
  function identifierAncienFormat(objet) {
    if (!objet || typeof objet !== 'object') return INCONNU;
    if (objet.tx_blob && objet.hash) return { chaine: 'XRPL', reseau: null, signee: true, transaction: objet, autorises: null };
    if (objet.TransactionType) return { chaine: 'XRPL', reseau: null, signee: false, transaction: objet, autorises: null };
    if (objet.XDR && objet.Network) {
      return { chaine: 'XLM', reseau: RESEAUX_STELLAR[objet.Network] || null, signee: null, transaction: objet, autorises: null };
    }
    return INCONNU;
  }

  /**
   * Chaîne, réseau et transaction d'un fichier, d'après son contenu, dans les deux formats.
   * Ancien format : le réseau XRPL vaut null (non inscrit) ; pour Stellar, savoir si la
   * transaction est signée demande de décoder le XDR (signee: null).
   * Une enveloppe que la transaction contredit est refusée.
   */
  function identifierTransaction(objet) {
    if (!objet || typeof objet !== 'object') return INCONNU;
    if (objet.format !== FORMAT_TRANSACTION) return identifierAncienFormat(objet);

    const { chaine, reseau, etape, transaction, autorises } = objet;
    if (!CHAINES.includes(chaine) || !RESEAUX.includes(reseau) || !ETAPES.includes(etape)) return INCONNU;
    const contenu = identifierAncienFormat(transaction);
    const signee = etape === 'signee';
    if (contenu.chaine !== chaine) return INCONNU;
    if (contenu.reseau && contenu.reseau !== reseau) return INCONNU;
    if (contenu.signee !== null && contenu.signee !== signee) return INCONNU;
    return {
      chaine, reseau, signee, transaction,
      autorises: Array.isArray(autorises) ? autorises.filter((a) => typeof a === 'string') : [],
    };
  }

  exporter('Fichiers', {
    OPERATIONS, FORMAT_TRANSACTION, nomFichierTransaction, nomFichierWallet, nomFichierAdressePublique,
    envelopperTransaction, identifierTransaction,
  });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
