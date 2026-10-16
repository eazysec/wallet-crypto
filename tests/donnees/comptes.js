// États des comptes sur le réseau simulé.
const { ADRESSES: A } = require('./vecteurs');

const xrplDestination = { solde: '50000000', sequence: 5 };
const xrplJetons = [
  { code: 'USD', emetteur: A.xrplEmetteur, solde: '250' },
  { code: 'EUR', emetteur: A.xrplEmetteur, solde: '0' },
];

const xlmDestination = { solde: '50.0000000', sequence: '5', jetons: [], signataires: [] };
const xlmJetons = [
  { code: 'USD', emetteur: A.xlmEmetteur, solde: '250.0000000' },
  { code: 'EUR', emetteur: A.xlmEmetteur, solde: '0.0000000' },
];

// Émetteur des jetons ; transferRate : frais de transfert (1005000000 = 0,5 %), absent = sans frais.
function xrpl(compte, emetteur = {}) {
  return {
    [A.xrplAbandon12]: { solde: '1741300000', sequence: 81204812, objets: 2, jetons: xrplJetons, signataires: [], ...compte },
    [A.xrplAbandon24]: xrplDestination,
    [A.xrplEmetteur]: { solde: '100000000', sequence: 1, ...emetteur },
  };
}

function xlm(compte) {
  return {
    [A.xlmSep5test1]: { solde: '1741.3000000', sequence: '123456789', jetons: xlmJetons, signataires: [], poidsPrincipal: 1, ...compte },
    [A.xlmSep5test3]: xlmDestination,
  };
}

module.exports = {
  xrpl: {
    standard: xrpl({}),
    sansJeton: xrpl({ objets: 0, jetons: [] }),
    avecSignataire: xrpl({ signataires: [A.xrplAbandon24] }),
    principaleDesactivee: xrpl({ signataires: [A.xrplAbandon24], desactiverPrincipale: true }),
    emetteurAvecFrais: xrpl({}, { transferRate: 1005000000 }),
  },
  xlm: {
    standard: xlm({}),
    sansJeton: xlm({ jetons: [] }),
    avecSignataire: xlm({ signataires: [A.xlmSep5test3] }),
    principaleDesactivee: xlm({ signataires: [A.xlmSep5test3], poidsPrincipal: 0 }),
  },
};
