// Données de test. Ces mots sont publics : ne jamais les utiliser avec de vrais fonds.

const MOTS = {
  // Mnémoniques de test BIP39 classiques.
  abandon12: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  abandon24: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon '
    + 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
  // Vecteurs officiels Stellar SEP-0005 (tests 1 et 3), sans phrase de passe.
  sep5test1: 'illness spike retreat truth genius clock brain pass fit cave bargain toe',
  sep5test3: 'bench hurt jump file august wise shallow faculty impulse spring exact slush thunder author '
    + 'capable act festival slice deposit sauce coconut afford frown better',
};

const ADRESSES = {
  // Référence indépendante : SEP-0005, chemin m/44'/148'/0'.
  xlmSep5test1: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6',
  xlmSep5test3: 'GC3MMSXBWHL6CPOAVERSJITX7BH76YU252WGLUOM5CJX3E7UCYZBTPJQ',
  // Caractérisation : valeurs relevées sur la version actuelle (commit 702ccff).
  xrplAbandon12: 'rHsMGQEkVNJmpGWs8XUBoTBiAAbwxZN5v3',
  xrplAbandon24: 'rKxpJQ6hLWYbo7p1oo7WHjrcrRFv1TUQeC',
  // Comptes du réseau simulé (pages en ligne).
  xrplEmetteur: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  xlmEmetteur: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR', // graine brute 32 × 0x01
  xlmInconnu: 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U', // graine brute 32 × 0x02, absent du réseau
};

const MOT_DE_PASSE = 'mot-de-passe-de-test';

module.exports = { MOTS, ADRESSES, MOT_DE_PASSE };
