# PRD — Product Requirements Document (audit)

> Document d'audit produit. Il **distingue explicitement** ce qui est constaté
> dans le code (`✅ Constaté`) de ce qui est proposé (`➕ Proposé`). Aucune
> fonctionnalité n'est inventée ; les propositions sont signalées comme telles.

## 1. Vision et périmètre

### Vision (telle que déclarée)
SecuredWallet se présente comme une **suite d'outils offline-first** pour gérer
des wallets XRPL et Stellar « en toute sécurité », avec **maîtrise des
dépendances** (bibliothèques conservées localement) comme objectif affiché par
le commanditaire.

### Périmètre fonctionnel constaté
Quatre pages HTML statiques, exécutables dans un navigateur, sans backend :
génération/récupération de wallet (offline), préparation de transaction
(online), signature (offline), envoi (online).

### Écart vision / réalité
L'objectif « dépendances locales » n'est tenu que pour les pages **offline**
(bundle inliné). Les pages **online** chargent le bundle crypto et les
bibliothèques UI depuis des CDN tiers (voir TRD §3 et [F-08](findings.md#f-08)).

## 2. Utilisateurs et cas d'usage

### Utilisateur cible (hypothèse)
Détenteur d'actifs XRP/XLM, à l'aise avec un navigateur, disposant idéalement
d'un **second poste hors-ligne dédié**. Le projet suppose une discipline
opérationnelle (copie de fichiers par clé USB, poste déconnecté). *Hypothèse à
confirmer : aucun persona formalisé n'existe dans le dépôt.*

### Parcours principal constaté
1. **Créer un wallet** (offline) → noter la seed-phrase → exporter le fichier
   wallet (chiffré ou non).
2. **Préparer** une transaction (online) à partir de l'adresse publique →
   télécharger `*.tosign.json`.
3. **Signer** (offline) avec la seed-phrase ou le fichier wallet →
   `*.signed.json`.
4. **Envoyer** (online) → vérifier le récapitulatif lisible → diffuser.

### Cas d'usage secondaires constatés
- Récupération d'un wallet depuis seed-phrase (12/24 mots, longueur libre, ou
  8×6 chiffres « secret numbers » Xaman pour XRPL).
- Gestion de **trustlines** (ajout / révocation).
- **Suppression de compte** (AccountDelete XRPL / accountMerge Stellar) avec
  envoi du reliquat.
- **Gestion des signataires** et activation/désactivation de la **clé maître**
  (multi-signature).
- Affichage du **solde**, des **assets non natifs**, de la **valeur en USD** et
  d'un **widget de prix** (XRPL uniquement sur certaines pages).
- **Auto-détection** du réseau (XRPL/XLM, main/test) depuis le contenu ou le nom
  de fichier de la transaction.

## 3. Exigences fonctionnelles

### Existantes (✅ Constaté)
- **FE-1** Générer un wallet XRPL ou Stellar avec entropie CSPRNG.
- **FE-2** Récupérer un wallet depuis une seed-phrase BIP39 ou des secret
  numbers.
- **FE-3** Chiffrer/déchiffrer le fichier wallet par mot de passe (⚠️ voir
  exigences de sécurité — implémentation faible).
- **FE-4** Préparer Payment, TrustSet (add/revoke), AccountDelete,
  SignerListSet / AccountSet (master on/off) pour XRPL et Stellar.
- **FE-5** Signer une transaction hors-ligne (clé régulière ou multi-signature
  XRPL).
- **FE-6** Décoder et afficher une transaction signée avant envoi.
- **FE-7** Diffuser la transaction et afficher le résultat + lien explorateur.
- **FE-8** Basculer main/test et XRPL/XLM, avec thème visuel par réseau.

### Manquantes / partielles (➕ Proposé)
- **FP-1** **Vérification lisible de la transaction AVANT signature** (offline).
  Aujourd'hui elle n'existe qu'après, en ligne — [F-06](findings.md#f-06).
- **FP-2** **Correspondance prepared ↔ signed** : rien ne garantit que la
  transaction signée est bien celle préparée (contrôle d'écart).
- **FP-3** **Blocage des opérations sensibles si la machine est en ligne** sur
  les pages offline — [F-07](findings.md#f-07).
- **FP-4** **Carnet d'adresses / liste blanche de destinataires** avec
  avertissement sur adresse inconnue (réduction du risque de collage d'adresse
  malveillante).
- **FP-5** **Historique local des transactions** (prévu dans la config
  d'exemple, non implémenté dans l'app).
- **FP-6** Support de réseaux additionnels (annoncé « extensible » mais non
  présent : ETH/BTC ne sont que des exemples de configuration).
- **FP-7** **Internationalisation** (interface actuellement 100 % en français,
  attribut `lang="en_US"` incohérent).

## 4. Exigences non fonctionnelles

### Sécurité (prioritaire)
- **NFS-1** Le fichier wallet chiffré doit résister à une attaque hors-ligne par
  dictionnaire/force brute sur le mot de passe → **KDF robuste + sel**
  (actuellement absent — [F-01](findings.md#f-01)).
- **NFS-2** Le chiffrement doit être **authentifié** (AEAD) pour détecter toute
  altération — [F-02](findings.md#f-02).
- **NFS-3** Aucune donnée secrète ne doit quitter la machine offline ; aucune
  dépendance réseau au moment de la génération/signature — à renforcer
  ([F-07](findings.md#f-07), [F-08](findings.md#f-08)).
- **NFS-4** Intégrité et provenance vérifiables de **toutes** les dépendances
  (CSP + SRI + sources auditables) — [F-08](findings.md#f-08), [F-09](findings.md#f-09),
  [F-10](findings.md#f-10).
- **NFS-5** L'utilisateur doit valider **le sens** d'une transaction (montant,
  destinataire, type) avant de l'autoriser, sur la zone de confiance (offline).

### Fiabilité
- **NFR-1** Les chemins critiques (encodage/décodage de devises, calcul des
  frais, signature, chiffrement) doivent être couverts par des tests avec
  vecteurs connus — actuellement **aucun test** ([F-13](findings.md#f-13)).
- **NFR-2** Gestion d'erreur robuste sur les entrées malformées (fichiers, noms
  de fichiers, réponses réseau) — plusieurs cas non gardés
  ([F-14](findings.md#f-14)).
- **NFR-3** Comportement déterministe des versions de dépendances (lockfile,
  versions figées ; Bootstrap beta à proscrire — [F-11](findings.md#f-11)).

### Expérience utilisateur
- **NFU-1** Saisie des secrets via champs dédiés masqués plutôt que `prompt()`
  — [F-05](findings.md#f-05).
- **NFU-2** Messages d'avertissement **bloquants et explicites** quand une action
  dégrade la sécurité (export en clair, usage en ligne).
- **NFU-3** Cohérence documentaire : le `README` ne doit pas affirmer des
  propriétés non tenues (« dérivation de clé sécurisée », « 100 % offline »,
  « intégrité CDN vérifiée ») — [F-15](findings.md#f-15).

## 5. Exigences de sécurité produit (synthèse)

| Objectif | Promesse actuelle (doc) | Réalité du code | Réf |
|----------|-------------------------|-----------------|-----|
| Chiffrement fort du wallet | « AES-256 + dérivation sécurisée » | AES-256-CBC, clé = SHA-256(mdp), sans sel/KDF, non authentifié | F-01, F-02 |
| Clés jamais exposées en ligne | « Offline-first », « isolation stricte » | Pages offline non bloquées si online ; export clair possible | F-04, F-07 |
| Dépendances maîtrisées | « conservées localement » | CDN tiers sur les pages online ; bundle opaque | F-08, F-09 |
| Vérification des transactions | « contrôles d'intégrité » | Vérification lisible seulement après signature | F-06 |

## 6. Limites, hypothèses et questions ouvertes

**Hypothèses de l'audit**
- Le poste « offline » est réellement déconnecté lors des étapes 1 et 2.2 (non
  garanti par le logiciel).
- L'utilisateur transfère les fichiers par un support amovible, pas par réseau.

**Questions à trancher (décision produit)**
- Q1 — Le chiffrement du fichier wallet doit-il être **obligatoire** ?
- Q2 — Quel niveau de menace vise-t-on (vol de fichier ? poste online
  compromis ? poste offline compromis ?) — cela conditionne F-06/F-07.
- Q3 — Garde-t-on la distribution « fichier HTML unique autonome » (contrainte
  forte sur le build et l'inlining) ou passe-t-on à une appli packagée
  (PWA/Electron) signée ?
- Q4 — La fonctionnalité **longueur de seed libre** (« Au choix ») produit des
  wallets potentiellement non restaurables par des outils tiers : la conserve-
  t-on, et avec quel avertissement ?
- Q5 — Quelle politique de support multi-réseau réelle (XRPL/XLM seulement, ou
  extension annoncée) ?

**Zones non auditées**
- Contenu interne du bundle minifié ([F-09](findings.md#f-09)).
- Comportement réel en navigateur (aucune exécution effectuée, conformément aux
  règles de la mission).
