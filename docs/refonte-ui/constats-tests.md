# Constats révélés par les tests de caractérisation (lot 1)

> Relevés le 2026-10-14 sur le commit `702ccff`, en écrivant les tests de
> `tests/e2e/`. Aucun n'a été corrigé : ils sont signalés pour décision.
> Numérotation `T-xx` pour les distinguer des constats de l'audit (`F-xx`).

## Bugs

### T-01 · Page 4 : un rejet du réseau est annoncé comme une réussite
- **Constat** : si XRPL renvoie un code `tec…` (par exemple
  `tecUNFUNDED_PAYMENT`), la page affiche « OK ! Votre transaction a réussi.
  Mais elle n'a pas pu se terminer correctement sur la blockchain (). » Le code
  reste vide : le script écrit dans un `<b>` qui n'existe pas, le HTML contient
  un `<strong>`.
- **Conséquence** : l'utilisateur croit que les fonds sont partis alors que la
  transaction a échoué (seuls les frais sont prélevés).
- **Preuve** : `2.3…send/script.js:455` et `2.3…send.html:146` ; test
  `envoyer.spec.js`, « le code de résultat du réseau est affiché », marqué
  `test.fail` en attendant la correction.
- **Gravité proposée** : Élevée.

### T-02 · Page 2 : la réserve XRPL ignore les objets du compte
- **Constat** : le calcul lit `account_data.ownerCount` au lieu de
  `OwnerCount`. La réserve affichée est toujours la réserve de base.
- **Conséquence** : le montant « disponible » est surestimé ; un envoi du
  « Max » peut être rejeté par le réseau.
- **Preuve** : `2.1…prepare/script.js:299` ; référence
  `tests/donnees/preparations/xrpl-compte.json` (réserve `1` pour un compte à 2
  objets, au lieu de `1,4`).
- **Gravité proposée** : Moyenne.

### T-03 · Page 2 : les erreurs de préparation ne s'affichent jamais
- **Constat** : dans `prepareSend`, `prepareTrustSet` et `prepareDeleteAccount`,
  le bouton est déclaré avec `const` à l'intérieur du `try`, puis utilisé dans
  le `catch` et le `finally`, où il n'existe pas.
- **Conséquence** : en cas d'erreur réseau, aucun message n'apparaît et le
  bouton reste bloqué en chargement.
- **Preuve** : `2.1…prepare/script.js:1065` (`$prepTrxBut`), `:1201`
  (`$prepareTrustBtn`), `:1280` (`$prepareDelBtn`).
- **Gravité proposée** : Moyenne.

## Risques

### T-04 · Page 4 : le réseau XRPL (main ou test) n'est déduit que du nom de fichier
- **Constat** : `XRPL.isMain()` renvoie toujours `-1`. Le réseau ne vient que
  du suffixe `-main` ou `-test` du nom de fichier ; une transaction collée dans
  la zone de texte part vers le réseau sélectionné, mainnet par défaut.
- **Lien** : F-14. La refonte lit la chaîne et le réseau dans le contenu.

## Vérifications positives

- **Dérivation Stellar** : la dérivation écrite à la main retrouve les vecteurs
  officiels SEP-0005 (12 et 24 mots, compte 0). La crainte du TRD §3.2 est levée
  pour ce cas.
- **Bundle crypto** : le code embarqué dans les pages hors ligne est identique au
  paquet `securewalletbundle@2.5.4` publié, à trois espaces insécables près
  devenues des espaces ordinaires, plus un commentaire en tête. Cela n'établit
  pas la provenance du paquet (F-09 reste ouvert), mais exclut une version
  modifiée localement.
- **Signatures déterministes** : signer avec les mots ou avec le fichier wallet
  donne exactement le même résultat, sur les deux chaînes.
- **F-12 confirmé** : le paiement d'un jeton XRPL porte le drapeau de paiement
  partiel (`Flags: 131072`) sans `DeliverMin`.
