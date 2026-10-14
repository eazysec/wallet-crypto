// Délai de validité des transactions et explication des refus du réseau.
// Script classique : window.Commun.Reseau dans les pages, require() dans les tests Node.
(function (exporter) {
  'use strict';

  // Le protocole ne l'impose pas : c'est l'étape 2 qui fixe ce délai.
  const DUREE_VALIDITE_SECONDES = 900;
  // Un registre XRPL se ferme toutes les 3 à 5 secondes : on compte 4 secondes.
  const SECONDES_PAR_REGISTRE = 4;

  function registresPourDuree(secondes) {
    return Math.ceil(secondes / SECONDES_PAR_REGISTRE);
  }

  const DELAI = {
    raison: 'Le délai de validité est dépassé.',
    conseil: "Préparez la transaction à nouveau à l'étape 2, puis signez-la et envoyez-la avant la nouvelle heure limite.",
  };
  const SEQUENCE = {
    raison: 'Une autre transaction de ce compte est passée entre-temps.',
    conseil: "Préparez la transaction à nouveau à l'étape 2.",
  };
  const MAUVAISE_CLE = {
    raison: "La clé qui a signé n'est pas autorisée sur ce compte.",
    conseil: "Signez à nouveau à l'étape 3, avec la bonne clé.",
  };
  const FONDS = {
    raison: 'Fonds insuffisants sur le compte.',
    conseil: "Vérifiez le montant disponible à l'étape 2 : la réserve n'est pas dépensable.",
  };
  const DESTINATAIRE_ABSENT = {
    raison: "Le compte destinataire n'existe pas.",
    conseil: "Vérifiez l'adresse, ou envoyez au moins la réserve de base pour créer ce compte.",
  };
  const JETON_REFUSE = {
    raison: 'Le destinataire ne peut pas recevoir ce jeton.',
    conseil: "Le destinataire doit d'abord autoriser ce jeton.",
  };
  const RESERVE = {
    raison: 'Réserve insuffisante pour cette opération.',
    conseil: 'Ajoutez des fonds au compte, puis préparez la transaction à nouveau.',
  };
  const COMPTE_OCCUPE = {
    raison: 'Le compte détient encore des jetons ou des objets.',
    conseil: 'Retirez-les avant de supprimer le compte.',
  };

  const REFUS = {
    // XRPL
    tefMAX_LEDGER: DELAI,
    tefPAST_SEQ: SEQUENCE,
    tefBAD_AUTH: MAUVAISE_CLE,
    tefBAD_AUTH_MASTER: MAUVAISE_CLE,
    tefMASTER_DISABLED: {
      raison: 'La clé principale de ce compte est désactivée.',
      conseil: "Signez à nouveau à l'étape 3, avec la clé du signataire.",
    },
    tecUNFUNDED_PAYMENT: FONDS,
    tecNO_DST: DESTINATAIRE_ABSENT,
    tecNO_DST_INSUF_XRP: {
      raison: 'Le montant ne suffit pas à créer le compte destinataire.',
      conseil: 'Envoyez au moins la réserve de base.',
    },
    tecDST_TAG_NEEDED: {
      raison: 'Le destinataire exige un tag de destination.',
      conseil: "Préparez la transaction à nouveau à l'étape 2, avec le tag.",
    },
    tecPATH_DRY: JETON_REFUSE,
    tecPATH_PARTIAL: JETON_REFUSE,
    tecNO_LINE_INSUF_RESERVE: RESERVE,
    tecINSUF_RESERVE_LINE: RESERVE,
    tecHAS_OBLIGATIONS: COMPTE_OCCUPE,
    tecTOO_SOON: {
      raison: 'Le compte est trop récent pour être supprimé.',
      conseil: 'Réessayez plus tard.',
    },
    // Stellar
    tx_too_late: DELAI,
    tx_bad_seq: SEQUENCE,
    tx_bad_auth: MAUVAISE_CLE,
    tx_insufficient_balance: FONDS,
    op_underfunded: FONDS,
    op_no_destination: DESTINATAIRE_ABSENT,
    op_no_trust: JETON_REFUSE,
    op_low_reserve: RESERVE,
    op_has_sub_entries: COMPTE_OCCUPE,
  };

  /**
   * Raison et conseil, en clair, pour un code de refus.
   * fraisPreleves : la transaction est entrée au registre (codes tec… et op_…) ;
   * aucun fonds n'a bougé, mais les frais ont été prélevés.
   */
  function expliquerRefus(code) {
    const fraisPreleves = /^(tec|op_)/.test(String(code));
    const connu = REFUS[code];
    if (connu) return { ...connu, fraisPreleves };
    return {
      raison: `Le réseau a refusé la transaction (code ${code}).`,
      conseil: "Vérifiez la transaction, puis préparez-la à nouveau à l'étape 2.",
      fraisPreleves,
    };
  }

  /** Code XRPL d'une transaction réussie. */
  function estReussite(code) {
    return code === 'tesSUCCESS';
  }

  exporter('Reseau', { DUREE_VALIDITE_SECONDES, registresPourDuree, expliquerRefus, estReussite });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
