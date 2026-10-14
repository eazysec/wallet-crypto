# Findings — Inventaire des faiblesses, risques et constats

> Chaque constat précise : **description & conséquence**, **preuve**
> (fichier:ligne), **gravité**, **confiance**, **recommandation**.
>
> **Statut** : `Avéré` (démontré par le code) · `À confirmer` (risque probable,
> validation nécessaire) · `Amélioration` (piste, pas un défaut bloquant).
>
> **Gravité** : Critique · Élevée · Moyenne · Faible — au regard de l'impact sur
> la sécurité des fonds, l'intégrité des transactions, la fiabilité et la
> maintenabilité.
>
> **Confiance** : Élevée · Moyenne · Faible (certitude de l'audit sur le constat
> lui-même).

## Tableau récapitulatif

| Réf | Constat | Gravité | Statut | Confiance |
|-----|---------|---------|--------|-----------|
| [F-01](#f-01) | Clé = SHA-256(mdp), sans KDF/sel/itérations | Critique | Avéré | Élevée |
| [F-02](#f-02) | AES-CBC non authentifié (ni GCM ni MAC) | Élevée | Avéré | Élevée |
| [F-03](#f-03) | Effacement mémoire des secrets illusoire | Élevée | Avéré | Élevée |
| [F-04](#f-04) | Export du wallet en clair autorisé | Élevée | Avéré | Élevée |
| [F-05](#f-05) | Saisie des secrets via `prompt()` non masqué | Moyenne | Avéré | Élevée |
| [F-06](#f-06) | Vérification lisible après signature, pas avant | Élevée | Avéré | Élevée |
| [F-07](#f-07) | Pages offline non bloquées si en ligne | Moyenne | Avéré | Élevée |
| [F-08](#f-08) | Dépendances online via CDN tiers (objectif « local » non tenu) | Élevée | Avéré | Élevée |
| [F-09](#f-09) | Provenance/intégrité du bundle non vérifiée | Moyenne | À confirmer | Moyenne |
| [F-10](#f-10) | Aucune CSP | Moyenne | Avéré | Élevée |
| [F-11](#f-11) | Bootstrap 5.2.0-beta1 en production | Faible | Avéré | Élevée |
| [F-12](#f-12) | `tfPartialPayment` sans `DeliverMin` | Moyenne | Avéré | Moyenne |
| [F-13](#f-13) | Aucun test, aucun outillage | Moyenne | Avéré | Élevée |
| [F-14](#f-14) | Entrées non gardées (robustesse) | Faible | Avéré | Élevée |
| [F-15](#f-15) | Documentation en décalage avec le code | Faible | Avéré | Élevée |
| [F-16](#f-16) | Fuites de confidentialité (CDN, APIs prix) | Faible | Avéré | Moyenne |

---

<a id="f-01"></a>
## F-01 — Dérivation de clé absente : la clé AES est un simple SHA-256 du mot de passe

- **Gravité : Critique · Statut : Avéré · Confiance : Élevée**
- **Description** : la clé de chiffrement du fichier wallet est obtenue par
  `SHA-256(password)` utilisée directement comme clé AES-256. Aucune fonction de
  dérivation de clé (PBKDF2/scrypt/Argon2), **aucun sel**, **aucune itération**.
- **Conséquence** : une attaque hors-ligne par dictionnaire/force brute sur un
  fichier wallet volé est triviale et massivement parallélisable (un seul
  SHA-256 par essai). L'absence de sel permet les tables précalculées et rend
  deux wallets protégés par le même mot de passe détectables/attaquables
  ensemble. **Un fichier wallet chiffré volé doit être considéré comme exposé si
  le mot de passe n'est pas de très haute entropie.** Le `README` affirme une
  « dérivation de clé sécurisée », ce qui est **faux**.
- **Preuve** :
  - `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:149-152` (chiffrement)
  - `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:167-169` (déchiffrement)
  - `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:138-141`
  - `README.md:83` (« AES-256 avec dérivation de clé sécurisée »)
- **Recommandation** : dériver la clé via **PBKDF2-HMAC-SHA-256 (≥ 600 000
  itérations)**, idéalement **scrypt** ou **Argon2id**, avec un **sel aléatoire
  de 16 octets** généré par chiffrement et stocké en tête du fichier. Versionner
  le format. Corriger la documentation.

---

<a id="f-02"></a>
## F-02 — Chiffrement non authentifié (AES-CBC sans MAC)

- **Gravité : Élevée · Statut : Avéré · Confiance : Élevée**
- **Description** : le chiffrement utilise **AES-CBC** sans aucun mécanisme
  d'authentification (ni AES-GCM, ni HMAC encrypt-then-MAC).
- **Conséquence** : pas de garantie d'intégrité : un ciphertext altéré n'est pas
  détecté de façon fiable (CBC est malléable). La détection d'erreur repose
  uniquement sur l'échec fortuit du `JSON.parse` après déchiffrement. Expose à
  des manipulations ciblées du fichier wallet et masque la corruption.
- **Preuve** : `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:151,168` ;
  `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:140`.
- **Recommandation** : utiliser **AES-256-GCM** (AEAD, tag d'authentification)
  via WebCrypto, ou à défaut **encrypt-then-HMAC-SHA-256**. Lier le sel et l'IV
  aux données authentifiées.

---

<a id="f-03"></a>
## F-03 — « Effacement » des secrets en mémoire illusoire

- **Gravité : Élevée · Statut : Avéré · Confiance : Élevée**
- **Description** : le code prétend effacer seed-phrases, mots de passe et
  clés en **réassignant la variable** (`seedPhrase = "…erased…"`). En JavaScript
  les chaînes sont **immuables** : la réassignation ne détruit pas l'original en
  mémoire. De plus, les secrets sont **copiés dans le DOM** (`#seedphrase`,
  `#walletfulljs`, `#publicaddr`), dans des `Blob` d'export, et restent soumis
  au GC non déterministe.
- **Conséquence** : faux sentiment de sécurité. Les secrets restent récupérables
  (inspection mémoire, dump, DOM, historique du navigateur). Le `prompt()`
  affiche de surcroît la valeur en clair (voir [F-05](#f-05)).
- **Preuve** :
  - `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:300,321-323,326,341`
  - `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:46,99,215,263`
- **Recommandation** : retirer les prétentions d'effacement ; vider
  explicitement les champs DOM après usage ; limiter les copies ; documenter
  honnêtement la réalité (JS ne permet pas un effacement fiable de la mémoire).
  Pour un vrai effacement, envisager des `Uint8Array` zeroisés et une appli
  packagée (hors navigateur).

---

<a id="f-04"></a>
## F-04 — Export du wallet en clair autorisé (mot de passe optionnel)

- **Gravité : Élevée · Statut : Avéré · Confiance : Élevée**
- **Description** : à l'export, si l'utilisateur laisse le mot de passe vide, le
  wallet (dont la **clé privée**) est écrit **en clair** sur le disque.
- **Conséquence** : fichier contenant la clé privée en clair, trivialement
  compromis en cas d'accès au disque, de sauvegarde cloud, de corbeille, etc.
- **Preuve** : `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:333-340`.
- **Recommandation** : rendre le chiffrement **obligatoire**, ou imposer une
  confirmation explicite et un avertissement bloquant si l'utilisateur refuse.
  Exiger un mot de passe de robustesse minimale (mesure d'entropie).

---

<a id="f-05"></a>
## F-05 — Saisie des secrets via `prompt()` non masqué

- **Gravité : Moyenne · Statut : Avéré · Confiance : Élevée**
- **Description** : la seed-phrase et le mot de passe sont saisis via
  `window.prompt()`, qui **affiche la saisie en clair** à l'écran et ne masque
  rien.
- **Conséquence** : exposition visuelle (épaule, capture, partage d'écran), et
  valeur conservée telle quelle en mémoire. Contredit l'instruction affichée
  « à l'abri des regards ».
- **Preuve** :
  - `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:226,296,333`
  - `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:207,257`
- **Recommandation** : champs `<input type="password">` dédiés, avec option
  d'affichage volontaire, focus hors-DOM persistant, et nettoyage après usage.

---

<a id="f-06"></a>
## F-06 — La vérification lisible de la transaction a lieu après la signature (en ligne), pas avant (hors-ligne)

- **Gravité : Élevée · Statut : Avéré · Confiance : Élevée**
- **Description** : le décodage « lisible par un humain » d'une transaction
  (`NETWORK.decode`, affichage du type, montant, destinataire, frais) n'existe
  que dans la page **ONLINE 2.3 (envoi)**. La page **OFFLINE 2.2 (signature)**
  signe le **JSON brut** sans aucun décodage assisté.
- **Conséquence** : la validation du **sens** de la transaction se fait **après**
  la signature et **sur la zone non fiable** (online). Si la page de préparation
  (online, supposée non fiable dans un modèle air-gap) est compromise, elle peut
  forger une transaction (ex. changer le destinataire) que l'utilisateur
  **signe hors-ligne sans l'avoir comprise**. La signature étant déjà valide, la
  dernière barrière n'est qu'un refus manuel d'envoi — trop tard pour protéger
  la clé, et contournable si l'envoi est automatisé ailleurs.
- **Preuve** :
  - Décodeur présent uniquement online : `ONLINE_transaction/2.3.ONLINE_transaction-send/script.js:53-253` (méthodes `decode`) et `:352-425` (`_online_.check`, affichage).
  - Signature sans décodage : `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:266-277` (la fonction `sign` parse et signe le JSON tel quel).
- **Recommandation** : porter la logique `decode()` + l'affichage récapitulatif
  dans la page **2.2**, et **exiger une confirmation explicite** du sens de la
  transaction **avant** signature. La zone de confiance (offline) doit être
  l'endroit où l'humain valide.

---

<a id="f-07"></a>
## F-07 — Les pages « offline » ne bloquent pas leur usage quand la machine est en ligne

- **Gravité : Moyenne · Statut : Avéré · Confiance : Élevée**
- **Description** : les pages offline détectent l'état réseau
  (`navigator.onLine`) et affichent une **bannière informative**, mais ne
  **désactivent aucune opération sensible** (génération de clés, signature)
  lorsque la machine est connectée.
- **Conséquence** : un utilisateur peut, par erreur, générer une seed-phrase ou
  signer une transaction sur une machine en ligne, annulant la protection
  air-gap. Rien ne l'en empêche techniquement.
- **Preuve** : `OFFLINE_wallet/1.OFFLINE_wallet-generation.html:203-210` (simple
  `$show('nav-state-online')`), `:790` (carte de statut). Aucune désactivation
  de bouton associée.
- **Recommandation** : **bloquer** la génération et la signature si
  `navigator.onLine === true`, avec message explicite et dérogation volontaire
  consciente (case à cocher + avertissement). Garder à l'esprit que
  `navigator.onLine` est indicatif, pas une preuve d'isolation.

---

<a id="f-08"></a>
## F-08 — Objectif « dépendances locales » non tenu : les pages online chargent depuis des CDN tiers

- **Gravité : Élevée · Statut : Avéré · Confiance : Élevée**
- **Description** : l'objectif affiché du projet est de conserver les
  bibliothèques localement pour limiter l'exposition supply-chain. Or les pages
  **online** chargent le bundle crypto et l'UI depuis **unpkg**, **cdnjs** et
  **jsdelivr**. Seules les pages offline inlinent leurs dépendances.
- **Conséquence** : dépendance à la disponibilité et à l'intégrité de tiers ;
  surface d'attaque supply-chain ; télémétrie implicite (voir [F-16](#f-16)).
  Le SRI atténue l'altération du contenu servi mais **ne couvre pas** la
  disponibilité, ni un éventuel pinning de version compromise à la source, ni
  l'absence de CSP ([F-10](#f-10)).
- **Preuve** :
  - `ONLINE_transaction/2.1.ONLINE_transaction-prepare/2.1.ONLINE_transaction-prepare.html:17,23,26,534`
  - `ONLINE_transaction/2.3.ONLINE_transaction-send/2.3.ONLINE_transaction-send.html:12,18,21,211`
  - Contredit `README.md` (intention « local ») et la description du commanditaire.
- **Recommandation** : héberger **toutes** les dépendances localement pour les 4
  pages (inlining ou fichiers servis en `self`), figer les versions, conserver
  le SRI **et** ajouter une CSP restrictive.

---

<a id="f-09"></a>
## F-09 — Provenance et intégrité du bundle `securewalletbundle@2.5.4` non vérifiées

- **Gravité : Moyenne · Statut : À confirmer · Confiance : Moyenne**
- **Description** : le cœur cryptographique est un paquet npm **non standard**
  (`securewalletbundle`, origine « Decrypto » / `MySuperSecuredWallet-V2.5.4`),
  distribué minifié (~1,38 Mo) et inliné dans les pages offline. Il n'a **pas pu
  être audité** (reverse-engineering d'un blob minifié hors périmètre) ni relié
  cryptographiquement au paquet publié (aucun téléchargement/opération réseau,
  conformément aux règles de la mission).
- **Éléments rassurants (scan de surface, non exhaustif)** : marqueurs de
  bibliothèques légitimes présents (`xrplf`, `ripple-address-codec`,
  `ripple-binary-codec`, `ripple-keypairs`, `@noble` ed25519/secp256k1,
  `stellar-sdk`, `bip39`) ; **aucun endpoint d'exfiltration en clair** détecté
  (seuls `example.com`, `datatracker.ietf.org`, `json-schema.org`, `localhost`).
  Les occurrences `XMLHttpRequest`/`localStorage`/`document.cookie` sont
  cohérentes avec `stellar-sdk`.
- **Conséquence** : un bundle crypto non vérifié qui manipule des clés privées
  est un **point de confiance unique** majeur. Une version altérée pourrait
  compromettre toutes les clés sans trace évidente.
- **Preuve** :
  - Inliné et identique entre les deux pages offline (sha256 vérifié sur les
    lignes 21 et 22 respectivement).
  - Référencé via CDN sur les pages online (voir [F-08](#f-08)) avec SRI
    `sha256-2ZubSXQsoaoPU0YsTc6BkLBXVfEHjBysA4v/e+HDwHw=`.
- **Recommandation / investigation** : reconstruire le bundle depuis des sources
  **auditables et épinglées** (xrpl.js, stellar-sdk, bip39 aux versions
  connues), vérifier l'intégrité vs source officielle, publier le script de
  build et le hash attendu. À défaut, auditer le blob (désobfuscation) avant
  toute mise en production avec de vrais fonds.

---

<a id="f-10"></a>
## F-10 — Aucune Content-Security-Policy

- **Gravité : Moyenne · Statut : Avéré · Confiance : Élevée**
- **Description** : aucune des 4 pages ne définit de CSP (ni balise
  `http-equiv`, ni en-tête documenté).
- **Conséquence** : en cas d'injection (XSS) ou de dépendance compromise, rien
  ne restreint les origines vers lesquelles des données (clés, transactions)
  pourraient être exfiltrées. Critique pour une application manipulant des
  secrets.
- **Preuve** : recherche « Content-Security-Policy » → **aucune occurrence** ;
  seules des balises `meta` author/description/version présentes
  (`2.1…prepare.html:11-13`, `2.3…send.html:6-8`, offline `…:7-10/8-10`).
- **Recommandation** : CSP stricte. Pages offline : `default-src 'none'` +
  autorisations minimales `'self'`/`'unsafe-inline'` limitées, **aucune**
  origine réseau. Pages online : liste blanche explicite des nœuds et APIs
  réellement utilisés.

---

<a id="f-11"></a>
## F-11 — Bootstrap 5.2.0-beta1 utilisé en « production »

- **Gravité : Faible · Statut : Avéré · Confiance : Élevée**
- **Description** : une version **beta** de Bootstrap est référencée.
- **Conséquence** : bugs/évolutions non stabilisés, surface inutilement
  incertaine.
- **Preuve** : `ONLINE_transaction/2.1.ONLINE_transaction-prepare/STRUCTURE.md:73`
  et balises `link`/`script` des pages online ; CSS inliné des pages offline
  issu de la même origine (commentaire `…bootstrap@5.2.0-beta1…`).
- **Recommandation** : passer à une version **stable** figée (ex. 5.3.x) et
  l'héberger localement (cf. [F-08](#f-08)).

---

<a id="f-12"></a>
## F-12 — `tfPartialPayment` positionné sur les paiements d'assets émis, sans `DeliverMin`

- **Gravité : Moyenne · Statut : Avéré · Confiance : Moyenne**
- **Description** : pour un paiement XRPL d'asset émis (currency avec issuer), le
  flag `tfPartialPayment` est ajouté, **sans** champ `DeliverMin`. Avec ce flag,
  `Amount` devient un **maximum** et le montant réellement livré peut être
  inférieur.
- **Conséquence** : le destinataire peut recevoir **moins** que le montant
  affiché dans le récapitulatif, sans plancher garanti. Classique « partial
  payment footgun » XRPL ; risque de malentendu, voire d'abus selon le contexte.
- **Preuve** : `ONLINE_transaction/2.1.ONLINE_transaction-prepare/script.js:370`.
- **Recommandation** : ne pas activer `tfPartialPayment` par défaut ; si
  nécessaire pour la fiabilité de chemin, définir un `DeliverMin` et **l'afficher
  clairement** dans le récapitulatif de préparation et de vérification.

---

<a id="f-13"></a>
## F-13 — Aucun test automatisé, aucun outillage de qualité

- **Gravité : Moyenne · Statut : Avéré · Confiance : Élevée**
- **Description** : pas de tests (unitaires/intégration/e2e), pas de
  `package.json`, pas de lockfile, pas de linter, pas de CI.
- **Conséquence** : les chemins critiques (dérivation de clés, signature,
  encodage/décodage de devises `cur40`, calcul de frais multisign, round-trip de
  chiffrement, dérivation ed25519 « maison » de Stellar) ne sont **pas
  validés**. Toute régression passe inaperçue.
- **Preuve** : `find` sur `package*.json`, `*.lock`, `*.test.js`, `.github` →
  **aucun résultat**.
- **Recommandation** : introduire une suite de tests avec **vecteurs connus**
  (BIP39, SEP-0005 pour Stellar), round-trip chiffrement, cas d'encodage de
  devises, et scénarios de décodage de transactions. Ajouter linter + CI.

---

<a id="f-14"></a>
## F-14 — Entrées non gardées (robustesse)

- **Gravité : Faible · Statut : Avéré · Confiance : Élevée**
- **Description** : plusieurs entrées externes ne sont pas protégées contre les
  cas limites.
- **Conséquence** : exceptions non gérées, états UI incohérents.
- **Preuve** (exemples) :
  - Parsing du nom de fichier : `file.name.match(/\-[^\.\-]+/g)` peut renvoyer
    `null`, puis `.length` lève une exception —
    `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html:171-172`,
    `ONLINE_transaction/2.3.ONLINE_transaction-send/script.js:523-524`.
  - `getSignersList` (Stellar) : `masterSigner` peut rester `undefined` puis
    `masterSigner.weight` —
    `ONLINE_transaction/2.1.ONLINE_transaction-prepare/script.js:720-733`.
- **Recommandation** : ajouter des gardes (`match` → vérifier `null`), valeurs
  par défaut, et messages d'erreur utilisateurs explicites.

---

<a id="f-15"></a>
## F-15 — Documentation en décalage avec le code

- **Gravité : Faible · Statut : Avéré · Confiance : Élevée**
- **Description** : plusieurs affirmations de la documentation ne correspondent
  pas au code.
- **Conséquence** : décisions mal informées, fausse assurance de sécurité,
  confusion de maintenance.
- **Preuve** (exemples) :
  - « dérivation de clé sécurisée » — contredit par [F-01](#f-01)
    (`README.md:83`).
  - « 100 % offline » / « isolation stricte » — nuancé par [F-07](#f-07).
  - « Vérification d'intégrité CDN » / « dépendances locales » — contredit par
    [F-08](#f-08) (`STRUCTURE.md:132-135`, `README.md`).
  - Arborescence `package/`, `index.html`, `assets/` décrite dans
    `STRUCTURE.md:5-25` mais **inexistante**.
  - Deux APIs de prix distinctes : CoinGecko (`2.1…script.js:10`) et Bitget
    (`2.1…script.js:905`, `config.js:66`).
- **Recommandation** : aligner la documentation sur le code réel ; retirer les
  garanties non tenues ; marquer clairement les sections « prévu / non
  implémenté ».

---

<a id="f-16"></a>
## F-16 — Fuites de confidentialité (CDN et APIs de prix)

- **Gravité : Faible · Statut : Avéré · Confiance : Moyenne**
- **Description** : les pages online sollicitent des CDN tiers ([F-08](#f-08)) et
  des APIs de prix (CoinGecko, Bitget), révélant l'usage de l'application à des
  tiers. Les nœuds publics par défaut (`xrplcluster.com`, Horizon) voient les
  adresses interrogées (inhérent, mais aggravé par le choix mainnet public par
  défaut).
- **Conséquence** : corrélation d'activité, exposition d'adresses à des services
  tiers, métadonnées exploitables.
- **Preuve** : `ONLINE_transaction/2.1.ONLINE_transaction-prepare/script.js:10,66,905`
  ; URLs de serveurs `:212,511`.
- **Recommandation** : permettre un **nœud auto-hébergé** (déjà prévu dans
  `config.js` → `development.localServers`), rendre les appels de prix
  optionnels, documenter les flux réseau et proposer un mode « sans télémétrie ».
