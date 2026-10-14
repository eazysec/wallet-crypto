// Traduction des transactions en clair, commune aux pages 3 (signer) et 4 (envoyer).
// Règle : on ne présente que ce qu'on sait traduire. Un type, un champ ou une opération
// inattendus rendent la transaction « inconnue », et les pages refusent de la traiter.
// Script classique : window.Commun.Transactions dans les pages. Les conversions sont aussi
// testées sous Node : le bundle crypto n'est lu qu'à l'appel du décodage.
(function (exporter) {
  'use strict';

  const LIBELLES = {
    'paiement': 'Paiement',
    'jeton-ajout': 'Autoriser un jeton',
    'jeton-retrait': 'Retirer un jeton',
    'suppression-compte': 'Supprimer le compte',
    'signataire-ajout': 'Ajouter un signataire',
    'signataire-retrait': 'Retirer le signataire',
    'cle-maitre-activation': 'Réactiver la clé principale',
    'cle-maitre-desactivation': 'Désactiver la clé principale',
  };

  const RESEAUX = { main: 'Mainnet', test: 'Testnet' };
  const CHAINES = { XRPL: 'XRPL', XLM: 'Stellar' };

  /** Exemple : « XRPL Testnet » ; fonds : « fonds réels » ou « fonds fictifs ». */
  function libelleReseau(chaine, reseau) {
    return `${CHAINES[chaine]} ${RESEAUX[reseau] || ''}`.trim();
  }
  function libelleFonds(reseau) {
    return reseau === 'test' ? 'fonds fictifs' : 'fonds réels';
  }

  // ---------- Conversions exactes, sur le texte ----------

  function decimalDepuisEntier(entier, decimales) {
    const texte = String(entier).trim();
    if (!/^\d+$/.test(texte)) throw new RangeError(`Entier attendu : ${texte}`);
    const rempli = texte.padStart(decimales + 1, '0');
    const partieEntiere = rempli.slice(0, -decimales).replace(/^0+(?=\d)/, '');
    const fraction = rempli.slice(-decimales).replace(/0+$/, '');
    return fraction ? `${partieEntiere}.${fraction}` : partieEntiere;
  }

  /** 1 XRP = 1 000 000 drops. */
  function dropsEnXrp(drops) {
    return decimalDepuisEntier(drops, 6);
  }

  /** 1 XLM = 10 000 000 stroops. */
  function stroopsEnXlm(stroops) {
    return decimalDepuisEntier(stroops, 7);
  }

  /** « 10.0000000 » → « 10 ». */
  function montantStellar(montant) {
    const [entier, fraction = ''] = String(montant).split('.');
    const utile = fraction.replace(/0+$/, '');
    return utile ? `${entier}.${utile}` : entier;
  }

  /** Code de devise XRPL : 3 caractères, ou 40 caractères hexadécimaux. Garde la casse. */
  function deviseLisible(code) {
    if (!/^[0-9A-F]{40}$/i.test(code)) return code;
    let texte = '';
    for (let i = 0; i < 40; i += 2) {
      const octet = parseInt(code.slice(i, i + 2), 16);
      if (octet >= 0x20 && octet <= 0x7e) texte += String.fromCharCode(octet);
    }
    return texte.trim() || code;
  }

  // ---------- XRPL ----------

  const CHAMPS_COMMUNS_XRPL = ['TransactionType', 'Account', 'Fee', 'Sequence', 'LastLedgerSequence', 'Flags', 'SigningPubKey', 'TxnSignature', 'Signers', 'NetworkID'];
  const CHAMPS_XRPL = {
    Payment: ['Destination', 'Amount', 'DestinationTag'],
    TrustSet: ['LimitAmount'],
    AccountDelete: ['Destination', 'DestinationTag'],
    SignerListSet: ['SignerQuorum', 'SignerEntries'],
    AccountSet: ['SetFlag', 'ClearFlag'],
  };
  const DRAPEAU_PAIEMENT_PARTIEL = 0x00020000;
  const ASF_DESACTIVER_CLE_PRINCIPALE = 4;

  function lisibleXrpl(transaction) {
    const { xrpl } = globalThis.SecureWalletBundle;
    return transaction.tx_blob ? xrpl.decode(transaction.tx_blob) : { ...transaction };
  }

  function texteOuNul(valeur) {
    return valeur === undefined || valeur === null ? null : String(valeur);
  }

  function decoderXrpl(transaction) {
    const tx = lisibleXrpl(transaction);
    const base = {
      chaine: 'XRPL', technique: tx.TransactionType, brut: tx, de: tx.Account,
      frais: dropsEnXrp(tx.Fee), signee: !!(tx.TxnSignature || tx.Signers),
      multisignature: Array.isArray(tx.Signers) && tx.Signers.length > 0,
    };
    const autorises = CHAMPS_XRPL[tx.TransactionType];
    if (!autorises) return { ...base, operation: 'inconnue', raison: `type ${tx.TransactionType}` };
    const inattendus = Object.keys(tx).filter((champ) => !CHAMPS_COMMUNS_XRPL.includes(champ) && !autorises.includes(champ));
    if (inattendus.length) return { ...base, operation: 'inconnue', raison: `champ inattendu : ${inattendus.join(', ')}` };

    switch (tx.TransactionType) {
      case 'Payment': {
        const jeton = typeof tx.Amount === 'object';
        return {
          ...base, operation: 'paiement', vers: tx.Destination, tag: texteOuNul(tx.DestinationTag),
          montant: jeton ? tx.Amount.value : dropsEnXrp(tx.Amount),
          devise: jeton ? deviseLisible(tx.Amount.currency) : 'XRP',
          emetteur: jeton ? tx.Amount.issuer : null,
          livraisonPartielle: ((tx.Flags || 0) & DRAPEAU_PAIEMENT_PARTIEL) !== 0,
        };
      }
      case 'TrustSet': {
        const limite = tx.LimitAmount;
        return {
          ...base, operation: Number(limite.value) === 0 ? 'jeton-retrait' : 'jeton-ajout',
          devise: deviseLisible(limite.currency), emetteur: limite.issuer, plafond: limite.value,
        };
      }
      case 'AccountDelete':
        return { ...base, operation: 'suppression-compte', vers: tx.Destination, tag: texteOuNul(tx.DestinationTag) };
      case 'SignerListSet': {
        if (tx.SignerQuorum === 0 && !tx.SignerEntries) return { ...base, operation: 'signataire-retrait' };
        const entrees = tx.SignerEntries || [];
        if (entrees.length !== 1) return { ...base, operation: 'inconnue', raison: 'liste de plusieurs signataires' };
        return { ...base, operation: 'signataire-ajout', signataire: entrees[0].SignerEntry.Account };
      }
      case 'AccountSet':
        if (tx.SetFlag === ASF_DESACTIVER_CLE_PRINCIPALE && tx.ClearFlag === undefined) return { ...base, operation: 'cle-maitre-desactivation' };
        if (tx.ClearFlag === ASF_DESACTIVER_CLE_PRINCIPALE && tx.SetFlag === undefined) return { ...base, operation: 'cle-maitre-activation' };
        return { ...base, operation: 'inconnue', raison: 'réglage de compte non reconnu' };
      default:
        return { ...base, operation: 'inconnue', raison: `type ${tx.TransactionType}` };
    }
  }

  /**
   * XRPL : une signature par un signataire coûte des frais × (1 + nombre de signatures).
   * Les pages ne gèrent qu'un signataire : frais doublés. L'empreinte n'en tient pas compte.
   */
  function versionMultisignature(transaction) {
    return { ...transaction, Fee: String(BigInt(transaction.Fee) * 2n) };
  }

  // ---------- Stellar ----------

  const OPTIONS_INTERDITES = ['inflationDest', 'clearFlags', 'setFlags', 'lowThreshold', 'medThreshold', 'highThreshold', 'homeDomain'];

  function lisibleStellar(transaction) {
    const { StellarSdk } = globalThis.SecureWalletBundle;
    return StellarSdk.TransactionBuilder.fromXDR(transaction.XDR, transaction.Network);
  }

  function texteMemo(memo) {
    if (!memo || memo.type === 'none') return null;
    if (memo.type === 'id') return String(memo.value);
    if (memo.type === 'text') return typeof memo.value === 'string' ? memo.value : new TextDecoder().decode(memo.value);
    return undefined; // mémo de type hash ou return : non traduit
  }

  function decoderStellar(transaction) {
    const { StellarSdk } = globalThis.SecureWalletBundle;
    const tx = lisibleStellar(transaction);
    if (tx.innerTransaction) return { chaine: 'XLM', operation: 'inconnue', raison: 'transaction englobante (fee bump)', brut: {}, signee: true };

    const signatures = tx.signatures || [];
    let multisignature = false;
    if (signatures.length) {
      try {
        multisignature = !StellarSdk.Keypair.fromPublicKey(tx.source).verify(tx.hash(), signatures[0].signature());
      } catch {
        multisignature = true;
      }
    }
    const tag = texteMemo(tx.memo);
    const base = {
      chaine: 'XLM', de: tx.source, frais: stroopsEnXlm(tx.fee), tag, multisignature,
      signee: signatures.length > 0,
      brut: { source: tx.source, sequence: tx.sequence, fee: tx.fee, timeBounds: tx.timeBounds, memo: tag, operations: tx.operations },
    };
    if (tag === undefined) return { ...base, operation: 'inconnue', raison: 'type de mémo non reconnu' };
    if (tx.operations.length !== 1) return { ...base, operation: 'inconnue', raison: `${tx.operations.length} opérations dans une seule transaction` };

    const op = tx.operations[0];
    base.technique = op.type;
    if (op.source && op.source !== tx.source) return { ...base, operation: 'inconnue', raison: 'opération au nom d\'un autre compte' };

    switch (op.type) {
      case 'payment': {
        const natif = op.asset.isNative();
        return {
          ...base, operation: 'paiement', vers: op.destination, montant: montantStellar(op.amount),
          devise: natif ? 'XLM' : op.asset.getCode(), emetteur: natif ? null : op.asset.getIssuer(),
        };
      }
      case 'createAccount':
        return { ...base, operation: 'paiement', creationCompte: true, vers: op.destination, montant: montantStellar(op.startingBalance), devise: 'XLM', emetteur: null };
      case 'changeTrust': {
        if (!op.line || typeof op.line.getCode !== 'function') return { ...base, operation: 'inconnue', raison: 'réserve de liquidité' };
        return {
          ...base, operation: Number(op.limit) === 0 ? 'jeton-retrait' : 'jeton-ajout',
          devise: op.line.getCode(), emetteur: op.line.getIssuer(), plafond: montantStellar(op.limit),
        };
      }
      case 'accountMerge':
        return { ...base, operation: 'suppression-compte', vers: op.destination };
      case 'setOptions': {
        const autres = OPTIONS_INTERDITES.filter((cle) => op[cle] !== undefined && op[cle] !== null);
        const surCle = op.masterWeight !== undefined && op.masterWeight !== null;
        const surSignataire = !!(op.signer && op.signer.ed25519PublicKey);
        if (autres.length || surCle === surSignataire) return { ...base, operation: 'inconnue', raison: 'réglage de compte non reconnu' };
        if (surCle) return { ...base, operation: op.masterWeight > 0 ? 'cle-maitre-activation' : 'cle-maitre-desactivation' };
        return { ...base, operation: op.signer.weight > 0 ? 'signataire-ajout' : 'signataire-retrait', signataire: op.signer.ed25519PublicKey };
      }
      default:
        return { ...base, operation: 'inconnue', raison: `opération ${op.type}` };
    }
  }

  // ---------- Commun aux deux chaînes ----------

  /** Transaction en clair. operation === 'inconnue' : à refuser, avec `raison`. */
  function decoder(chaine, transaction) {
    return chaine === 'XRPL' ? decoderXrpl(transaction) : decoderStellar(transaction);
  }

  /**
   * Empreinte indépendante de la signature : la même aux étapes 2, 3 et 4.
   * Stellar : hachage officiel de la transaction. XRPL : SHA-256 de la transaction
   * encodée, sans les champs de signature, et avec les frais d'avant la multisignature
   * (frais ÷ (1 + nombre de signataires), voir versionMultisignature).
   */
  async function empreinte(chaine, transaction) {
    if (chaine === 'XLM') return lisibleStellar(transaction).hash().toString('hex');
    const { xrpl } = globalThis.SecureWalletBundle;
    const tx = lisibleXrpl(transaction);
    const multiple = BigInt(1 + (Array.isArray(tx.Signers) ? tx.Signers.length : 0));
    if (multiple > 1n && BigInt(tx.Fee) % multiple === 0n) tx.Fee = String(BigInt(tx.Fee) / multiple);
    delete tx.TxnSignature;
    delete tx.SigningPubKey;
    delete tx.Signers;
    return globalThis.Commun.Securite.empreinteSha256(xrpl.encode(tx));
  }

  /** Échéance inscrite : une heure (Stellar) ou un numéro de registre (XRPL). */
  function echeance(chaine, transaction) {
    if (chaine === 'XLM') {
      const limite = Number((lisibleStellar(transaction).timeBounds || {}).maxTime || 0);
      return limite ? { date: new Date(limite * 1000) } : {};
    }
    const registre = lisibleXrpl(transaction).LastLedgerSequence;
    return registre ? { registre } : {};
  }

  exporter('Transactions', {
    LIBELLES, libelleReseau, libelleFonds, dropsEnXrp, stroopsEnXlm, montantStellar, deviseLisible,
    versionMultisignature, decoder, empreinte, echeance,
  });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
