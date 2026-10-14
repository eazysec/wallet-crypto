# TRD — Technical Design Document (audit)

> Document d'audit technique. `✅ Confirmé par le code` vs `➕ Recommandation /
> décision à prendre`. Références sous la forme `fichier:ligne`.

## 1. Architecture actuelle (✅ Confirmée)

### 1.1 Nature
Application **100 % front-end statique** : 4 pages HTML autonomes, aucun
backend, aucun outil de build, aucun gestionnaire de paquets. Chaque page est
ouvrable directement (`file://`) ou servie en statique.

```
SecuredWallet/
├── OFFLINE_wallet/
│   ├── 1.OFFLINE_wallet-generation.html     ← génération/récupération (clés privées)
│   ├── 2.2.OFFLINE_transaction-sign.html    ← signature (clés privées)
│   └── todo.txt
├── ONLINE_transaction/
│   ├── 2.1.ONLINE_transaction-prepare/      ← HTML + styles.css + script.js + config.js
│   └── 2.3.ONLINE_transaction-send/         ← HTML + styles.css + script.js
└── README.md
```

> Note : `STRUCTURE.md` décrit une arborescence (`package/`, `index.html`,
> `assets/`…) **qui n'existe pas** dans le dépôt — [F-15](findings.md#f-15).

### 1.2 Pages OFFLINE
Le CSS Bootstrap (~193 Ko) et le bundle crypto `SecureWalletBundle` (~1,38 Mo
minifié) sont **inlinés** dans le HTML (generation ligne 15 et 21 ; sign ligne
16 et 22). Les deux pages partagent le **même bundle, octet pour octet**
(sha256 identique vérifié). Conséquence : les pages offline sont autonomes et
n'ont besoin d'aucun réseau.

### 1.3 Pages ONLINE
Les dépendances sont chargées depuis des **CDN tiers** (`2.1.ONLINE_transaction-prepare.html:17,23,26,534` ; `2.3.ONLINE_transaction-send.html:12,18,21,211`) :
- Bootstrap 5.2.0-beta1 — `cdn.jsdelivr.net`
- jQuery 3.6.0 — `cdnjs.cloudflare.com`
- SecureWalletBundle 2.5.4 — `unpkg.com`

SRI (`integrity=`) présent sur ces balises. Logique applicative dans
`script.js`, configuration fusionnable dans `config.js` (+ `user-config.js`
optionnel).

### 1.4 Responsabilités par module

| Module | Responsabilité | Entrées sensibles |
|--------|----------------|-------------------|
| `1.OFFLINE…generation.html` | Entropie, dérivation d'adresse, chiffrement fichier | seed-phrase, mot de passe, **clé privée** |
| `2.2.OFFLINE…sign.html` | Décodage seed→clé, signature trx | seed-phrase / fichier wallet, **clé privée** |
| `2.1…prepare/script.js` | Lecture on-chain, construction trx non signées | adresses publiques uniquement |
| `2.3…send/script.js` | Décodage lisible, diffusion | transaction signée (publique) |
| `2.1…config.js` | Config réseaux, UI, sécurité, dev | — |

### 1.5 Patron de conception récurrent
Chaque page définit un objet `CLASSES = { "XRPL": class…, "XLM": class… }`
exposant une interface commune (`isLibLoaded`, `switchServer`, `prepare*`,
`sign`, `decode`, `send`…). Un objet `NETWORK` porte l'instance active. C'est un
polymorphisme propre et cohérent entre les 4 pages — **point fort de
l'architecture**.

## 2. Flux de données (✅ Confirmé)

```
[OFFLINE 1]  entropie CSPRNG ─▶ seed BIP39 ─▶ (xrpl.js / stellar-sdk) ─▶ {privateKey, publicKey, address}
                                                     │
                                                     ├─▶ affichage DOM (#seedphrase, #walletfulljs, #publicaddr)
                                                     └─▶ export .xrplwallet/.xlmwallet  (chiffré woff_encrypt | ou EN CLAIR)

[ONLINE 2.1] adresse publique ─▶ WebSocket/HTTP vers réseau ─▶ autofill/build ─▶ .tosign.json (transaction NON signée)

[OFFLINE 2.2] .tosign.json + (seed | fichier wallet) ─▶ NETWORK.sign() ─▶ .signed.json
              (⚠️ pas de décodage lisible ici — signature « à l'aveugle » sur JSON brut)

[ONLINE 2.3] .signed.json ─▶ NETWORK.decode() ─▶ récapitulatif lisible ─▶ submit ─▶ résultat + lien explorateur
```

**Transfert inter-étapes** : fichiers JSON téléchargés/rechargés manuellement
(pas de canal automatique). L'auto-détection réseau se fait par parsing du
contenu JSON (`isSuchTransaction`) et du **nom de fichier** (`-XRPL-main.…`)
(`2.3…send/script.js:523-535`, `2.2…sign.html:171-179`).

## 3. Technologies et dépendances

### 3.1 Pile (✅ Confirmée)
- **UI** : HTML5, CSS3, Bootstrap 5.2.0-**beta1**, jQuery 3.6.0 (pages online ;
  les pages offline n'utilisent pas jQuery mais du DOM natif via l'alias `$`).
- **Crypto / chaînes** : bundle `SecureWalletBundle@2.5.4` exposant
  `{xrpl, xrplNumbers, xrplCodec, StellarSdk, Buffer, createHmac, bip39}`.
  Marqueurs internes identifiés (scan de surface) : `xrplf`, `ripple-address-codec`,
  `ripple-binary-codec`, `ripple-keypairs`, `@noble` (`ed25519`, `secp256k1`),
  `stellar-sdk`, `bip39`.
- **APIs externes (pages online)** : nœuds XRPL (`wss://xrplcluster.com`,
  testnet altnet), Horizon Stellar, prix CoinGecko (`2.1…script.js:10`) et
  Bitget (`2.1…script.js:905`), faucet testnet XRPL (`fundWallet`).

### 3.2 Dérivation Stellar (✅ Confirmée, notable)
La dérivation SLIP-0010 ed25519 (`m/44'/148'/0'`) est **réimplémentée à la
main** dans les pages offline (`1…generation.html:81-114`, `2.2…sign.html:69-101`)
via `createHmac('sha512', …)` plutôt que de s'appuyer sur un dérivateur éprouvé.
Fonctionnellement plausible, mais **non testée** et donc à valider par vecteurs
connus (SEP-0005) — voir [F-13](findings.md#f-13).

### 3.3 Problème de « localité » des dépendances (➕ à décider)
Objectif commanditaire : dépendances locales. **Non tenu** côté online
([F-08](findings.md#f-08)). Recommandation : héberger localement bundle + jQuery +
Bootstrap pour les 4 pages, geler les versions, et reconstruire le bundle depuis
des sources auditées ([F-09](findings.md#f-09)).

## 4. Mécanismes de sécurité et frontières de confiance

### 4.1 Frontières de confiance
- **Zone de confiance (offline)** : pages 1 et 2.2. C'est là que vivent les
  secrets. L'hypothèse de sécurité est que cette zone est déconnectée et saine.
- **Zone non fiable (online)** : pages 2.1 et 2.3. Elles ne doivent voir que du
  public.

### 4.2 Faiblesses structurelles des frontières (✅ Confirmées)
1. **Vérification au mauvais endroit** : le décodage lisible
   (`NETWORK.decode`, 33 occurrences) n'existe que dans la page ONLINE 2.3
   (`2.3…send/script.js:53-253, 352-425`). La page OFFLINE 2.2 signe du **JSON
   brut sans décodage** (`2.2…sign.html:266-277`). La vérification du sens de la
   transaction se fait donc **après** la signature, **sur la zone non fiable**.
   Si la page de préparation (online, non fiable) est compromise, le signataire
   approuve hors-ligne une transaction qu'il n'a pas pu lire. → [F-06](findings.md#f-06).
2. **Zone offline non isolée logiquement** : les pages offline **détectent**
   l'état en ligne mais n'en **bloquent pas** l'usage
   (`1…generation.html:206-207`). → [F-07](findings.md#f-07).
3. **Pas de CSP** : rien ne contraint les origines réseau autorisées, ni sur les
   pages offline ni online. → [F-10](findings.md#f-10).

### 4.3 Chiffrement du wallet (✅ Confirmé — point faible central)
`woff_encrypt` / `woff_decrypt` (`1…generation.html:145-173`, `2.2…sign.html:131-145`) :
- Clé AES = `SHA-256(password)` directement (`:149-152`, `:167-169`) → **aucun
  KDF, aucun sel, aucune itération** : résistance quasi nulle au bruteforce
  hors-ligne. → [F-01](findings.md#f-01).
- Mode **AES-CBC** sans tag d'authentification (`:151,168`) → pas d'intégrité,
  malléabilité. → [F-02](findings.md#f-02).
- IV aléatoire de 16 octets (`:150`), correctement préfixé en hexadécimal — OK.
- Export **en clair** si mot de passe vide (`:335-340`) → [F-04](findings.md#f-04).

### 4.4 Entropie (✅ Confirmée — correct)
`getRandomWords` (`1…generation.html:174-187`) : 12/24 mots via
`bip39.generateMnemonic(128|256)` ; longueur libre via `crypto.getRandomValues`
avec `% 2048` (sans biais puisque 2048 divise 65536). La source d'aléa est un
CSPRNG. **Bon point.**

## 5. Décisions techniques existantes — avantages / limites

| Décision (✅ constatée) | Avantage | Limite |
|------------------------|----------|--------|
| Pages HTML statiques autonomes, bundle inliné (offline) | Zéro dépendance réseau en zone sensible, portable | Fichiers de 1,6 Mo, bundle non auditable, mises à jour manuelles |
| CDN tiers (online) | Simplicité, cache navigateur | Dépendance externe, surface supply-chain, contredit l'objectif « local » (F-08) |
| `SecureWalletBundle` maison | Un seul import pour XRPL+XLM+BIP39 | Paquet opaque, provenance non vérifiée (F-09) |
| `CLASSES{XRPL,XLM}` polymorphes | Code lisible, extensible | Dupliqué entre 4 pages (dérive possible) |
| Dérivation ed25519 « maison » (Stellar) | Pas de dépendance supplémentaire | Non testée, risque de clés erronées (F-13) |
| Auto-détection réseau par nom de fichier | Confort | Fragile (`.match` non gardé — F-14) et falsifiable |
| `tfPartialPayment` sur paiements d'assets émis | Évite certains échecs de chemin | Montant livré potentiellement < affiché, sans `DeliverMin` (F-12) |

## 6. Dette technique (✅ Confirmée)

- **Aucun outillage** : pas de `package.json`, lockfile, linter, CI, tests
  ([F-13](findings.md#f-13)).
- **Duplication** des classes `XRPL`/`XLM` dans 4 fichiers → source de dérive.
- **Documentation désynchronisée** (`STRUCTURE.md`, `README`) ([F-15](findings.md#f-15)).
- **Incohérences mineures** : deux APIs de prix (CoinGecko vs Bitget), `lang="en_US"`
  pour une UI française, `walletGenAddsOptions`/« Numérique » XRPL-only non
  documenté, logs console verbeux en « prod » (`2.3…send/script.js:319`).
- **Robustesse** : plusieurs entrées non gardées ([F-14](findings.md#f-14)).

## 7. Recommandations techniques (➕ à décider) — vue d'ensemble

Le détail, l'ordre et les critères sont dans [`roadmap.md`](roadmap.md). En
résumé :

1. **Chiffrement** : remplacer `SHA-256(mdp)` par **PBKDF2-HMAC-SHA-256**
   (≥ 600 000 itérations) ou **scrypt/Argon2id**, avec **sel aléatoire** stocké
   dans le fichier ; passer en **AES-256-GCM** (AEAD) ou encrypt-then-HMAC.
   *Alternative* : réutiliser un format éprouvé (ex. keystore chiffré standard).
   ⚠️ **Rupture de format** du fichier wallet → prévoir migration/versionnage.
2. **Vérification avant signature** : porter `decode()` dans la page 2.2 et
   exiger une confirmation explicite du sens de la transaction (offline).
3. **Isolation offline** : bloquer les opérations sensibles si `navigator.onLine`
   (avec dérogation explicite documentée).
4. **Dépendances** : rapatrier toutes les libs en local pour les 4 pages,
   reconstruire le bundle depuis sources auditées, figer les versions, ajouter
   une **CSP** stricte, remplacer Bootstrap beta par une version stable.
5. **Tests** : vecteurs BIP39/SEP-0005, round-trip chiffrement, encode/decode
   de transactions et de devises (cur40), calcul de frais multisign.
6. **Mutualisation** : extraire les classes `XRPL`/`XLM` dans un module partagé
   ré-inliné à la construction, pour supprimer la duplication.
