// Clés : création et ouverture depuis les mots ou un fichier wallet (pages hors ligne).
// La dérivation reprend exactement celle de la version précédente :
// XRPL par xrpl.js, Stellar par SLIP-0010 ed25519 sur le chemin m/44'/148'/0' (vecteurs SEP-0005).
// Script classique : window.Commun.Cles dans les pages ; sous Node (tests), seules les
// fonctions qui n'utilisent pas le bundle crypto sont utilisables.
(function (exporter) {
  'use strict';

  const CHEMIN_STELLAR = "m/44'/148'/0'";
  const NUMEROS_XAMAN = /^([0-9]{6} ){7}[0-9]{6}$/;

  const bundle = () => globalThis.SecureWalletBundle;

  /** Liste officielle des 2 048 mots BIP39 (anglais). */
  function listeMots() {
    return bundle().bip39.wordlists.EN;
  }

  /** Mots en minuscules, séparés par une seule espace. */
  function normaliser(mots) {
    return String(mots).trim().toLowerCase().split(/\s+/).join(' ');
  }

  /**
   * Contrôle des mots : { inconnus, standard, numerosXaman }.
   * inconnus : mots absents de la liste BIP39 (faute de frappe probable) ;
   * standard : phrase BIP39 valide, somme de contrôle comprise.
   */
  function verifierMots(mots) {
    const texte = normaliser(mots);
    if (NUMEROS_XAMAN.test(texte)) return { inconnus: [], standard: true, numerosXaman: true };
    const { bip39 } = bundle();
    const liste = new Set(bip39.wordlists.EN);
    const inconnus = texte.split(' ').filter((mot) => mot && !liste.has(mot));
    return { inconnus, standard: inconnus.length === 0 && bip39.validateMnemonic(texte), numerosXaman: false };
  }

  /** Distance d'édition, une inversion de deux lettres voisines comptant pour une faute. */
  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cout = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  /**
   * Correction proposée pour un mot absent de la liste, ou null.
   * Dans la liste BIP39, les 4 premières lettres désignent un seul mot ; sinon on cherche
   * le mot le plus proche (2 fautes au plus), à condition qu'il soit le seul à cette distance.
   */
  function suggererMot(mot, liste) {
    const texte = String(mot).trim().toLowerCase();
    if (!texte) return null;
    if (texte.length >= 4) {
      const memeDebut = liste.filter((candidat) => candidat.startsWith(texte.slice(0, 4)));
      if (memeDebut.length === 1) return memeDebut[0];
    }
    let meilleurs = [];
    let minimum = 3;
    for (const candidat of liste) {
      const ecart = distance(texte, candidat);
      if (ecart < minimum) {
        minimum = ecart;
        meilleurs = [candidat];
      } else if (ecart === minimum) {
        meilleurs.push(candidat);
      }
    }
    return meilleurs.length === 1 ? meilleurs[0] : null;
  }

  // ---------- Création ----------

  /**
   * Nouveaux mots. 12 et 24 : phrase BIP39 standard. Autre nombre : mots tirés au hasard
   * dans la liste, sans somme de contrôle (ne se restaurent qu'avec cette application).
   */
  function genererMots(nombre) {
    const { bip39 } = bundle();
    if (nombre === 12) return bip39.generateMnemonic(128);
    if (nombre === 24) return bip39.generateMnemonic(256);
    const liste = bip39.wordlists.EN;
    // 65 536 est un multiple de 2 048 : le modulo ne favorise aucun mot.
    return Array.from(globalThis.crypto.getRandomValues(new Uint16Array(nombre)), (n) => liste[n % liste.length]).join(' ');
  }

  /** Numéros secrets Xaman (XRPL) : 8 séries de 6 chiffres. */
  function genererNumerosXaman() {
    return new (bundle().xrplNumbers.Account)().getSecretString();
  }

  function tranches(maitre, donnees) {
    const resultat = bundle().createHmac('sha512', maitre).update(donnees).digest();
    return { cle: resultat.slice(0, 32), chaine: resultat.slice(32) };
  }

  function deriverStellar(graineHexa) {
    const { Buffer } = bundle();
    const segments = CHEMIN_STELLAR.split('/').slice(1).map((s) => parseInt(s.replace("'", ''), 10));
    return segments.reduce(({ cle, chaine }, segment) => {
      const indice = Buffer.allocUnsafe(4);
      indice.writeUInt32BE(segment + 0x80000000, 0);
      return tranches(chaine, Buffer.concat([Buffer.alloc(1, 0), cle, indice]));
    }, tranches('ed25519 seed', Buffer.from(graineHexa, 'hex'))).cle;
  }

  async function paireStellar(mots) {
    const graineHexa = (await bundle().bip39.mnemonicToSeed(normaliser(mots))).toString('hex');
    return { graineHexa, paire: bundle().StellarSdk.Keypair.fromRawEd25519Seed(deriverStellar(graineHexa)) };
  }

  function walletXrpl(mots) {
    const { xrpl } = bundle();
    const texte = normaliser(mots);
    return NUMEROS_XAMAN.test(texte) ? xrpl.walletFromSecretNumbers(texte) : xrpl.Wallet.fromMnemonic(texte);
  }

  /**
   * Contenu du fichier wallet, au format de la version précédente (lu par les étapes 1 et 3) :
   * { privateKey, publicKey, classicAddress, seed } et, pour Stellar, seedHex.
   */
  async function creerWallet(chaine, mots) {
    const seed = normaliser(mots);
    if (chaine === 'XRPL') {
      const wallet = walletXrpl(seed);
      return { privateKey: wallet.privateKey, publicKey: wallet.publicKey, classicAddress: wallet.classicAddress, seed };
    }
    const { graineHexa, paire } = await paireStellar(seed);
    return { privateKey: paire.secret(), publicKey: paire.publicKey(), classicAddress: paire.publicKey(), seed, seedHex: graineHexa };
  }

  // ---------- Ouverture pour signer ----------

  /**
   * Ouvre une clé. source : { mots } ou { wallet } (contenu d'un fichier wallet).
   * Renvoie { chaine, adresse, signer(transaction, commeSignataire) }.
   */
  async function ouvrirCle(chaine, source) {
    const { xrpl, StellarSdk } = bundle();
    if (chaine === 'XRPL') {
      const wallet = source.wallet ? new xrpl.Wallet(source.wallet.publicKey, source.wallet.privateKey) : walletXrpl(source.mots);
      return {
        chaine,
        adresse: wallet.classicAddress,
        signer: (transaction, commeSignataire) => wallet.sign(transaction, !!commeSignataire),
      };
    }
    const paire = source.wallet
      ? StellarSdk.Keypair.fromRawEd25519Seed(deriverStellar(source.wallet.seedHex))
      : (await paireStellar(source.mots)).paire;
    return {
      chaine,
      adresse: paire.publicKey(),
      signer: (transaction) => {
        const tx = StellarSdk.TransactionBuilder.fromXDR(transaction.XDR, transaction.Network);
        tx.sign(paire);
        return { XDR: tx.toXDR(), Network: transaction.Network };
      },
    };
  }

  exporter('Cles', { listeMots, verifierMots, suggererMot, genererMots, genererNumerosXaman, creerWallet, ouvrirCle });
})(function (nom, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (window.Commun = window.Commun || {})[nom] = api;
});
