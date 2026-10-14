// Connexion aux réseaux, commune aux pages en ligne (2 et 4).
// Une seule connexion XRPL par réseau, réutilisée ; Horizon pour Stellar.
(function () {
  'use strict';

  const SERVEURS = {
    XRPL: { main: 'wss://xrplcluster.com', test: 'wss://s.altnet.rippletest.net:51233' },
    XLM: { main: 'https://horizon.stellar.org', test: 'https://horizon-testnet.stellar.org' },
  };
  const EXPLORATEURS = {
    XRPL: { main: 'https://xrpscan.com/tx/', test: 'https://testnet.xrpl.org/transactions/' },
    XLM: { main: 'https://stellar.expert/explorer/public/tx/', test: 'https://stellar.expert/explorer/testnet/tx/' },
  };
  const FONTAINES_TESTNET = {
    XRPL: 'https://xrpl.org/resources/dev-tools/xrp-faucets',
    XLM: 'https://lab.stellar.org/account/fund',
  };

  const connexions = {};

  /** Client XRPL connecté pour ce réseau ('main' ou 'test'). */
  function clientXrpl(reseau) {
    if (!connexions[reseau]) {
      const client = new window.SecureWalletBundle.xrpl.Client(SERVEURS.XRPL[reseau]);
      connexions[reseau] = client.connect().then(() => client, (erreur) => {
        delete connexions[reseau];
        throw erreur;
      });
    }
    return connexions[reseau];
  }

  function serveurStellar(reseau) {
    return new window.SecureWalletBundle.StellarSdk.Horizon.Server(SERVEURS.XLM[reseau]);
  }

  function lienExplorateur(chaine, reseau, hash) {
    return EXPLORATEURS[chaine][reseau] + encodeURIComponent(hash);
  }

  (window.Commun = window.Commun || {}).Connexion = { SERVEURS, FONTAINES_TESTNET, clientXrpl, serveurStellar, lienExplorateur };
})();
