# Pocket Crypto Wallet

Gérer un compte **XRPL** ou **Stellar** en gardant ses clés sur un poste qui ne
se connecte jamais à internet.

Le principe : deux ordinateurs et une clé USB.

| Étape | Poste | Page | Ce qu'elle fait |
|---|---|---|---|
| 1 · Créer | hors ligne | `hors-ligne/1-creer-wallet.html` | Crée ou restaure un wallet : mots à écrire sur papier, fichier wallet chiffré, fichier d'adresse publique. |
| 2 · Préparer | en ligne | `en-ligne/2-preparer.html` | Lit le compte sur le réseau et prépare une transaction, sans aucun secret. |
| 3 · Signer | hors ligne | `hors-ligne/3-signer.html` | Montre la transaction en clair, puis la signe avec les mots ou le fichier wallet. |
| 4 · Envoyer | en ligne | `en-ligne/4-envoyer.html` | Vérifie la transaction signée et l'envoie sur le réseau. |

Les pages s'ouvrent directement dans le navigateur (`file://`), sans
installation ni serveur. Les pages en ligne (fond clair, bande sombre) ne
voient jamais de secret ; les pages hors ligne (fond sombre, bande claire) ne
se connectent à rien.

## Utilisation

1. **Poste hors ligne** — ouvrez la page 1, créez le wallet, écrivez les mots à
   la main. Enregistrez le fichier d'adresse publique (sans secret) sur la clé USB.
2. **Poste en ligne** — ouvrez la page 2, chargez l'adresse publique, préparez
   la transaction et enregistrez le fichier `.a-signer.json`.
3. **Poste hors ligne** — ouvrez la page 3, chargez ce fichier, **vérifiez le
   montant et le destinataire**, puis signez. Enregistrez le `.signee.json`.
4. **Poste en ligne** — ouvrez la page 4, chargez le fichier signé et envoyez-le
   avant l'heure limite (15 minutes après la préparation).

Commencez par Testnet (fonds fictifs) : la bande violette le signale.

### Opérations

Envoyer des fonds (XRP, XLM, jetons) · autoriser ou retirer un jeton · ajouter
ou retirer un signataire · désactiver ou réactiver la clé principale · supprimer
le compte. Une transaction d'un autre type est refusée à la signature : la
page 3 ne signe que ce qu'elle sait traduire en clair.

**Envoyer un jeton XRPL.** Certains émetteurs de jetons prélèvent des frais de
transfert à chaque paiement entre deux comptes. La page 2 lit ces frais sur le
réseau et les fait payer par l'expéditeur : le destinataire reçoit exactement
le montant saisi.

- Le disponible indique les frais (exemple : « Frais de l'émetteur : 0,5 % »),
  et « Max » les déduit du solde.
- Un montant qui, frais compris, dépasse le solde est refusé.
- Les pages 2, 3 et 4 affichent ce que vous paierez (exemple : « Vous paierez
  25,125 USD, dont 0,125 USD de frais de l'émetteur »).
- Envoyer à l'émetteur, ou depuis l'émetteur, ne coûte pas de frais.
- La livraison partielle n'est jamais utilisée : avec elle, le destinataire
  pourrait recevoir moins que le montant, et la transaction serait quand même
  déclarée réussie. La page 3 refuse de signer un tel paiement.

Stellar n'est pas concerné : un paiement Stellar simple ne comporte pas de frais
d'émetteur.

### Fichiers produits

| Fichier | Contient un secret ? |
|---|---|
| `xrpl_rHsM-N5v3.xrplwallet` (ou `.xlmwallet`) | Oui, chiffré par mot de passe |
| `xrpl_rHsM-N5v3.adresse-publique.txt` | Non |
| `xrpl-test_2026-10-14_paiement-10-xrp_18aba7.a-signer.json` | Non |
| `xrpl-test_2026-10-14_paiement-10-xrp_18aba7.signee.json` | Non (signée, plus modifiable) |

Le nom sert aux humains ; les pages lisent la chaîne, le réseau et le type dans
le contenu. Les six caractères de fin sont le début de l'**empreinte** de la
transaction : la même aux étapes 2, 3 et 4.

## Sécurité

**Ce qui protège**

- Les clés ne quittent jamais le poste hors ligne ; les pages 1 et 3 bloquent
  les secrets si elles détectent un réseau (sauf dérogation explicite).
- La page 3 affiche la transaction en clair avant toute signature et refuse les
  types ou champs qu'elle ne sait pas traduire. **C'est la vérification du
  montant et du destinataire, à cette étape, qui protège contre un poste en ligne
  compromis.**
- Une politique de sécurité du contenu interdit toute connexion aux pages hors
  ligne, et limite les pages en ligne aux serveurs des réseaux.
- Aucun contenu de fichier n'est interprété comme du HTML (test automatique).
- Paiement de jeton XRPL : jamais de livraison partielle (F-12). Si l'émetteur
  prend des frais de transfert, l'expéditeur les paie, et le récapitulatif montre
  ce qu'il paiera ; le destinataire reçoit exactement le montant. L'étape 3
  refuse de signer un paiement en livraison partielle.
- Le fichier wallet est toujours chiffré ; un mot de passe trop faible est refusé.
  Clé dérivée du mot de passe par PBKDF2-HMAC-SHA-256 (1 000 000 d'itérations,
  sel aléatoire), chiffrement authentifié AES-256-GCM : un fichier modifié est
  refusé. Les fichiers wallet des versions antérieures ne sont plus lus ;
  restaurez ces wallets à partir de leurs mots.

**Limites connues** (détail dans [docs/audit/findings.md](docs/audit/findings.md)
et [docs/refonte-ui/constats-tests.md](docs/refonte-ui/constats-tests.md))

- **Fichier wallet volé** : il ne résiste qu'autant que son mot de passe.
  PBKDF2 ralentit chaque essai mais, contrairement à Argon2id (envisagé avec
  P2-2), ne gêne pas les cartes graphiques. Gardez le fichier comme un secret ;
  vos mots restent la vraie sauvegarde.
- **Effacement en mémoire non garanti (F-03)** : « Terminer et effacer l'écran »
  vide l'écran et les variables de la page, pas la mémoire du navigateur.
  Fermez le navigateur après usage.
- **Réseau XRPL non vérifiable hors ligne (T-08)** : rien ne distingue une
  transaction XRPL Mainnet d'une Testnet ; la page 3 n'affiche donc pas le réseau
  XRPL. Vérifiez toujours comme si les fonds étaient réels.
- **Clé ordinaire XRPL (RegularKey) non prise en charge (T-07)** : seules la clé
  principale et un signataire (multisignature) peuvent signer.
- **Provenance du bundle crypto (F-09)** : `commun/securewalletbundle-2.5.4.js`
  est identique au paquet npm publié, mais sa reconstruction n'est pas encore
  vérifiable (P2-2).

## Structure du dépôt

```
hors-ligne/            pages 1 et 3 (HTML + script de page)
en-ligne/              pages 2 et 4
commun/
  commun.css           styles des 4 pages (aucun style dans le HTML)
  polices/             Atkinson Hyperlegible Next et Mono, embarquées
  securewalletbundle-2.5.4.js   bibliothèques crypto (xrpl.js, Stellar SDK, bip39)
  format.js            affichage des montants, adresses, empreintes, durées
  fichiers.js          noms et format des fichiers de transaction
  transactions.js      traduction en clair, empreinte, échéance
  bordereau.js         affichage d'une transaction (pages 2 à 4)
  cles.js              création et ouverture des clés
  coffre.js            chiffrement du fichier wallet
  securite.js          robustesse des mots de passe
  poste.js             détection d'un réseau (pages hors ligne)
  connexion.js         serveurs des réseaux (pages en ligne)
  reseau.js            délai de validité, refus du réseau expliqués
  historique.js        transactions préparées sur ce poste (données publiques)
  interface.js         comportements partagés (adresses, choix, appui maintenu, tiroirs)
  specimen.html        page de référence des composants
docs/
  audit/               audit technique et produit
  refonte-ui/          plan de la refonte de l'interface et constats des tests
tests/                 tests (voir ci-dessous)
```

Les scripts sont des scripts classiques (pas de modules : ils doivent
fonctionner en `file://`). Chaque module de `commun/` s'expose sous
`window.Commun` dans les pages et par `require()` dans les tests.

## Développement

```sh
npm ci                     # Playwright, pour les tests seulement
npx playwright install chromium
npm run test:unitaire      # node --test
npm run test:e2e           # Playwright, pages en file://, réseau simulé
```

- `tests/unitaire/` : modules de `commun/`, contrastes des couleurs, et un
  contrôle qui interdit `innerHTML`, `eval`, les styles et scripts dans le HTML.
- `tests/e2e/` : chaque page, le cycle complet sur les deux chaînes, la
  politique de sécurité du contenu, le clavier. Les pilotes (`tests/e2e/pilotes/`)
  sont seuls à connaître l'écran. Aucune requête ne sort vers internet : le nœud
  XRPL et le serveur Horizon sont simulés.
- `tests/donnees/` : vecteurs connus (dont SEP-0005) et références.