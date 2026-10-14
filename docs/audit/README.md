# Audit du projet SecuredWallet — Synthèse générale

> **Nature du document** : audit technique et produit, **lecture seule**. Aucune
> ligne de code applicatif, de configuration ou de dépendance n'a été modifiée
> pendant cette phase. Les constats sont fondés sur le code réellement présent
> dans le dépôt au commit `702ccff`.
>
> **Date** : 2026-10-13
> **Périmètre audité** : `OFFLINE_wallet/`, `ONLINE_transaction/`, `README.md`.
> **Non audité** : contenu interne du bundle minifié `SecureWalletBundle@2.5.4`
> (1,38 Mo, inliné dans les pages offline) — voir [F-09](findings.md#f-09).

## 1. Qu'est-ce que le projet, réellement ?

SecuredWallet est une **suite de 4 pages HTML statiques** (pas d'application
serveur, pas de build, pas de framework) qui implémente un workflow de wallet
« air-gap » pour deux blockchains : **XRPL** (XRP) et **Stellar** (XLM).

Le workflow en 4 étapes, tel qu'il existe dans le code :

| Étape | Fichier | Zone | Rôle réel constaté |
|------|---------|------|--------------------|
| 1 | `OFFLINE_wallet/1.OFFLINE_wallet-generation.html` | OFFLINE | Génère ou récupère un wallet (seed BIP39 12/24 mots, « secret numbers » Xaman, ou longueur libre), affiche la clé privée, exporte un fichier wallet chiffré ou en clair |
| 2.1 | `ONLINE_transaction/2.1.ONLINE_transaction-prepare/` | ONLINE | Interroge la blockchain, construit une transaction non signée (Payment, TrustSet, AccountDelete, SignerListSet/AccountSet), l'exporte en `.tosign.json` |
| 2.2 | `OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html` | OFFLINE | Signe la transaction avec la seed-phrase ou le fichier wallet, exporte un `.signed.json` |
| 2.3 | `ONLINE_transaction/2.3.ONLINE_transaction-send/` | ONLINE | Décode la transaction signée en clair, l'affiche pour vérification, la diffuse sur le réseau |

Les clés privées ne transitent que par les pages **OFFLINE** (1 et 2.2). Les
pages **ONLINE** (2.1 et 2.3) ne manipulent que des adresses publiques et des
transactions.

## 2. État de maturité

**Prototype fonctionnel avancé, non durci.** Le code couvre un périmètre
fonctionnel riche (multi-réseau, multi-signature, trustlines, suppression de
compte, gestion de la clé maître) et le découpage online/offline est réel. Mais
le projet présente les marqueurs d'un prototype :

- **Aucun test** (unitaire, intégration ou e2e), aucun `package.json`, aucun
  lockfile, aucune CI — voir [F-13](findings.md#f-13).
- **Dépendance critique opaque** : le cœur cryptographique est un bundle npm
  non standard (`securewalletbundle`), inliné et minifié, non reconstructible
  depuis des sources auditées en l'état — [F-09](findings.md#f-09).
- **Documentation en décalage avec le code** (fonctionnalités annoncées mais
  non vérifiables, arborescence décrite inexistante) — [F-15](findings.md#f-15).

## 3. Forces constatées

- Séparation online/offline matérialisée par des fichiers distincts, avec les
  clés privées confinées aux pages offline.
- Pages offline **autonomes** : bundle crypto et CSS inlinés, donc exécutables
  sans réseau une fois le fichier copié.
- Décodage **lisible par un humain** des transactions signées avant diffusion
  (étape 2.3), avec distinction des types de transaction et détection du
  multi-signature.
- Génération de l'entropie via `bip39.generateMnemonic` et
  `crypto.getRandomValues` (CSPRNG), sans biais de modulo détecté pour la
  longueur libre (2048 divise 65536).
- SRI (Subresource Integrity) présent sur les ressources CDN des pages online.

## 4. Faiblesses majeures (résumé)

Les constats détaillés, avec preuves (fichier:ligne), gravité et niveau de
confiance, sont dans [`findings.md`](findings.md). Les plus structurants :

| Réf | Gravité | Constat en une ligne |
|-----|---------|----------------------|
| [F-01](findings.md#f-01) | **Critique** | Clé de chiffrement = `SHA-256(mot de passe)` : aucun KDF, aucun sel, aucune itération |
| [F-02](findings.md#f-02) | Élevée | Chiffrement AES-CBC **sans authentification** (ni GCM ni MAC) |
| [F-06](findings.md#f-06) | Élevée | La **vérification lisible** de la transaction a lieu **après** la signature (online), pas avant (offline) |
| [F-08](findings.md#f-08) | Élevée | Objectif « dépendances locales » **non tenu** : les pages online chargent le bundle et les libs depuis des CDN tiers |
| [F-04](findings.md#f-04) | Élevée | Export du wallet **en clair** autorisé si le mot de passe est laissé vide |
| [F-03](findings.md#f-03) | Élevée | « Effacement » des secrets en mémoire **illusoire** (chaînes immuables, copies DOM) |
| [F-07](findings.md#f-07) | Moyenne | Les pages « offline » ne **bloquent pas** leur usage quand la machine est en ligne |
| [F-09](findings.md#f-09) | Moyenne | Provenance/intégrité du bundle `securewalletbundle@2.5.4` **non vérifiée** |
| [F-10](findings.md#f-10) | Moyenne | **Aucune CSP** sur aucune page |

## 5. Documents de l'audit

- [`prd.md`](prd.md) — Exigences et périmètre produit (existant vs proposé).
- [`trd.md`](trd.md) — Architecture technique, flux, frontières de confiance,
  dette.
- [`findings.md`](findings.md) — Inventaire structuré des faiblesses, avec
  preuves, gravité et confiance.
- [`roadmap.md`](roadmap.md) — Plan d'action correctif priorisé + pistes
  d'évolution.

## 6. Synthèse exécutive

Le projet **fait ce qu'il annonce sur le plan fonctionnel** : il génère des
wallets XRPL/Stellar et permet un cycle préparer / signer hors-ligne / envoyer.
L'intention de sécurité (air-gap, chiffrement, confinement des clés) est
présente dans l'architecture.

En revanche, **les garanties de sécurité promises ne sont pas atteintes par
l'implémentation actuelle**. Trois écarts dominent :

1. **Le chiffrement des wallets est cassable** en pratique face à un mot de
   passe faible ou moyen, faute de fonction de dérivation de clé ([F-01](findings.md#f-01)),
   et **non authentifié** ([F-02](findings.md#f-02)). Un fichier wallet volé est exposé.
2. **Le modèle air-gap est partiellement contourné par la conception** :
   l'utilisateur signe hors-ligne une transaction qu'il ne peut vérifier que
   plus tard, en ligne ([F-06](findings.md#f-06)), et les pages « offline » restent
   utilisables en ligne ([F-07](findings.md#f-07)).
3. **La maîtrise des dépendances — raison d'être affichée du projet — n'est pas
   réalisée** : les pages online dépendent de CDN tiers ([F-08](findings.md#f-08)) et le
   bundle crypto central n'est ni auditable ni reconstruit depuis des sources
   vérifiées ([F-09](findings.md#f-09)).

**Priorité absolue** : corriger la dérivation de clé et l'authentification du
chiffrement (F-01, F-02), rapatrier et auditer les dépendances (F-08, F-09),
puis déplacer la vérification lisible avant la signature (F-06). Le détail,
l'ordre et les critères de validation sont dans [`roadmap.md`](roadmap.md).

**Ce document ne recommande aucune implémentation immédiate** ; il établit le
constat et la feuille de route à valider avant toute phase de correction.
