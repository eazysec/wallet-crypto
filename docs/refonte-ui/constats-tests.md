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
- **Suivi** : corrigé au lot 4. Un rejet est présenté comme un refus, avec la raison en clair, la marche à suivre et le code.

### T-02 · Page 2 : la réserve XRPL ignore les objets du compte
- **Constat** : le calcul lit `account_data.ownerCount` au lieu de
  `OwnerCount`. La réserve affichée est toujours la réserve de base.
- **Conséquence** : le montant « disponible » est surestimé ; un envoi du
  « Max » peut être rejeté par le réseau.
- **Preuve** : `2.1…prepare/script.js:299` ; référence
  `tests/donnees/preparations/xrpl-compte.json` (réserve `1` pour un compte à 2
  objets, au lieu de `1,4`).
- **Gravité proposée** : Moyenne.
- **Suivi** : corrigé au lot 5, référence mise à jour explicitement.

### T-03 · Page 2 : les erreurs de préparation ne s'affichent jamais
- **Constat** : dans `prepareSend`, `prepareTrustSet` et `prepareDeleteAccount`,
  le bouton est déclaré avec `const` à l'intérieur du `try`, puis utilisé dans
  le `catch` et le `finally`, où il n'existe pas.
- **Conséquence** : en cas d'erreur réseau, aucun message n'apparaît et le
  bouton reste bloqué en chargement.
- **Preuve** : `2.1…prepare/script.js:1065` (`$prepTrxBut`), `:1201`
  (`$prepareTrustBtn`), `:1280` (`$prepareDelBtn`).
- **Gravité proposée** : Moyenne.
- **Suivi** : corrigé au lot 5. Toute erreur de préparation est affichée en clair et le bouton redevient utilisable.

### T-05 · Pages en ligne : injection de HTML depuis le contenu d'un fichier
- **Constat** : la page 4 construit le récapitulatif en concaténant du HTML avec
  des champs lus dans le fichier chargé (tag ou mémo, code de devise,
  adresses), puis l'insère avec `.html()`. La page 2 fait de même avec les
  messages d'erreur renvoyés par le réseau. Aucune politique de sécurité du
  contenu ne limite ce qui s'exécute (F-10).
- **Conséquence** : un fichier piégé peut exécuter du code dans la page en
  ligne. Exemple : `<img src=x onerror=alert(1)>` tient dans les 28 caractères
  d'un mémo Stellar ; un code de devise XRPL de 40 caractères hexadécimaux se
  décode en texte libre.
- **Preuve** : `en-ligne/4-envoyer.js:352-422` (construction et insertion du récapitulatif) et `:436-462` (résultat et erreurs) ;
  `en-ligne/2-preparer.js`, 16 appels à `.html()` ou `innerHTML`.
- **Gravité proposée** : Élevée.
- **Suite** : le nouveau code n'écrit que du texte (`textContent`). Le test
  `tests/unitaire/injection.test.js` interdit `innerHTML`, `.html()`, `eval`,
  les scripts, gestionnaires et styles écrits dans le HTML, ainsi que les
  champs secrets sans `spellcheck="false"`. Les anciens fichiers y figurent
  comme exceptions temporaires, retirées à la migration de chaque page.
- **Suivi** : page 4 corrigée au lot 4 (un mémo piégé s'affiche comme du texte, test à l'appui) ; page 2 corrigée au lot 5 (un message d'erreur piégé du réseau s'affiche comme du texte).

### T-06 · Page 2 : un paiement de jeton XRPL de 10 part en paiement de 1
- **Constat** : le montant d'un paiement de jeton XRPL est « nettoyé » avec
  `replace(/\.?0+$/, '')`, qui retire tous les zéros finaux, même sans
  virgule : 10 devient 1, 1 500 devient 15, 200 devient 2.
- **Conséquence** : le montant préparé, puis signé et envoyé, est divisé par 10,
  100 ou plus. Le récapitulatif l'affiche, mais l'écart passe facilement
  inaperçu.
- **Preuve** : `en-ligne/2-preparer.js:367` (avant refonte) ; test
  `preparer.spec.js`, « un paiement de 10 USD prépare bien 10 USD », qui échoue
  sur l'ancienne page (`"1"` au lieu de `"10"`). Les tests de caractérisation
  ne l'avaient pas vu : ils utilisaient 25 USD.
- **Gravité proposée** : Élevée.
- **Suivi** : corrigé au lot 5 : le montant saisi est transmis tel quel.

## Risques

### T-04 · Page 4 : le réseau XRPL (main ou test) n'est déduit que du nom de fichier
- **Constat** : `XRPL.isMain()` renvoie toujours `-1`. Le réseau ne vient que
  du suffixe `-main` ou `-test` du nom de fichier ; une transaction collée dans
  la zone de texte part vers le réseau sélectionné, mainnet par défaut.
- **Lien** : F-14. La refonte lit la chaîne et le réseau dans le contenu.
- **Suivi** : corrigé au lot 4. Pour un fichier XRPL de l'ancien format, qui n'indique pas le réseau, la page demande de le choisir : il n'y a plus de réseau par défaut.

### T-07 · Page 3 : la clé ordinaire XRPL (RegularKey) n'est pas prise en charge
- **Constat** : l'ancienne page 3 signe en multisignature, frais doublés, avec
  toute clé autre que celle du compte. Une clé ordinaire (RegularKey) doit au
  contraire signer seule : d'après les règles du réseau XRPL, la transaction
  produite serait refusée (non vérifié sur un vrai nœud).
- **Suivi** : comportement conservé au lot 6. L'étape 2 ne compte plus la clé
  ordinaire parmi les clés autorisées, et l'étape 3 refuse donc cette clé dès son
  ouverture, avec un message, au lieu de produire une transaction invalide. La
  prendre en charge demanderait d'inscrire le rôle de chaque clé dans le
  fichier : à décider.

### T-08 · Page 3 : le réseau XRPL (Mainnet ou Testnet) ne se vérifie pas hors ligne
- **Constat** : rien dans une transaction XRPL ne distingue Mainnet de Testnet,
  et le champ `reseau` du fichier de l'étape 2 n'est pas protégé. Un poste en
  ligne piraté pourrait préparer un vrai paiement Mainnet étiqueté Testnet :
  l'étape 3 affichait alors « Testnet · fonds fictifs, sans valeur », une fausse
  assurance au moment où il faut être le plus vigilant. L'ancienne page
  n'affichait pas le réseau ; l'étiquette était une nouveauté de la refonte.
- **Suivi** : corrigé au lot 8. Pour XRPL, l'étape 3 n'affiche plus de réseau
  (ni bandeau, ni libellé, ni conseil) ; l'aide explique pourquoi. Le réseau
  reste affiché aux étapes 2 et 4. Stellar n'est pas concerné : le réseau fait
  partie de ce qui est signé, et une enveloppe qui le contredit est refusée.

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
